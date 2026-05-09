/**
 * Tests for Level 9: Authentication.
 *
 * Type 4 (PipelineFlow + probes): observe phase fires API probes against
 * an unprotected pipeline, build phase scaffolds Rails 8 auth, reward
 * phase stress-tests authenticated vs anonymous requests.
 *
 * Per testing.md: mirror data structures from the component, do not
 * import.
 *
 * Validates:
 * - Discovery gating requires every discovery (minRequired = all).
 * - Probe-to-discovery is 1:1 (each probe owns a unique discovery).
 * - Probe-to-scenario coverage: every observe probe id+label appears as
 *   a stress scenario id+label.
 * - Reward has a mix of allowed and blocked scenarios.
 * - Build step quality across both terminal and OptionCard steps:
 *   exactly one correct option; wrong feedback substantive; wrong
 *   feedback never reveals the correct answer; ids and labels unique.
 * - Canonical answers reflect Rails 8 conventions (built-in auth
 *   generator, has_secure_password, server-side sessions, before_action
 *   :require_authentication).
 */

import { describe, expect, test } from 'bun:test';

// ─────────────────────────────────────────────
// Mirrored data from Level9Authentication.tsx
// ─────────────────────────────────────────────

const DISCOVERY_IDS = [
	'no-auth-layer',
	'anonymous-delete',
	'anonymous-create',
	'no-user-identity',
] as const;

const PROBE_IDS = [
	'delete-no-token',
	'create-no-token',
	'check-identity',
] as const;

const PROBE_LABELS: Record<string, string> = {
	'delete-no-token': 'DELETE without token',
	'create-no-token': 'POST without token',
	'check-identity': 'Check current_user',
};

// Probe stories (mirrored). Used to enforce the "every probe has 3-6
// substantive story bullets" pedagogy rule.
const PROBE_STORIES: Record<string, string[]> = {
	'delete-no-token': [
		'An anonymous visitor sends a DELETE request to the products API.',
		'No Authorization header is included in the request.',
		'The controller does not check for a session or token.',
		'Product #1 is permanently destroyed. No identity was ever verified.',
	],
	'create-no-token': [
		'A bot sends a POST request to create a new product.',
		'No login session or API token is attached to the request.',
		'The controller saves the product with user_id: null.',
		'A spam product now exists in the database with no traceable seller.',
	],
	'check-identity': [
		'A logged-in user calls the /me endpoint to check their identity.',
		'The controller has no way to look up the current session.',
		'current_user returns null for every request.',
		'The app treats every visitor as the same anonymous entity.',
	],
};

// Probe -> discovery (must be 1:1 per pedagogy.md).
// Note: `no-auth-layer` is unlocked by clicking the auth stage inspector,
// not by a probe — so it is intentionally NOT in this map. The 1:1
// invariant we test is over the probes, not over all discoveries.
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'delete-no-token': 'anonymous-delete',
	'create-no-token': 'anonymous-create',
	'check-identity': 'no-user-identity',
};

// Stage -> discovery (mirrored). Used to verify the union of probe and
// stage discoveries covers every discovery exactly once.
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	auth: 'no-auth-layer',
};

const SCENARIO_IDS = [
	'valid-get',
	'valid-create',
	'delete-no-token',
	'create-no-token',
	'check-identity',
	'expired-token',
	'valid-delete',
] as const;

const SCENARIO_LABELS: Record<string, string> = {
	'valid-get': 'GET with valid token',
	'valid-create': 'POST with valid token',
	'delete-no-token': 'DELETE without token',
	'create-no-token': 'POST without token',
	'check-identity': 'Check current_user',
	'expired-token': 'PATCH with expired token',
	'valid-delete': 'DELETE with valid token',
};

const SCENARIO_RESULTS: Record<string, 'allowed' | 'blocked'> = {
	'valid-get': 'allowed',
	'valid-create': 'allowed',
	'delete-no-token': 'blocked',
	'create-no-token': 'blocked',
	'check-identity': 'blocked',
	'expired-token': 'blocked',
	'valid-delete': 'allowed',
};

// ─────────────────────────────────────────────
// Build steps
// ─────────────────────────────────────────────

interface OptionShape {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const GENERATE_AUTH_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-devise',
		label: 'rails generate devise:install',
		correct: false,
		feedback:
			'Devise is a third-party gem. Rails 8 ships its own authentication generator built-in.',
	},
	{
		id: 'correct',
		label: 'bin/rails generate authentication',
		correct: true,
	},
	{
		id: 'wrong-scaffold',
		label: 'rails generate scaffold User email password',
		correct: false,
		feedback:
			'That creates a full CRUD scaffold with plaintext password. Authentication needs secure password hashing, not a string column.',
	},
];

const RUN_MIGRATIONS_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		correct: false,
		feedback:
			'Seeds populate data, but the tables do not exist yet. The generator created migration files that need to run first.',
	},
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		correct: false,
		feedback:
			'db:setup creates the database from schema.rb. You already have a database. You need to run the new migration files the generator just created.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		correct: true,
	},
];

