/**
 * Level 47: Observability. Post-redesign tests (2026-07-10).
 *
 * The redesign's thesis: the error tracker (built at the error-monitoring
 * level) catches what BREAKS; observability is for what is silently
 * wrong (slow, stuck, degraded) and raises nothing. Pins guard the audit
 * findings:
 *   - No placeholder nodes: observe shows only what exists (customers,
 *     app, production.log, Solid Queue worker, uptime monitor). The
 *     trace timeline appears only in reward (the build creates it).
 *   - Rails 8 honesty: /up EXISTS (Rails::HealthController, 200 =
 *     booted, checks no dependencies, per its API docs). Nothing says
 *     404 or "missing" anywhere.
 *   - Solid-stack honesty: no Redis, no Kubernetes, no microservices.
 *   - No tenant_id (multi-tenancy is a later level's concept).
 *   - The deep health check is real, verified code: SELECT 1 +
 *     SolidQueue::Process.last_heartbeat_at (model + column verified in
 *     the solid_queue source; processes heartbeat per its README).
 * Gem APIs verified 2026-07-10: lograge README (custom_payload receives
 * the controller), opentelemetry.io getting-started (use_all(), service
 * name, initializer path), rubygems versions.
 */

import { describe, expect, test } from 'bun:test';
import {
	expectAllDiscoveriesRequired,
	expectBuildStepQuality,
	expectProbeDiscoveryMapOneToOne,
	expectProbesMatchScenarios,
	expectScenarioBasics,
	expectStoriesPresent,
} from '@/lib/testing/level-pedagogy';
import { expectEveryProbeDrivesDistinctChange } from '@/lib/testing/probe-pedagogy';
import {
	DISCOVERY_DEFS,
	getCodeFiles,
	INSTALL_LOGRAGE_COMMANDS,
	INSTALL_OTEL_COMMANDS,
	OBSERVE_PROBE_FRAMES,
	OPTION_STEP_CONFIG,
	PROBE_DISCOVERY_MAP,
	PROBES,
	REWARD_PROBE_FRAMES,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../components/level-47-observability/Level47Observability';

const previewText = (phase: 'observe' | 'build' | 'reward', step: number) =>
	getCodeFiles(phase, step)
		.map((f) => `${f.filename}\n${f.code}`)
		.join('\n');

describe('Level 47: discovery / probe wiring', () => {
	test('all discoveries are required', () => {
		expectAllDiscoveriesRequired({
			discoveries: DISCOVERY_DEFS,
			minRequired: DISCOVERY_DEFS.length,
		});
	});

	test('probe-discovery map is strictly 1:1', () => {
		expectProbeDiscoveryMapOneToOne({
			probes: PROBES,
			discoveries: DISCOVERY_DEFS,
			map: PROBE_DISCOVERY_MAP,
		});
	});

	test('probes tell 3-6 bullet stories', () => {
		expectStoriesPresent({ items: PROBES, kind: 'probe' });
	});

	test('probes never name the fix tools', () => {
		const text = JSON.stringify(PROBES).toLowerCase();
		for (const forbidden of ['lograge', 'opentelemetry', 'otel', 'json']) {
			expect(text.includes(forbidden), `probes mention "${forbidden}"`).toBe(
				false,
			);
		}
	});
});

describe('Level 47: world honesty (Rails 8 + Solid stack + post-L46)', () => {
	test('nothing anywhere claims /up is missing or 404s', () => {
		const all = JSON.stringify({
			PROBES,
			OBSERVE_PROBE_FRAMES,
			REWARD_PROBE_FRAMES,
			STRESS_SCENARIOS,
		});
		for (const forbidden of ['404', 'Missing', 'missing (']) {
			expect(all.includes(forbidden), `level claims "${forbidden}"`).toBe(
				false,
			);
		}
		// The /up probe shows the honest 200-because-booted behavior.
		expect(
			JSON.stringify(OBSERVE_PROBE_FRAMES['check-worker-health']),
		).toContain('200');
	});

	test('no Redis / Kubernetes / microservices / tenant vocabulary', () => {
		const all =
			JSON.stringify({
				PROBES,
				OBSERVE_PROBE_FRAMES,
				REWARD_PROBE_FRAMES,
				STRESS_SCENARIOS,
				OPTION_STEP_CONFIG,
			}) +
			previewText('reward', STEP_DEFS.length) +
			previewText('observe', -1);
		for (const forbidden of [
			'Redis',
			'redis',
			'Kubernetes',
			'kubernetes',
			'microservice',
			'tenant_id',
			'cross-service',
		]) {
			expect(all.includes(forbidden), `level contains "${forbidden}"`).toBe(
				false,
			);
		}
	});

	test('the level acknowledges the error tracker built two levels ago', () => {
		// Cumulative infrastructure: L46 exists. The pains here are the ones
		// that raise nothing, so the tracker stays silent.
		const text = JSON.stringify(PROBES).toLowerCase();
		expect(text).toContain('error tracker');
		expect(text).toContain('nothing');
	});

	test('observe frames never touch the traces zone (it does not exist yet)', () => {
		for (const [probeId, frames] of Object.entries(OBSERVE_PROBE_FRAMES)) {
			for (const [i, frame] of frames.entries()) {
				for (const zone of Object.keys(frame.zones ?? {})) {
					expect(
						zone === 'traces',
						`${probeId} frame ${i} touches reward-only zone "traces"`,
					).toBe(false);
				}
			}
		}
	});
});

describe('Level 47: observe visuals', () => {
	test('every probe has frames and drives a distinct animation', () => {
		for (const probe of PROBES) {
			expect(
				OBSERVE_PROBE_FRAMES[probe.id],
				`probe "${probe.id}" has no observe frames`,
			).toBeInstanceOf(Array);
		}
		expectEveryProbeDrivesDistinctChange({
			probes: PROBES,
			probeStateMap: OBSERVE_PROBE_FRAMES,
			serialize: (_id, frames) => JSON.stringify(frames),
		});
	});

	test('every observe probe ends on customer-visible damage', () => {
		const lastFrames = {
			'hunt-slow-checkout': 'abandon',
			'trace-one-customer': 'support cannot answer',
			'find-bottleneck': 'day 2',
			'check-worker-health': 'receipts',
		};
		for (const [probeId, expected] of Object.entries(lastFrames)) {
			const frames = OBSERVE_PROBE_FRAMES[probeId] ?? [];
			const text = JSON.stringify(frames).toLowerCase();
			expect(text, `probe "${probeId}" damage`).toContain(expected);
		}
	});
});

describe('Level 47: probe / scenario pairing and reward wiring', () => {
	test('every probe has a matching reward scenario (same id and label)', () => {
		expectProbesMatchScenarios({ probes: PROBES, scenarios: STRESS_SCENARIOS });
	});

	test('scenario basics and stories', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	test('every scenario has reward frames; no orphans; all distinct', () => {
		const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				REWARD_PROBE_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
		}
		for (const key of Object.keys(REWARD_PROBE_FRAMES)) {
			expect(ids.has(key), `frames for "${key}" have no button`).toBe(true);
		}
		expectEveryProbeDrivesDistinctChange({
			probes: STRESS_SCENARIOS,
			probeStateMap: REWARD_PROBE_FRAMES,
			serialize: (_id, frames) => JSON.stringify(frames),
		});
	});

	test('paired reward stories replay the observe story ("same ...")', () => {
		for (const probe of PROBES) {
			const scenario = STRESS_SCENARIOS.find((s) => s.id === probe.id);
			expect(
				scenario?.story?.[0].toLowerCase().startsWith('same'),
				`scenario "${probe.id}" story must open with the same-actor replay`,
			).toBe(true);
		}
	});

	test('the deep health check catches the dead worker: 503, then a page', () => {
		const blocked = STRESS_SCENARIOS.filter(
			(s) => s.expectedResult === 'blocked',
		).map((s) => s.id);
		expect(blocked).toEqual(['check-worker-health']);
		const frames = JSON.stringify(
			REWARD_PROBE_FRAMES['check-worker-health'],
		).toLowerCase();
		expect(frames).toContain('503');
		expect(frames).toContain('page');
	});
});

describe('Level 47: build steps', () => {
	test('step defs are the 6-step chain', () => {
		expect(STEP_DEFS.map((s) => s.id)).toEqual([
			'install-lograge',
			'configure-lograge',
			'custom-fields',
			'install-otel',
			'configure-otel',
			'health-endpoint',
		]);
	});

	test('terminal steps: quality rules + real current gem versions', () => {
		for (const [name, commands] of [
			['install-lograge', INSTALL_LOGRAGE_COMMANDS],
			['install-otel', INSTALL_OTEL_COMMANDS],
		] as const) {
			expectBuildStepQuality({
				name,
				options: commands.map((c) => ({
					id: c.id,
					label: c.label,
					correct: c.correct,
					feedback: c.feedback,
				})),
			});
		}
	});

	test('option steps are 1,2,4,5 with three options each; quality rules pass', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([
			1, 2, 4, 5,
		]);
		for (const [index, config] of Object.entries(OPTION_STEP_CONFIG)) {
			expect(config.options.length, `step ${index} option count`).toBe(3);
			expectBuildStepQuality({
				name: `step-${index} (${config.title})`,
				options: config.options.map((o) => ({
					id: o.id,
					label: o.name,
					correct: o.correct,
					feedback: o.feedback,
				})),
			});
		}
	});

	test('wrong-option feedback never contains that step answer tokens', () => {
		const stepAnswerTokens: [number, string[]][] = [
			[1, ['Json.new']],
			[2, ['custom_payload']],
			[4, ['use_all', 'service_name']],
			[5, ['SolidQueue::Process', 'HealthCheckService', 'SELECT 1']],
		];
		for (const [index, tokens] of stepAnswerTokens) {
			const config = OPTION_STEP_CONFIG[index];
			for (const option of config.options.filter((o) => !o.correct)) {
				for (const token of tokens) {
					expect(
						option.feedback?.includes(token),
						`step ${index} feedback for "${option.id}" leaks "${token}"`,
					).toBe(false);
				}
			}
		}
	});
});

