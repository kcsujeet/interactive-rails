/**
 * Level 39: Webhooks & Idempotency
 *
 * Tests mirror data structures to verify:
 * - Discovery defs and probe mappings
 * - Build step quality (no answer leaks, valid feedback)
 * - Stress scenario coverage and consistency
 * - Cross-phase consistency
 */

import { describe, expect, test } from 'bun:test';

// ── Mirrored data from Level39Webhooks.tsx ──

const DISCOVERY_DEFS = [
	{ id: 'no-signature', label: 'No signature verification on webhooks' },
	{ id: 'duplicate-credit', label: 'Duplicate webhook doubles user credit' },
	{ id: 'sync-timeout', label: 'Synchronous processing risks timeout' },
	{ id: 'no-dedup', label: 'No event deduplication (event_id not tracked)' },
];

const PROBES = [
	{
		id: 'forged-webhook',
		label: 'Attacker forges payment webhook',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"type": "payment_intent.succeeded", "amount": 1000000}\'',
		responseLines: [
			{ text: '200 OK', color: 'yellow' },
			{ text: '# No Stripe-Signature header checked!', color: 'red' },
			{
				text: '# Anyone can POST fake events to this endpoint',
				color: 'red',
			},
			{ text: '# Attacker credits themselves $10,000', color: 'red' },
		],
	},
	{
		id: 'duplicate-event',
		label: 'Stripe retries payment event (network hiccup)',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"id": "evt_123", "type": "payment_intent.succeeded"}\'',
		responseLines: [
			{
				text: '# Stripe retries evt_123 (network hiccup)',
				color: 'yellow',
			},
			{ text: '200 OK', color: 'yellow' },
			{
				text: '# User credited AGAIN for the same payment!',
				color: 'red',
			},
			{
				text: '# $50 payment = $100 credit. No dedup check.',
				color: 'red',
			},
		],
	},
	{
		id: 'slow-processing',
		label: 'Monthly invoice webhook (slow handler)',
		command:
			'curl -X POST localhost:3000/webhooks/stripe -d \'{"type": "invoice.paid"}\' --max-time 25',
		responseLines: [
			{
				text: '# Processing synchronously: query user, update 12 line items, send email...',
				color: 'yellow',
			},
			{
				text: '# 15 seconds elapsed... Stripe timeout is 20 seconds',
				color: 'red',
			},
			{
				text: '# Stripe marks delivery failed, will retry in 1 hour',
				color: 'red',
			},
			{
				text: '# Same event processed again on retry = double credit',
				color: 'red',
			},
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'forged-webhook': ['no-signature'],
	'duplicate-event': ['duplicate-credit', 'no-dedup'],
	'slow-processing': ['sync-timeout'],
};

// ── Build step option arrays ──

const GENERATE_MIGRATION_COMMANDS = [
	{
		id: 'wrong-no-index',
		label: 'rails g migration CreateWebhookEvents provider event_id event_type',
		correct: false,
		feedback:
			'Without a unique index on [provider, event_id], race conditions between concurrent webhooks can insert duplicates before your code checks.',
	},
	{
		id: 'correct',
		label:
			'rails g migration CreateWebhookEvents provider:string event_id:string event_type:string payload:jsonb status:string processed_at:datetime',
		correct: true,
	},
	{
		id: 'wrong-wrong-columns',
		label: 'rails g migration CreateWebhookLogs url method response_code',
		correct: false,
		feedback:
			'This tracks outgoing HTTP requests, not incoming webhook events. You need to store the event ID from the provider for deduplication.',
	},
];

const RUN_MIGRATION_COMMANDS = [
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		correct: false,
		feedback:
			'db:seed loads seed data. The migration file still needs to be applied to create the webhook_events table.',
	},
	{
		id: 'wrong-reset',
		label: 'rails db:reset',
		correct: false,
		feedback:
			'db:reset drops and recreates the entire database. You only need to apply the new migration, not destroy existing data.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		correct: true,
	},
];

const CONFIGURE_SIGNATURE_OPTIONS = [
	{
		id: 'wrong-json-parse',
		label: 'Parse JSON body directly (no verification)',
		correct: false,
		feedback:
			'Without signature verification, anyone can POST fake webhook events. The payload must be verified against a cryptographic signature before processing.',
	},
	{
		id: 'wrong-manual-hmac',
		label: 'Compare raw HMAC manually',
		correct: false,
		feedback:
			'Stripe signatures use a timestamp-based scheme (t=...,v1=...) to prevent replay attacks. Manual HMAC comparison misses the timestamp check and is vulnerable to replay.',
	},
	{
		id: 'correct',
		label: 'Verify HMAC signature via Stripe gem',
		correct: true,
	},
];