const PASSWORD_OPTIONS: OptionShape[] = [
	{
		id: 'devise',
		label: "gem 'devise'",
		correct: false,
		feedback:
			"Devise is powerful but adds complexity. Rails 8 has built-in auth. Use the framework's own tools first.",
	},
	{
		id: 'manual-bcrypt',
		label: 'BCrypt::Password.create(password)',
		correct: false,
		feedback:
			'Manual bcrypt calls are error-prone. Rails wraps this in a single declarative method on the model.',
	},
	{
		id: 'has-secure-password',
		label: 'has_secure_password',
		correct: true,
	},
];

const CREATE_SESSION_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-cookie',
		label: 'cookies[:user_id] = user.id',
		correct: false,
		feedback:
			'API-only Rails apps do not include cookie middleware by default. Even if they did, an API needs a token the client can attach to subsequent requests.',
	},
	{
		id: 'correct',
		label: 'session = user.sessions.create!',
		correct: true,
	},
	{
		id: 'wrong-jwt',
		label: 'JWT.encode({ user_id: user.id }, secret)',
		correct: false,
		feedback:
			'JWTs are stateless and hard to revoke. Rails 8 auth uses server-side sessions stored in the database.',
	},
];

const PROTECT_OPTIONS: OptionShape[] = [
	{
		id: 'devise-method',
		label: 'authenticate_user!',
		correct: false,
		feedback:
			"That's a Devise method. Rails 8's built-in auth concern uses a different callback name.",
	},
	{
		id: 'manual-check',
		label: 'if current_user.nil? then head :unauthorized end',
		correct: false,
		feedback:
			'Manual nil checks in every action are repetitive. Use a before_action to protect all endpoints at once.',
	},
	{
		id: 'before-action',
		label: 'before_action :require_authentication',
		correct: true,
	},
];

const ALL_STEPS: { name: string; options: OptionShape[] }[] = [
	{ name: 'generate-auth', options: GENERATE_AUTH_OPTIONS },
	{ name: 'run-migrations', options: RUN_MIGRATIONS_OPTIONS },
	{ name: 'password-strategy', options: PASSWORD_OPTIONS },
	{ name: 'create-session', options: CREATE_SESSION_OPTIONS },
	{ name: 'protect-endpoint', options: PROTECT_OPTIONS },
];

// Distinctive substrings of each step's correct answer that must NOT
// appear in the same step's wrong-option feedback.
const CORRECT_ANSWER_KEYWORDS: Record<string, string[]> = {
	'generate-auth': [
		'bin/rails generate authentication',
		'generate authentication',
	],
	'run-migrations': ['db:migrate', 'rails db:migrate'],
	'password-strategy': ['has_secure_password'],
	'create-session': ['user.sessions.create', 'sessions.create!'],
	'protect-endpoint': [
		'before_action :require_authentication',
		':require_authentication',
		'require_authentication',
	],
};

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Level 9: Authentication — discovery / probe wiring', () => {
	test('every probe maps to a known discovery', () => {
		for (const probeId of PROBE_IDS) {
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			expect(discoveryId, `${probeId}: has discovery mapping`).toBeDefined();
			expect(
				DISCOVERY_IDS.includes(discoveryId as never),
				`${probeId}: maps to a known discovery`,
			).toBe(true);
		}
	});

	test('probe-to-discovery is 1:1 (each probe owns a unique discovery)', () => {
		const mapped = PROBE_IDS.map((id) => PROBE_DISCOVERY_MAP[id]);
		expect(new Set(mapped).size).toBe(PROBE_IDS.length);
	});

	test('every discovery is unlocked by exactly one source (probe or stage)', () => {
		for (const discoveryId of DISCOVERY_IDS) {
			const probeOwners = PROBE_IDS.filter(
				(probeId) => PROBE_DISCOVERY_MAP[probeId] === discoveryId,
			);
			const stageOwners = Object.entries(STAGE_DISCOVERY_MAP)
				.filter(([, d]) => d === discoveryId)
				.map(([s]) => s);
			const totalOwners = probeOwners.length + stageOwners.length;
			expect(
				totalOwners,
				`discovery "${discoveryId}" must be unlocked by exactly one source ` +
					`(found ${probeOwners.length} probe(s) + ${stageOwners.length} stage(s))`,
			).toBe(1);
		}
	});

	test('every probe has 3-6 substantive story bullets', () => {
		for (const probeId of PROBE_IDS) {
			const story = PROBE_STORIES[probeId];
			expect(story, `${probeId}: story present`).toBeDefined();
			expect(story.length, `${probeId}: 3-6 bullets`).toBeGreaterThanOrEqual(3);
			expect(story.length, `${probeId}: 3-6 bullets`).toBeLessThanOrEqual(6);
			for (const [idx, bullet] of story.entries()) {
				expect(
					bullet.length,
					`${probeId} story[${idx}] needs 20+ chars`,
				).toBeGreaterThanOrEqual(20);
			}
		}
	});
});