describe('Level 47: code preview boundaries and verified final code', () => {
	test('observe preview never names the fix tools', () => {
		const observe = previewText('observe', -1);
		for (const token of [
			'lograge',
			'Lograge',
			'Json.new',
			'custom_payload',
			'opentelemetry',
			'use_all',
			'HealthCheckService',
			'SolidQueue::Process',
		]) {
			expect(observe.includes(token), `observe preview leaks "${token}"`).toBe(
				false,
			);
		}
	});

	test('preview while working on step N never contains step N answers', () => {
		const leaks: [number, string[]][] = [
			[0, ['lograge']],
			[1, ['Json.new']],
			[2, ['custom_payload']],
			[3, ['opentelemetry']],
			[4, ['use_all']],
			[5, ['HealthCheckService', 'SolidQueue::Process']],
		];
		for (const [step, tokens] of leaks) {
			const preview = previewText('build', step - 1);
			for (const token of tokens) {
				expect(
					preview.includes(token),
					`working on step ${step}, preview leaks "${token}"`,
				).toBe(false);
			}
		}
	});

	test('the final health check is real, verified code (no invisible service)', () => {
		const done = previewText('build', STEP_DEFS.length);
		expect(done).toContain('app/services/health_check_service.rb');
		expect(done).toContain('SELECT 1');
		expect(done).toContain('SolidQueue::Process');
		expect(done).toContain('last_heartbeat_at');
		expect(done).toContain('allow_unauthenticated_access');
		expect(done).toContain(':service_unavailable');
	});

	test('the custom payload carries request_id and user_id, nothing invented', () => {
		const done = previewText('build', STEP_DEFS.length);
		expect(done).toContain('custom_payload');
		expect(done).toContain('request_id');
		expect(done).toContain('user_id');
	});
});