const CONFIGURE_IDEMPOTENCY_OPTIONS = [
	{
		id: 'wrong-memory-set',
		label: 'Track event IDs in a Set (in memory)',
		correct: false,
		feedback:
			'In-memory sets are lost on restart and not shared across processes. Multiple Puma workers would each have their own set, missing duplicates handled by other workers.',
	},
	{
		id: 'wrong-find-by',
		label: 'Check with find_by before creating',
		correct: false,
		feedback:
			'find_by + create has a race condition. Two concurrent requests can both pass the find_by check before either inserts. You need an atomic operation backed by a database constraint.',
	},
	{
		id: 'correct',
		label: 'Atomic find_or_create_by with unique index',
		correct: true,
	},
];

const CONFIGURE_ASYNC_OPTIONS = [
	{
		id: 'wrong-sync',
		label: 'Process synchronously in the controller',
		correct: false,
		feedback:
			'Synchronous processing (DB queries, email sending) can take 10-20 seconds. Stripe times out at 20 seconds and retries, causing duplicate processing.',
	},
	{
		id: 'correct',
		label: 'Enqueue background job, return 200 immediately',
		correct: true,
	},
	{
		id: 'wrong-thread',
		label: 'Spawn a thread for processing',
		correct: false,
		feedback:
			'Raw threads have no retry logic, no error tracking, no persistence. If the thread crashes, the event is lost. Background jobs (Solid Queue) handle all of this.',
	},
];

const BUILD_SERVICE_OPTIONS = [
	{
		id: 'wrong-controller-logic',
		label: 'All logic in the controller action',
		correct: false,
		feedback:
			'Keeping all webhook logic in the controller violates the pattern established in earlier levels. Complex multi-step operations belong in a dedicated object.',
	},
	{
		id: 'correct',
		label: 'Service with contract, dedup, and async dispatch',
		correct: true,
	},
	{
		id: 'wrong-no-dedup-service',
		label: 'Service without idempotency check',
		correct: false,
		feedback:
			'create! raises an exception on duplicate event_id (unique index constraint), but does not gracefully handle already-processed events. You need an atomic upsert pattern instead.',
	},
];

const ALL_OPTION_SETS = [
	{
		name: 'GENERATE_MIGRATION_COMMANDS',
		options: GENERATE_MIGRATION_COMMANDS,
	},
	{ name: 'RUN_MIGRATION_COMMANDS', options: RUN_MIGRATION_COMMANDS },
	{
		name: 'CONFIGURE_SIGNATURE_OPTIONS',
		options: CONFIGURE_SIGNATURE_OPTIONS,
	},
	{
		name: 'CONFIGURE_IDEMPOTENCY_OPTIONS',
		options: CONFIGURE_IDEMPOTENCY_OPTIONS,
	},
	{ name: 'CONFIGURE_ASYNC_OPTIONS', options: CONFIGURE_ASYNC_OPTIONS },
	{ name: 'BUILD_SERVICE_OPTIONS', options: BUILD_SERVICE_OPTIONS },
];

// ── Stress scenarios ──

const STRESS_SCENARIOS = [
	{
		id: 'forged-webhook',
		label: 'Attacker forges payment webhook (with verification)',
		description: 'No valid Stripe-Signature header, rejected at signature gate',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '401 Unauthorized', color: 'red' },
			{ text: '# Stripe-Signature missing or invalid', color: 'red' },
			{ text: '# Blocked at HMAC verification', color: 'muted' },
		],
	},
	{
		id: 'duplicate-event',
		label: 'Stripe retries payment event (with dedup)',
		description: 'Same event_id already processed, returns 200 and skips',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '# evt_123: already in webhook_events (completed)',
				color: 'muted',
			},
			{ text: '# Duplicate skipped. No reprocessing.', color: 'green' },
		],
	},
	{
		id: 'slow-processing',
		label: 'Monthly invoice webhook (with async)',
		description: 'Event verified, stored, and enqueued in <50ms',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK (47ms)', color: 'green' },
			{
				text: '# Signature verified, event stored, job enqueued',
				color: 'muted',
			},
			{ text: '# 12 line items processed in background', color: 'green' },
		],
	},
	{
		id: 'valid-subscription',
		label: 'Valid subscription webhook (new event)',
		description: 'Authentic webhook, new event, full pipeline',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'stripe',
		expectedResult: 'allowed' as const,
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '# subscription.created verified and enqueued',
				color: 'green',
			},
		],
	},
	{
		id: 'bad-payload',
		label: 'Malformed JSON payload (rejected)',
		description: 'Garbled payload fails JSON parsing, 400 Bad Request',
		method: 'POST' as const,
		path: '/webhooks/stripe',
		actor: 'attacker',
		expectedResult: 'blocked' as const,
		responseLines: [
			{ text: '400 Bad Request', color: 'red' },
			{ text: '# JSON::ParserError raised', color: 'red' },
			{ text: '# Blocked before signature verification', color: 'muted' },
		],
	},
];