describe('Level 9: Authentication — probe / scenario coverage', () => {
	test('every observe probe id appears as a reward scenario id', () => {
		for (const probeId of PROBE_IDS) {
			expect(
				SCENARIO_IDS.includes(probeId as never),
				`probe "${probeId}" missing as scenario`,
			).toBe(true);
		}
	});

	test('every probe label matches its scenario label', () => {
		for (const probeId of PROBE_IDS) {
			expect(SCENARIO_LABELS[probeId], `${probeId}: scenario label`).toBe(
				PROBE_LABELS[probeId],
			);
		}
	});

	test('reward is a superset of observe', () => {
		expect(SCENARIO_IDS.length).toBeGreaterThanOrEqual(PROBE_IDS.length);
	});

	test('every probe scenario is blocked in the reward phase', () => {
		for (const probeId of PROBE_IDS) {
			expect(SCENARIO_RESULTS[probeId], `${probeId}: blocked after fix`).toBe(
				'blocked',
			);
		}
	});

	test('reward has a mix of allowed and blocked', () => {
		const results = Object.values(SCENARIO_RESULTS);
		expect(results.includes('allowed')).toBe(true);
		expect(results.includes('blocked')).toBe(true);
	});

	test('all scenario IDs are unique', () => {
		expect(new Set(SCENARIO_IDS).size).toBe(SCENARIO_IDS.length);
	});

	test('all scenario labels are unique', () => {
		const labels = Object.values(SCENARIO_LABELS);
		expect(new Set(labels).size).toBe(labels.length);
	});
});

describe('Level 9: Authentication — build step quality', () => {
	test('every step has exactly one correct option', () => {
		for (const { name, options } of ALL_STEPS) {
			const correctCount = options.filter((o) => o.correct).length;
			expect(correctCount, `${name}: correct count`).toBe(1);
		}
	});

	test('every wrong option has substantive feedback', () => {
		for (const { name, options } of ALL_STEPS) {
			for (const option of options) {
				if (!option.correct) {
					expect(
						option.feedback,
						`${name}/${option.id}: feedback present`,
					).toBeDefined();
					expect(
						option.feedback?.length ?? 0,
						`${name}/${option.id}: feedback length`,
					).toBeGreaterThan(20);
				}
			}
		}
	});

	test('wrong-option feedback never names the correct answer', () => {
		for (const { name, options } of ALL_STEPS) {
			const keywords = CORRECT_ANSWER_KEYWORDS[name] ?? [];
			for (const option of options) {
				if (!option.correct && option.feedback) {
					for (const keyword of keywords) {
						expect(
							option.feedback,
							`${name}/${option.id}: feedback leaks "${keyword}"`,
						).not.toContain(keyword);
					}
				}
			}
		}
	});

	test('option IDs are unique within each step', () => {
		for (const { name, options } of ALL_STEPS) {
			const ids = options.map((o) => o.id);
			expect(new Set(ids).size, `${name}: id uniqueness`).toBe(ids.length);
		}
	});

	test('option labels are unique within each step', () => {
		for (const { name, options } of ALL_STEPS) {
			const labels = options.map((o) => o.label);
			expect(new Set(labels).size, `${name}: label uniqueness`).toBe(
				labels.length,
			);
		}
	});
});

describe('Level 9: Authentication — narrative consistency', () => {
	test('generate-auth uses the Rails 8 built-in generator', () => {
		const correct = GENERATE_AUTH_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('bin/rails generate authentication');
		expect(correct?.label).not.toContain('devise');
		expect(correct?.label).not.toContain('scaffold');
	});

	test('run-migrations uses db:migrate (not db:setup or db:seed)', () => {
		const correct = RUN_MIGRATIONS_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('rails db:migrate');
	});

	test('password-strategy uses has_secure_password (Rails-native bcrypt)', () => {
		const correct = PASSWORD_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('has_secure_password');
		// Must not be Devise or manual bcrypt; framework-first.
		expect(correct?.label).not.toContain('devise');
		expect(correct?.label).not.toContain('BCrypt::Password');
	});

	test('create-session uses server-side sessions (not cookies or JWT)', () => {
		const correct = CREATE_SESSION_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('session = user.sessions.create!');
		expect(correct?.label).not.toContain('cookies[');
		expect(correct?.label).not.toContain('JWT');
	});

	test('protect-endpoint uses before_action :require_authentication', () => {
		const correct = PROTECT_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('before_action :require_authentication');
		// Must not be Devise's authenticate_user! or a manual nil-check.
		expect(correct?.label).not.toContain('authenticate_user!');
		expect(correct?.label).not.toContain('current_user.nil?');
	});
});
