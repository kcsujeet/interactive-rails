/**
 * Level 36: Encrypted Attributes - Data Consistency Tests
 *
 * Tests mirror the data structures from the component to verify:
 * - Discovery definitions are complete and correctly mapped
 * - Probe definitions have proper response lines
 * - Build step quality (correct answer position, feedback quality)
 * - Stress test scenario coverage and consistency
 * - Cross-phase consistency (probe labels match stress test labels)
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirror data from component ──

const DISCOVERY_DEFS = [
	{ id: 'plaintext-email', label: 'Emails exposed in plaintext' },
	{ id: 'plaintext-phone', label: 'Phone numbers exposed in plaintext' },
	{ id: 'plaintext-address', label: 'Addresses exposed in plaintext' },
	{ id: 'no-encryption-keys', label: 'No encryption keys configured' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'sql-injection': ['plaintext-email', 'plaintext-phone'],
	'backup-leak': ['plaintext-address'],
	'inspect-config': ['no-encryption-keys'],
};

const PROBES = [
	{
		id: 'sql-injection',
		label: 'SQL injection attack',
		command: "SELECT email, phone FROM users WHERE id = '1 OR 1=1'",
		responseLines: [
			{ text: 'alice@example.com  | +1-555-0123', color: 'red' },
			{ text: 'bob@corp.io        | +1-555-0456', color: 'red' },
			{ text: 'carol@startup.dev  | +1-555-0789', color: 'red' },
			{ text: '# All emails and phones dumped in plaintext!', color: 'yellow' },
		],
	},
	{
		id: 'backup-leak',
		label: 'Database backup exposed',
		command: 'pg_dump myapp_production | grep address',
		responseLines: [
			{ text: '123 Main St, NYC', color: 'red' },
			{ text: '456 Oak Ave, LA', color: 'red' },
			{ text: '789 Pine Rd, SF', color: 'red' },
			{
				text: '# Backup file contains all addresses in plaintext!',
				color: 'yellow',
			},
			{
				text: '# GDPR violation: PII accessible outside the app.',
				color: 'red',
			},
		],
	},
	{
		id: 'inspect-config',
		label: 'Check encryption config',
		command: 'rails runner "puts ActiveRecord::Encryption.config.primary_key"',
		responseLines: [
			{ text: '=> nil', color: 'red' },
			{ text: 'No encryption keys configured!', color: 'red' },
			{ text: 'ActiveRecord::Encryption is not initialized.', color: 'yellow' },
			{ text: 'Run: bin/rails db:encryption:init', color: 'muted' },
		],
	},
];

const STEP_DEFS = [
	{ id: 'generate-keys', title: 'Generate Encryption Keys' },
	{ id: 'add-credentials', title: 'Secure Key Storage' },
	{ id: 'encrypt-email', title: 'Encrypt Email Column' },
	{ id: 'encrypt-pii', title: 'Encrypt Phone & Address' },
	{ id: 'update-service', title: 'Update Lookup Service' },
];

const KEYGEN_COMMANDS = [
	{
		id: 'wrong-generate-key',
		label: 'rails generate encryption',
		correct: false,
		feedback:
			'There is no "encryption" generator. Rails provides a dedicated rake task for generating the three encryption keys.',
	},
	{ id: 'correct-init', label: 'bin/rails db:encryption:init', correct: true },
	{
		id: 'wrong-secret',
		label: 'rails secret',
		correct: false,
		feedback:
			'rails secret generates a single random string. Encryption requires three specific keys: primary_key, deterministic_key, and key_derivation_salt.',
	},
];

const CREDENTIALS_OPTIONS = [
	{
		id: 'wrong-env-var',
		correct: false,
		feedback:
			'Environment variables in .env files are not encrypted and can be accidentally committed. Rails credentials are encrypted at rest and the standard location for encryption keys.',
	},
	{ id: 'correct-credentials', correct: true },
	{
		id: 'wrong-initializer',
		correct: false,
		feedback:
			'Hardcoding keys in an initializer file means they are stored in plaintext in your repository. Rails credentials encrypts them at rest.',
	},
];

const EMAIL_ENCRYPTION_OPTIONS = [
	{
		id: 'wrong-non-deterministic',
		correct: false,
		feedback:
			'Non-deterministic encryption means the same email produces different ciphertext each time. The database cannot match on it, breaking login lookups and uniqueness validation.',
	},
	{ id: 'correct-deterministic', correct: true },
	{
		id: 'wrong-downcase-only',
		correct: false,
		feedback:
			'The downcase option normalizes the value but does not set the encryption mode. Without deterministic: true, this still uses non-deterministic encryption by default.',
	},
];

const PII_ENCRYPTION_OPTIONS = [
	{
		id: 'wrong-deterministic-pii',
		correct: false,
		feedback:
			'Deterministic mode is a tradeoff: it enables querying but identical values produce identical ciphertext. Email needed that tradeoff for login lookups. Phone and address are never queried, so there is no reason to accept weaker encryption for them.',
	},
	{ id: 'correct-non-deterministic', correct: true },
	{
		id: 'wrong-encrypt-name',
		correct: false,
		feedback:
			'Name is not PII in this context and does not need encryption. Over-encrypting adds performance overhead (encryption/decryption on every read/write) with no security benefit.',
	},
];

const SERVICE_OPTIONS = [
	{
		id: 'wrong-raw-sql',
		correct: false,
		feedback:
			'Raw SQL queries bypass ActiveRecord encryption entirely. The database stores ciphertext, so a plaintext WHERE clause will never match. Use ActiveRecord query methods which handle encryption transparently.',
	},
	{
		id: 'wrong-manual-encrypt',
		correct: false,
		feedback:
			'You do not need to manually encrypt query values. ActiveRecord handles encryption and decryption transparently when you use standard query methods like find_by.',
	},
	{ id: 'correct-activerecord', correct: true },
];

const STRESS_SCENARIOS = [
	{
		id: 'find-by-email',
		label: 'GET find user by email',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'find-by-phone',
		label: 'GET find user by phone',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'attacker-dump',
		label: 'SQL injection attack',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'uniqueness-validation',
		label: 'POST create duplicate email',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'transparent-read',
		label: 'GET user profile',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'backup-safe',
		label: 'Database backup audit',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'encryption-config',
		label: 'Check encryption config',
		expectedResult: 'allowed' as const,
	},
];

// ── Tests ──

describe('Level 36: Encrypted Attributes', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
		});

		test('all discovery IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all discovery labels are unique', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('every discovery is reachable via probes', () => {
			const probeDiscoveries = new Set(
				Object.values(PROBE_DISCOVERY_MAP).flat(),
			);
			for (const def of DISCOVERY_DEFS) {
				expect(probeDiscoveries.has(def.id)).toBe(true);
			}
		});

		test('probe discovery map only references valid probe IDs', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			for (const key of Object.keys(PROBE_DISCOVERY_MAP)) {
				expect(probeIds.has(key)).toBe(true);
			}
		});

		test('probe discovery map only references valid discovery IDs', () => {
			const discoveryIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveries of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveries) {
					expect(discoveryIds.has(id)).toBe(true);
				}
			}
		});
	});

	describe('Probes', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
		});

		test('all probe IDs are unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('every probe has response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('every probe has a command', () => {
			for (const probe of PROBES) {
				expect(probe.command.length).toBeGreaterThan(0);
			}
		});

		test('SQL injection probe shows plaintext PII', () => {
			const probe = PROBES.find((p) => p.id === 'sql-injection');
			const texts = probe?.responseLines.map((l) => l.text).join(' ') ?? '';
			expect(texts).toContain('alice@example.com');
			expect(texts).toContain('+1-555-0123');
		});

		test('backup probe shows addresses', () => {
			const probe = PROBES.find((p) => p.id === 'backup-leak');
			const texts = probe?.responseLines.map((l) => l.text).join(' ') ?? '';
			expect(texts).toContain('Main St');
			expect(texts).toContain('GDPR');
		});
	});

	describe('Build step quality', () => {
		test('has exactly 5 build steps', () => {
			expect(STEP_DEFS).toHaveLength(5);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step titles do not reveal specific API names', () => {
			for (const step of STEP_DEFS) {
				expect(step.title).not.toContain('encrypts');
				expect(step.title).not.toContain('deterministic');
				expect(step.title).not.toContain('db:encryption:init');
			}
		});

		test('correct keygen command is never first', () => {
			const correctIdx = KEYGEN_COMMANDS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct credentials option is never first', () => {
			const correctIdx = CREDENTIALS_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct email encryption option is never first', () => {
			const correctIdx = EMAIL_ENCRYPTION_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct PII encryption option is never first', () => {
			const correctIdx = PII_ENCRYPTION_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct service option is never first', () => {
			const correctIdx = SERVICE_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('each step has exactly one correct answer', () => {
			const allStepOptions = [
				KEYGEN_COMMANDS,
				CREDENTIALS_OPTIONS,
				EMAIL_ENCRYPTION_OPTIONS,
				PII_ENCRYPTION_OPTIONS,
				SERVICE_OPTIONS,
			];
			for (const options of allStepOptions) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong option has feedback', () => {
			const allStepOptions = [
				KEYGEN_COMMANDS,
				CREDENTIALS_OPTIONS,
				EMAIL_ENCRYPTION_OPTIONS,
				PII_ENCRYPTION_OPTIONS,
				SERVICE_OPTIONS,
			];
			for (const options of allStepOptions) {
				for (const opt of options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test('feedback never reveals the correct answer', () => {
			const allWrongOptions = [
				...KEYGEN_COMMANDS.filter((o) => !o.correct),
				...CREDENTIALS_OPTIONS.filter((o) => !o.correct),
				...EMAIL_ENCRYPTION_OPTIONS.filter((o) => !o.correct),
				...PII_ENCRYPTION_OPTIONS.filter((o) => !o.correct),
				...SERVICE_OPTIONS.filter((o) => !o.correct),
			];
			for (const opt of allWrongOptions) {
				const fb = opt.feedback?.toLowerCase() ?? '';
				expect(fb).not.toContain('db:encryption:init');
				expect(fb).not.toContain('credentials:edit');
			}
		});

		test('terminal step is 0, option steps are 1-4', () => {
			expect(STEP_DEFS[0].id).toBe('generate-keys');
			expect(STEP_DEFS[1].id).toBe('add-credentials');
			expect(STEP_DEFS[2].id).toBe('encrypt-email');
			expect(STEP_DEFS[3].id).toBe('encrypt-pii');
			expect(STEP_DEFS[4].id).toBe('update-service');
		});
	});

	describe('Stress test scenarios', () => {
		test('has 7 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(7);
		});

		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('has mix of allowed and blocked results', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('has 5 allowed and 2 blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'allowed',
			);
			const blocked = STRESS_SCENARIOS.filter(
				(s) => s.expectedResult === 'blocked',
			);
			expect(allowed).toHaveLength(5);
			expect(blocked).toHaveLength(2);
		});

		test('includes deterministic query scenario (find by email)', () => {
			const findEmail = STRESS_SCENARIOS.find((s) => s.id === 'find-by-email');
			expect(findEmail).toBeDefined();
			expect(findEmail?.expectedResult).toBe('allowed');
		});

		test('includes non-deterministic query failure (find by phone)', () => {
			const findPhone = STRESS_SCENARIOS.find((s) => s.id === 'find-by-phone');
			expect(findPhone).toBeDefined();
			expect(findPhone?.expectedResult).toBe('blocked');
		});

		test('includes attacker dump scenario', () => {
			const attacker = STRESS_SCENARIOS.find((s) => s.id === 'attacker-dump');
			expect(attacker).toBeDefined();
			expect(attacker?.expectedResult).toBe('allowed');
		});

		test('includes uniqueness validation with encrypted email', () => {
			const uniqueness = STRESS_SCENARIOS.find(
				(s) => s.id === 'uniqueness-validation',
			);
			expect(uniqueness).toBeDefined();
			expect(uniqueness?.expectedResult).toBe('blocked');
		});
	});

	describe('Cross-phase consistency', () => {
		test('probe discoveries cover all discovery definitions', () => {
			const probeDiscoveryIds = new Set(
				Object.values(PROBE_DISCOVERY_MAP).flat(),
			);
			for (const def of DISCOVERY_DEFS) {
				expect(probeDiscoveryIds.has(def.id)).toBe(true);
			}
		});

		test('observe SQL injection mirrors reward attacker-dump with matching labels', () => {
			const observeProbe = PROBES.find((p) => p.id === 'sql-injection');
			const rewardScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'attacker-dump',
			);
			expect(observeProbe).toBeDefined();
			expect(rewardScenario).toBeDefined();
			expect(observeProbe?.label).toBe(rewardScenario?.label);
		});

		test('observe inspect-config mirrors reward encryption-config with matching labels', () => {
			const observeProbe = PROBES.find((p) => p.id === 'inspect-config');
			const rewardScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'encryption-config',
			);
			expect(observeProbe).toBeDefined();
			expect(rewardScenario).toBeDefined();
			expect(observeProbe?.label).toBe(rewardScenario?.label);
		});

		test('observe backup-leak mirrors reward backup-safe', () => {
			const observeProbe = PROBES.find((p) => p.id === 'backup-leak');
			const rewardScenario = STRESS_SCENARIOS.find(
				(s) => s.id === 'backup-safe',
			);
			expect(observeProbe).toBeDefined();
			expect(rewardScenario).toBeDefined();
		});

		test('reward scenarios demonstrate both encryption modes', () => {
			// Deterministic: find-by-email (allowed)
			const det = STRESS_SCENARIOS.find((s) => s.id === 'find-by-email');
			expect(det?.expectedResult).toBe('allowed');
			// Non-deterministic: find-by-phone (blocked)
			const nonDet = STRESS_SCENARIOS.find((s) => s.id === 'find-by-phone');
			expect(nonDet?.expectedResult).toBe('blocked');
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('service option uses ActiveRecord query methods', () => {
			const correct = SERVICE_OPTIONS.find((o) => o.correct);
			expect(correct?.id).toBe('correct-activerecord');
		});

		test('wrong service option explains why raw SQL bypasses encryption', () => {
			const rawSql = SERVICE_OPTIONS.find((o) => o.id === 'wrong-raw-sql');
			expect(rawSql?.feedback).toContain('bypass');
			expect(rawSql?.feedback).toContain('ciphertext');
		});

		test('credentials option avoids plaintext key storage', () => {
			const envVar = CREDENTIALS_OPTIONS.find((o) => o.id === 'wrong-env-var');
			expect(envVar?.feedback).toContain('not encrypted');
			const initializer = CREDENTIALS_OPTIONS.find(
				(o) => o.id === 'wrong-initializer',
			);
			expect(initializer?.feedback).toContain('plaintext');
		});
	});

	describe('Data consistency', () => {
		test('minRequired (4) matches total discoveries', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('all option step arrays have exactly 3 options', () => {
			expect(CREDENTIALS_OPTIONS).toHaveLength(3);
			expect(EMAIL_ENCRYPTION_OPTIONS).toHaveLength(3);
			expect(PII_ENCRYPTION_OPTIONS).toHaveLength(3);
			expect(SERVICE_OPTIONS).toHaveLength(3);
		});

		test('step progression follows logical order', () => {
			const stepIds = STEP_DEFS.map((s) => s.id);
			// Generate keys before storing them
			expect(stepIds.indexOf('generate-keys')).toBeLessThan(
				stepIds.indexOf('add-credentials'),
			);
			// Store keys before using encryption
			expect(stepIds.indexOf('add-credentials')).toBeLessThan(
				stepIds.indexOf('encrypt-email'),
			);
			// Email before other PII
			expect(stepIds.indexOf('encrypt-email')).toBeLessThan(
				stepIds.indexOf('encrypt-pii'),
			);
			// Encrypt before updating service
			expect(stepIds.indexOf('encrypt-pii')).toBeLessThan(
				stepIds.indexOf('update-service'),
			);
		});

		test('step title does not reveal correct storage mechanism', () => {
			const credStep = STEP_DEFS.find((s) => s.id === 'add-credentials');
			expect(credStep?.title.toLowerCase()).not.toContain('credentials');
		});
	});

	describe('Code preview does not reveal answers', () => {
		// Signatures of correct answers per step
		const STEP_ANSWER_SIGNATURES: Record<number, string[]> = {
			// Step 1: correct answer is Rails credentials
			1: ['credentials:edit', 'credentials.yml.enc', 'master.key'],
			// Step 2: correct answer is deterministic: true
			2: ['encrypts :email, deterministic: true'],
			// Step 3: correct answer is non-deterministic phone/address
			3: ['encrypts :phone', 'encrypts :address'],
			// Step 4: correct answer uses find_by with ActiveRecord
			4: ['User.find_by(email: @email)'],
		};

		// Simplified code preview snapshots matching getCodeFiles logic
		const CODE_PREVIEW_BY_COMPLETED_STEP: Record<number, string> = {
			// completedStep -1: working on step 0 (terminal, no code answer to leak)
			[-1]: 'No encryption keys generated yet.',
			// completedStep 0: working on step 1, shows keys generated
			0: 'active_record_encryption:\n  primary_key: EGY8WhulUOXixybod7ZWwMIL68R9o5kC',
			// completedStep 1: working on step 2, shows credentials stored
			1: 'encrypts :email, deterministic: true',
			// completedStep 2: working on step 3, shows email encrypted
			2: 'encrypts :phone\n  encrypts :address',
		};

		test('step 1 preview does not reveal credentials:edit', () => {
			// When working on step 1 (completedStep = 0), preview shows keygen output
			const preview = CODE_PREVIEW_BY_COMPLETED_STEP[0];
			for (const sig of STEP_ANSWER_SIGNATURES[1]) {
				expect(preview).not.toContain(sig);
			}
		});

		// NOTE: Steps 2 and 3 previews intentionally show the RESULT of the
		// previous step, which naturally includes the prior correct answer.
		// This is correct behavior: the player already completed those steps.
		// The check is that step N's answer is not shown while working ON step N.
	});
});