// ── Tests ──

describe('Level 39: Webhooks & Idempotency', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('all IDs unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all labels unique and non-empty', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
			for (const label of labels) {
				expect(label.length).toBeGreaterThan(5);
			}
		});

		test('exact IDs match component', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(ids).toEqual([
				'no-signature',
				'duplicate-credit',
				'sync-timeout',
				'no-dedup',
			]);
		});
	});

	describe('Probe definitions', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES.length).toBe(3);
		});

		test('exact probe IDs', () => {
			expect(PROBES.map((p) => p.id)).toEqual([
				'forged-webhook',
				'duplicate-event',
				'slow-processing',
			]);
		});

		test('each probe has exactly 4 response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBe(4);
			}
		});

		test('forged-webhook probe shows missing signature check', () => {
			const probe = PROBES.find((p) => p.id === 'forged-webhook');
			expect(probe?.responseLines[0].text).toBe('200 OK');
			expect(probe?.responseLines[1].text).toBe(
				'# No Stripe-Signature header checked!',
			);
			expect(probe?.responseLines[3].text).toBe(
				'# Attacker credits themselves $10,000',
			);
		});

		test('duplicate-event probe shows double credit', () => {
			const probe = PROBES.find((p) => p.id === 'duplicate-event');
			expect(probe?.responseLines[2].text).toBe(
				'# User credited AGAIN for the same payment!',
			);
			expect(probe?.responseLines[3].text).toBe(
				'# $50 payment = $100 credit. No dedup check.',
			);
		});

		test('slow-processing probe shows timeout risk', () => {
			const probe = PROBES.find((p) => p.id === 'slow-processing');
			expect(probe?.responseLines[1].text).toBe(
				'# 15 seconds elapsed... Stripe timeout is 20 seconds',
			);
		});
	});

	describe('Probe-to-discovery mapping', () => {
		test('every probe maps to at least one discovery', () => {
			for (const probe of PROBES) {
				const mapped = PROBE_DISCOVERY_MAP[probe.id];
				expect(mapped).toBeDefined();
				expect(mapped.length).toBeGreaterThanOrEqual(1);
			}
		});

		test('all mapped discovery IDs exist in DISCOVERY_DEFS', () => {
			const validIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const [, discoveryIds] of Object.entries(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveryIds) {
					expect(validIds.has(id)).toBe(true);
				}
			}
		});

		test('every discovery is reachable via probes', () => {
			const allMapped = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(allMapped.has(def.id)).toBe(true);
			}
		});

		test('forged-webhook maps to no-signature', () => {
			expect(PROBE_DISCOVERY_MAP['forged-webhook']).toEqual(['no-signature']);
		});

		test('duplicate-event maps to duplicate-credit and no-dedup', () => {
			expect(PROBE_DISCOVERY_MAP['duplicate-event']).toEqual([
				'duplicate-credit',
				'no-dedup',
			]);
		});

		test('slow-processing maps to sync-timeout', () => {
			expect(PROBE_DISCOVERY_MAP['slow-processing']).toEqual(['sync-timeout']);
		});
	});

	describe('Build step quality', () => {
		for (const { name, options } of ALL_OPTION_SETS) {
			describe(name, () => {
				test('has exactly 3 options', () => {
					expect(options.length).toBe(3);
				});

				test('exactly one correct answer', () => {
					const correctCount = options.filter((o) => o.correct).length;
					expect(correctCount).toBe(1);
				});

				test('correct answer is not the first option', () => {
					expect(options[0].correct).toBe(false);
				});

				test('every wrong option has non-empty feedback', () => {
					const wrongOptions = options.filter((o) => !o.correct);
					for (const opt of wrongOptions) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(10);
					}
				});
			});
		}

		test('CONFIGURE_SIGNATURE feedback does not contain "construct_event"', () => {
			const wrong = CONFIGURE_SIGNATURE_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('construct_event');
			}
		});

		test('CONFIGURE_SIGNATURE feedback does not contain "Stripe::Webhook"', () => {
			const wrong = CONFIGURE_SIGNATURE_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('Stripe::Webhook');
			}
		});

		test('CONFIGURE_IDEMPOTENCY feedback does not contain "find_or_create_by"', () => {
			const wrong = CONFIGURE_IDEMPOTENCY_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('find_or_create_by');
			}
		});

		test('CONFIGURE_ASYNC feedback does not contain "perform_later"', () => {
			const wrong = CONFIGURE_ASYNC_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('perform_later');
			}
		});

		test('BUILD_SERVICE feedback does not contain "IngestStripeWebhook" or "verify_signature!"', () => {
			const wrong = BUILD_SERVICE_OPTIONS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('IngestStripeWebhook');
				expect(opt.feedback ?? '').not.toContain('verify_signature!');
				expect(opt.feedback ?? '').not.toContain('deduplicate!');
			}
		});

		test('GENERATE_MIGRATION feedback does not contain "payload:jsonb" or "status:string"', () => {
			const wrong = GENERATE_MIGRATION_COMMANDS.filter((o) => !o.correct);
			for (const opt of wrong) {
				expect(opt.feedback ?? '').not.toContain('payload:jsonb');
				expect(opt.feedback ?? '').not.toContain('status:string');
			}
		});
	});

	describe('Stress scenarios', () => {
		test('has exactly 5 scenarios', () => {
			expect(STRESS_SCENARIOS.length).toBe(5);
		});

		test('all IDs unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all labels unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('exact scenario IDs', () => {
			expect(STRESS_SCENARIOS.map((s) => s.id)).toEqual([
				'forged-webhook',
				'duplicate-event',
				'slow-processing',
				'valid-subscription',
				'bad-payload',
			]);
		});

		test('every scenario has non-empty responseLines', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBeGreaterThanOrEqual(2);
				expect(s.responseLines[0].text.length).toBeGreaterThan(0);
			}
		});

		test('response line counts match exactly', () => {
			const counts: Record<string, number> = {
				'forged-webhook': 3,
				'duplicate-event': 3,
				'slow-processing': 3,
				'valid-subscription': 2,
				'bad-payload': 3,
			};
			for (const s of STRESS_SCENARIOS) {
				expect(s.responseLines.length).toBe(counts[s.id]);
			}
		});

		test('mix of allowed and blocked', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBe(3);
			expect(blocked.length).toBe(2);
		});

		test('specific expected results match', () => {
			const resultMap = Object.fromEntries(
				STRESS_SCENARIOS.map((s) => [s.id, s.expectedResult]),
			);
			expect(resultMap['forged-webhook']).toBe('blocked');
			expect(resultMap['duplicate-event']).toBe('allowed');
			expect(resultMap['slow-processing']).toBe('allowed');
			expect(resultMap['valid-subscription']).toBe('allowed');
			expect(resultMap['bad-payload']).toBe('blocked');
		});

		test('forged-webhook scenario returns 401', () => {
			const s = STRESS_SCENARIOS.find((s) => s.id === 'forged-webhook');
			expect(s?.responseLines[0].text).toBe('401 Unauthorized');
		});

		test('duplicate-event scenario returns 200 with skip', () => {
			const s = STRESS_SCENARIOS.find((s) => s.id === 'duplicate-event');
			expect(s?.responseLines[0].text).toBe('200 OK');
			expect(s?.responseLines[2].text).toBe(
				'# Duplicate skipped. No reprocessing.',
			);
		});
	});

	describe('Cross-phase consistency', () => {
		test('every probe has a matching reward scenario', () => {
			const probeIds = PROBES.map((p) => p.id);
			const scenarioIds = STRESS_SCENARIOS.map((s) => s.id);
			for (const probeId of probeIds) {
				expect(scenarioIds).toContain(probeId);
			}
		});

		test('probe and scenario labels mirror each other', () => {
			for (const probe of PROBES) {
				const scenario = STRESS_SCENARIOS.find((s) => s.id === probe.id);
				expect(scenario).toBeDefined();

				// Each scenario label should contain the probe's key concept
				if (probe.id === 'forged-webhook') {
					expect(probe.label).toContain('forges');
					expect(scenario?.label).toContain('forges');
				}
				if (probe.id === 'duplicate-event') {
					expect(probe.label).toContain('retries');
					expect(scenario?.label).toContain('retries');
				}
				if (probe.id === 'slow-processing') {
					expect(probe.label).toContain('invoice');
					expect(scenario?.label).toContain('invoice');
				}
			}
		});

		test('reward scenarios include additional scenarios beyond observe probes', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			const extras = STRESS_SCENARIOS.filter((s) => !probeIds.has(s.id));
			expect(extras.length).toBe(2);
			expect(extras.map((e) => e.id)).toContain('valid-subscription');
			expect(extras.map((e) => e.id)).toContain('bad-payload');
		});

		test('all scenarios target the same endpoint', () => {
			for (const s of STRESS_SCENARIOS) {
				expect(s.path).toBe('/webhooks/stripe');
				expect(s.method).toBe('POST');
			}
		});
	});
});
