/**
 * Tests for Level 14: Testing (Customer Impact Dashboard redesign).
 *
 * Per testing.md: mirror data structures from the component, do not import.
 * If the component data drifts, the test still documents the expected shape.
 *
 * Validates:
 * - Probe-to-discovery 1:1 mapping (each probe surfaces exactly one piece of
 *   customer-visible damage; each piece is surfaced by exactly one probe).
 * - Probe-to-scenario coverage (every observe probe has a matching reward
 *   scenario with the same id and label; reward is a superset including the
 *   clean-refactor scenario).
 * - Per-probe damage payloads have at least one of homepage / account /
 *   login set (the customer-impact assertion: probes always paint damage).
 * - Per-probe responseLines and per-scenario responseLines are non-empty.
 * - Reward scenarios all have expectedResult: 'allowed' (rspec catches the
 *   change locally; from the customer's perspective, the result is "I see
 *   nothing wrong").
 * - Build step quality (correct answer never first; wrong-option feedback
 *   never reveals the correct answer; exactly one correct option per step).
 * - Visualization vocabulary: probe and scenario labels, incident-log
 *   entries, and damage descriptions never use future-axis vocabulary
 *   (Editor, Test Runner, Build, Test Gate, Production, Deploy, CI,
 *   staging, PROMOTED, git push, etc.). Customer-domain words are allowed.
 */

import { describe, expect, test } from 'bun:test';

// ─────────────────────────────────────────────
// Mirrored data from Level14Testing.tsx
// ─────────────────────────────────────────────

const PROBE_IDS = [
	'spam-product-on-homepage',
	'product-deleted-by-stranger',
	'login-down-overnight',
] as const;

const PROBE_LABELS: Record<string, string> = {
	'spam-product-on-homepage':
		'A junior dev refactors the controller and drops a security check',
	'product-deleted-by-stranger':
		'A teammate refactors authorize and forgets to put it back',
	'login-down-overnight': 'A migration renames the email column',
};

interface DamageShape {
	homepage?: { spam: true };
	account?: { deletedByStranger: true };
	login?: { serverError: true };
	incidentLog: string[];
}

const PROBE_DAMAGE: Record<string, DamageShape> = {
	'spam-product-on-homepage': {
		homepage: { spam: true },
		incidentLog: [
			'47 customers saw the spam ad before Marketing flagged it.',
			'12 refund requests filed.',
			'3-hour exposure window.',
		],
	},
	'product-deleted-by-stranger': {
		account: { deletedByStranger: true },
		incidentLog: [
			'Alice opened a support ticket: "Where did my product go?"',
			'Trust score down.',
			'Restored manually from a backup.',
		],
	},
	'login-down-overnight': {
		login: { serverError: true },
		incidentLog: [
			'All login attempts failed for 6 hours overnight.',
			'$42K in lost orders.',
			'PagerDuty fired at 2am.',
		],
	},
};

interface ProbeResponseLine {
	text: string;
	color?: string;
}

const PROBE_RESPONSE_LINES: Record<string, ProbeResponseLine[]> = {
	'spam-product-on-homepage': [
		{ text: '$ bundle exec rspec', color: 'cyan' },
		{ text: '# no specs run. nothing flagged this.', color: 'muted' },
	],
	'product-deleted-by-stranger': [
		{ text: '$ bundle exec rspec', color: 'cyan' },
		{ text: '# no specs run. nothing flagged this.', color: 'muted' },
	],
	'login-down-overnight': [
		{ text: '$ bundle exec rspec', color: 'cyan' },
		{ text: '# no specs run. nothing flagged this.', color: 'muted' },
	],
};

// FORBIDDEN_VOCAB scans every player-visible string for vocabulary that
// belongs to later acts (deploy, CI, staging, etc.) or to past failed
// redesigns (Editor, Test Runner, Behavior Coverage, etc.). Customer-domain
// words like "homepage", "account", "login", "Marketing" are explicitly
// allowed because they describe what the player is looking at on the
// dashboard.
const FORBIDDEN_VOCAB = [
	'Editor',
	'Test Runner',
	'Test Gate',
	'Build pipeline',
	'build pipeline',
	'Behavior Coverage',
	'Behavior Card',
	'Deploy',
	'deploy',
	' CI ',
	'staging',
	'Staging',
	'PROMOTED',
	'HIJACKED',
	'git push',
	' BU ',
	' ED ',
	' TR ',
];

const DISCOVERY_IDS = [
	'spam-product-on-homepage',
	'product-deleted-by-stranger',
	'login-down-overnight',
] as const;

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'spam-product-on-homepage': 'spam-product-on-homepage',
	'product-deleted-by-stranger': 'product-deleted-by-stranger',
	'login-down-overnight': 'login-down-overnight',
};

const SCENARIO_IDS = [
	'spam-product-on-homepage',
	'product-deleted-by-stranger',
	'login-down-overnight',
	'helper-rename-clean-refactor',
] as const;

const SCENARIO_RESULTS: Record<string, 'allowed' | 'blocked'> = {
	'spam-product-on-homepage': 'allowed',
	'product-deleted-by-stranger': 'allowed',
	'login-down-overnight': 'allowed',
	'helper-rename-clean-refactor': 'allowed',
};

const SCENARIO_LABELS: Record<string, string> = {
	'spam-product-on-homepage':
		'A junior dev refactors the controller and drops a security check',
	'product-deleted-by-stranger':
		'A teammate refactors authorize and forgets to put it back',
	'login-down-overnight': 'A migration renames the email column',
	'helper-rename-clean-refactor': 'Refactor: rename a private helper method',
};

const SCENARIO_RESPONSE_LINES_NONEMPTY: Record<string, boolean> = {
	'spam-product-on-homepage': true,
	'product-deleted-by-stranger': true,
	'login-down-overnight': true,
	'helper-rename-clean-refactor': true,
};

// Sampled lines from the rspec output animations, used to assert that the
// reward terminal animates real rspec output (not generic placeholders).
const SCENARIO_RESPONSE_KEY_LINES: Record<string, string[]> = {
	'spam-product-on-homepage': [
		'$ bundle exec rspec',
		'1) Api::Products POST /api/products drops featured: true (admin-only field)',
		'6 examples, 1 failure',
	],
	'product-deleted-by-stranger': [
		'$ bundle exec rspec',
		'1) Api::Products PATCH /api/products/:id blocks a non-owner with 404 (Pundit + scoped policy)',
		'6 examples, 1 failure',
	],
	'login-down-overnight': [
		'$ bundle exec rspec',
		'1) Api::Products GET /api/products returns the products visible to the current user',
		'6 examples, 6 failures',
	],
	'helper-rename-clean-refactor': [
		'$ bundle exec rspec',
		'6 examples, 0 failures',
	],
};

interface OptionShape {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// Step 0: Add rspec gem (terminal)
const ADD_RSPEC_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-default-group',
		label: 'bundle add rspec-rails',
		correct: false,
		feedback:
			'bundle add without a group puts the gem in the default group. That ships it to production, where you never run specs, wasted memory and a larger Gemfile.lock for nothing. Pick the option that scopes the gem to the groups where it is actually used.',
	},
	{
		id: 'wrong-test-only',
		label: 'bundle add rspec-rails --group "test"',
		correct: false,
		feedback:
			'Test-only is too narrow. The generator that creates spec files runs in the development environment, so the gem has to be loadable there too. Look for the option that includes both groups.',
	},
	{
		id: 'correct',
		label: 'bundle add rspec-rails --group "development, test"',
		correct: true,
	},
];

// Step 2: Add factory_bot gem (terminal)
const ADD_FACTORY_BOT_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-default-group',
		label: 'bundle add factory_bot_rails',
		correct: false,
		feedback:
			'No --group means the gem lands in the default production group. Factories are only used in specs; shipping them to production is wasted memory.',
	},
	{
		id: 'wrong-plain-factory',
		label: 'bundle add factory_bot --group "development, test"',
		correct: false,
		feedback:
			'That is the plain Ruby variant. The Rails variant auto-discovers spec/factories/*.rb and integrates with the Rails test runner, you would have to wire all of that up by hand otherwise.',
	},
	{
		id: 'correct',
		label: 'bundle add factory_bot_rails --group "development, test"',
		correct: true,
	},
];

// Step 3: Create support file (OptionCard)
const SUPPORT_FILE_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-require',
		label: '# spec/support/factory_bot.rb\nrequire "factory_bot"',
		correct: false,
		feedback:
			'Requiring the gem only loads the library. It does not make the DSL methods available inside RSpec examples.',
	},
	{
		id: 'wrong-wrong-module',
		label:
			'# spec/support/factory_bot.rb\nRSpec.configure do |config|\n  config.include FactoryBot::Methods\nend',
		correct: false,
		feedback:
			'FactoryBot::Methods is not a real module. The DSL methods (create, build, build_stubbed) live inside a Syntax namespace.',
	},
	{
		id: 'correct',
		label:
			'# spec/support/factory_bot.rb\nRSpec.configure do |config|\n  config.include FactoryBot::Syntax::Methods\nend',
		correct: true,
	},
];

// Step 4: Uncomment glob in rails_helper (OptionCard)
const UNCOMMENT_GLOB_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-direct-include',
		label:
			'# spec/rails_helper.rb\nRSpec.configure do |config|\n  config.include FactoryBot::Syntax::Methods\nend',
		correct: false,
		feedback:
			'Putting the include directly in rails_helper.rb works, but it skips the support-file convention every Rails team uses. The next concern (request helpers, time helpers, WebMock) would also have to live in rails_helper.rb until the file is impossible to read.',
	},
	{
		id: 'wrong-spec-helper',
		label:
			'# spec/spec_helper.rb\nrequire_relative "../spec/support/factory_bot"',
		correct: false,
		feedback:
			'spec_helper.rb is the framework-only helper that loads before Rails is booted. Loading FactoryBot from there fails, the gem requires Rails to be loaded first.',
	},
	{
		id: 'correct',
		label:
			'# spec/rails_helper.rb (uncomment the line)\nRails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }',
		correct: true,
	},
];

// Step 5: Write user factory (OptionCard)
const WRITE_FACTORY_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-fixed-email',
		label:
			'FactoryBot.define do\n  factory :user do\n    email_address { "user@example.com" }\n    password { "password123" }\n  end\nend',
		correct: false,
		feedback:
			'The User model validates email_address for uniqueness. Two specs that each create(:user) collide on the second insert and one of them blows up with a validation error. Test data has to be unique per call.',
	},
	{
		id: 'wrong-password-digest',
		label:
			'FactoryBot.define do\n  factory :user do\n    email_address { "user@example.com" }\n    password_digest { "abc123" }\n  end\nend',
		correct: false,
		feedback:
			'password_digest writes the column directly and skips has_secure_password. The hash is not a real BCrypt digest, so authenticate_by always returns nil. Login specs would fail even with a "correct" password.',
	},
	{
		id: 'correct',
		label:
			'FactoryBot.define do\n  factory :user do\n    sequence(:email_address) { |n| "user#{n}@example.com" }\n    password { "password123" }\n  end\nend',
		correct: true,
	},
];

// Step 6: Write request spec (OptionCard)
const WRITE_SPEC_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-controller-spec',
		label:
			'RSpec.describe Api::ProductsController, type: :controller do\n  it "creates a product" do\n    post :create, params: { product: { name: "X", price: 1 } }\n    expect(assigns(:product)).to be_persisted\n  end\nend',
		correct: false,
		feedback:
			'Controller specs poke at internals like assigns() and skip the full request stack: no real authentication, no Pundit, no params filter. They cannot catch any of the regressions you just observed.',
	},
	{
		id: 'wrong-model-only',
		label:
			'RSpec.describe Product, type: :model do\n  it "validates name presence" do\n    expect(build(:product, name: nil)).not_to be_valid\n  end\nend',
		correct: false,
		feedback:
			'Model specs only test the model in isolation. The regressions you saw all happen at the HTTP layer: dropped params filter, missing authorize call, broken column reference. A model spec would have caught none of them.',
	},
	{
		id: 'correct',
		label:
			'RSpec.describe "Api::Products", type: :request do\n  let(:user)       { create(:user) }\n  let(:other_user) { create(:user) }\n  let(:headers) do\n    session = user.sessions.create!(ip_address: "127.0.0.1", user_agent: "rspec")\n    { "Authorization" => "Bearer #{session.token}" }\n  end\n\n  it "drops featured: true on create" do\n    params = { product: { name: "X", description: "d", price: 1, featured: true } }\n    post "/api/products", params: params, headers: headers, as: :json\n    expect(Product.last.featured).to be false\n  end\n\n  it "blocks a non-owner from updating" do\n    product = create(:product, user: other_user, name: "Theirs")\n    patch "/api/products/#{product.id}",\n          params: { product: { name: "Hijacked" } },\n          headers: headers, as: :json\n    expect(response).to have_http_status(:not_found).or have_http_status(:forbidden)\n    expect(product.reload.name).to eq("Theirs")\n  end\nend',
		correct: true,
	},
];

const ALL_STEP_OPTIONS: OptionShape[][] = [
	ADD_RSPEC_OPTIONS,
	ADD_FACTORY_BOT_OPTIONS,
	SUPPORT_FILE_OPTIONS,
	UNCOMMENT_GLOB_OPTIONS,
	WRITE_FACTORY_OPTIONS,
	WRITE_SPEC_OPTIONS,
];

// Distinctive substrings of each step's correct answer that must NOT appear
// in the same step's wrong-option feedback (the answer-leak check).
const CORRECT_ANSWER_KEYWORDS: string[][] = [
	['--group "development, test"', 'rspec-rails --group'],
	['factory_bot_rails --group', '--group "development, test"'],
	['FactoryBot::Syntax::Methods', 'Syntax::Methods'],
	['Rails.root.glob', 'spec/support/**/*.rb'],
	['sequence(:email_address)', 'sequence('],
	['type: :request', '/api/products', 'be false'],
];

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Level 14: Testing: probe / discovery wiring', () => {
	test('every probe has a discovery mapping', () => {
		for (const id of PROBE_IDS) {
			expect(PROBE_DISCOVERY_MAP[id]).toBeDefined();
			expect(DISCOVERY_IDS.includes(PROBE_DISCOVERY_MAP[id] as never)).toBe(
				true,
			);
		}
	});

	test('probe-to-discovery is 1:1 (each probe owns a unique discovery)', () => {
		const mapped = PROBE_IDS.map((id) => PROBE_DISCOVERY_MAP[id]);
		const unique = new Set(mapped);
		expect(unique.size).toBe(PROBE_IDS.length);
	});

	test('every discovery is unlocked by exactly one probe', () => {
		for (const discoveryId of DISCOVERY_IDS) {
			const owners = PROBE_IDS.filter(
				(probeId) => PROBE_DISCOVERY_MAP[probeId] === discoveryId,
			);
			expect(owners.length).toBe(1);
		}
	});

	test('all discovery IDs are mirrored 1:1 with probe IDs', () => {
		expect(DISCOVERY_IDS.length).toBe(PROBE_IDS.length);
		for (const id of PROBE_IDS) {
			expect(DISCOVERY_IDS.includes(id as never)).toBe(true);
		}
	});
});

describe('Level 14: Testing: probe damage payloads', () => {
	test('every probe has a damage payload', () => {
		for (const id of PROBE_IDS) {
			expect(PROBE_DAMAGE[id]).toBeDefined();
		}
	});

	test('every probe damages at least one customer-facing surface', () => {
		for (const id of PROBE_IDS) {
			const damage = PROBE_DAMAGE[id];
			const hasSurface = !!(damage.homepage || damage.account || damage.login);
			expect(hasSurface).toBe(true);
		}
	});

	test('every probe has a non-empty incident log', () => {
		for (const id of PROBE_IDS) {
			const damage = PROBE_DAMAGE[id];
			expect(damage.incidentLog.length).toBeGreaterThan(0);
		}
	});

	test('homepage-spam probe targets the homepage surface', () => {
		expect(PROBE_DAMAGE['spam-product-on-homepage'].homepage).toBeDefined();
		expect(PROBE_DAMAGE['spam-product-on-homepage'].account).toBeUndefined();
		expect(PROBE_DAMAGE['spam-product-on-homepage'].login).toBeUndefined();
	});

	test('account-deletion probe targets the account surface', () => {
		expect(PROBE_DAMAGE['product-deleted-by-stranger'].account).toBeDefined();
		expect(
			PROBE_DAMAGE['product-deleted-by-stranger'].homepage,
		).toBeUndefined();
		expect(PROBE_DAMAGE['product-deleted-by-stranger'].login).toBeUndefined();
	});

	test('login-down probe targets the login surface', () => {
		expect(PROBE_DAMAGE['login-down-overnight'].login).toBeDefined();
		expect(PROBE_DAMAGE['login-down-overnight'].homepage).toBeUndefined();
		expect(PROBE_DAMAGE['login-down-overnight'].account).toBeUndefined();
	});

	test('every probe damages exactly one surface (1:1 with the dashboard sections)', () => {
		for (const id of PROBE_IDS) {
			const damage = PROBE_DAMAGE[id];
			const surfaceCount = [
				damage.homepage,
				damage.account,
				damage.login,
			].filter((s) => s !== undefined).length;
			expect(surfaceCount).toBe(1);
		}
	});

	test('incident-log entries name a customer-visible cost (refunds, support tickets, lost orders, exposure window)', () => {
		const allEntries = PROBE_IDS.flatMap((id) => PROBE_DAMAGE[id].incidentLog);
		const joined = allEntries.join(' ').toLowerCase();
		expect(joined).toContain('refund');
		expect(joined).toContain('support ticket');
		expect(joined).toContain('lost orders');
	});
});

describe('Level 14: Testing: probe response lines (observe terminal)', () => {
	test('every probe has non-empty responseLines', () => {
		for (const id of PROBE_IDS) {
			expect(PROBE_RESPONSE_LINES[id]).toBeDefined();
			expect(PROBE_RESPONSE_LINES[id].length).toBeGreaterThan(0);
		}
	});

	test('the observe-phase rspec terminal stays quiet (no specs run)', () => {
		for (const id of PROBE_IDS) {
			const lines = PROBE_RESPONSE_LINES[id];
			const joined = lines.map((l) => l.text).join('\n');
			expect(joined).toContain('no specs run');
		}
	});
});

describe('Level 14: Testing: probe / scenario coverage', () => {
	test('every observe probe has a matching reward scenario', () => {
		for (const probeId of PROBE_IDS) {
			expect(SCENARIO_IDS.includes(probeId as never)).toBe(true);
		}
	});

	test('every paired regression scenario label exactly matches its probe label', () => {
		for (const probeId of PROBE_IDS) {
			expect(SCENARIO_LABELS[probeId]).toBe(PROBE_LABELS[probeId]);
		}
	});

	test('reward is a superset of observe (probes + clean refactor)', () => {
		expect(SCENARIO_IDS.length - PROBE_IDS.length).toBe(1);
	});

	test('all scenarios have expectedResult: allowed (rspec catches; customer sees nothing wrong)', () => {
		for (const id of SCENARIO_IDS) {
			expect(SCENARIO_RESULTS[id]).toBe('allowed');
		}
	});

	test('all scenario IDs are unique', () => {
		const unique = new Set(SCENARIO_IDS);
		expect(unique.size).toBe(SCENARIO_IDS.length);
	});

	test('all scenario labels are unique', () => {
		const labels = Object.values(SCENARIO_LABELS);
		const unique = new Set(labels);
		expect(unique.size).toBe(labels.length);
	});
});

describe('Level 14: Testing: scenario response lines (rspec terminal)', () => {
	test('every scenario has non-empty responseLines', () => {
		for (const id of SCENARIO_IDS) {
			expect(SCENARIO_RESPONSE_LINES_NONEMPTY[id]).toBe(true);
		}
	});

	test('regression scenarios animate the actual rspec failure naming the failing it "..."', () => {
		expect(SCENARIO_RESPONSE_KEY_LINES['spam-product-on-homepage']).toContain(
			'1) Api::Products POST /api/products drops featured: true (admin-only field)',
		);
		expect(
			SCENARIO_RESPONSE_KEY_LINES['product-deleted-by-stranger'],
		).toContain(
			'1) Api::Products PATCH /api/products/:id blocks a non-owner with 404 (Pundit + scoped policy)',
		);
		expect(SCENARIO_RESPONSE_KEY_LINES['login-down-overnight']).toContain(
			'1) Api::Products GET /api/products returns the products visible to the current user',
		);
	});

	test('regression scenarios end with "1 failure" (or 6 for the column rename)', () => {
		expect(SCENARIO_RESPONSE_KEY_LINES['spam-product-on-homepage']).toContain(
			'6 examples, 1 failure',
		);
		expect(
			SCENARIO_RESPONSE_KEY_LINES['product-deleted-by-stranger'],
		).toContain('6 examples, 1 failure');
		expect(SCENARIO_RESPONSE_KEY_LINES['login-down-overnight']).toContain(
			'6 examples, 6 failures',
		);
	});

	test('the clean-refactor scenario reports 0 failures', () => {
		expect(
			SCENARIO_RESPONSE_KEY_LINES['helper-rename-clean-refactor'],
		).toContain('6 examples, 0 failures');
	});
});

describe('Level 14: Testing: build step quality', () => {
	test('every step has exactly one correct option', () => {
		for (const options of ALL_STEP_OPTIONS) {
			const correctCount = options.filter((o) => o.correct).length;
			expect(correctCount).toBe(1);
		}
	});

	test('every wrong option has feedback', () => {
		for (const options of ALL_STEP_OPTIONS) {
			for (const option of options) {
				if (!option.correct) {
					expect(option.feedback).toBeDefined();
					expect(option.feedback?.length ?? 0).toBeGreaterThan(0);
				}
			}
		}
	});

	test('wrong-option feedback never names the correct answer', () => {
		ALL_STEP_OPTIONS.forEach((options, stepIndex) => {
			const keywords = CORRECT_ANSWER_KEYWORDS[stepIndex];
			for (const option of options) {
				if (!option.correct && option.feedback) {
					for (const keyword of keywords) {
						expect(option.feedback).not.toContain(keyword);
					}
				}
			}
		});
	});

	test('option IDs are unique within each step', () => {
		for (const options of ALL_STEP_OPTIONS) {
			const ids = options.map((o) => o.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	test('option labels are unique within each step', () => {
		for (const options of ALL_STEP_OPTIONS) {
			const labels = options.map((o) => o.label);
			expect(new Set(labels).size).toBe(labels.length);
		}
	});
});

describe('Level 14: Testing: narrative consistency with myapp level-14', () => {
	test('rspec gem add correct command uses --group "development, test"', () => {
		const correct = ADD_RSPEC_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('rspec-rails');
		expect(correct?.label).toContain('--group "development, test"');
	});

	test('factory_bot gem add correct command uses --group "development, test" and the rails variant', () => {
		const correct = ADD_FACTORY_BOT_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('factory_bot_rails');
		expect(correct?.label).toContain('--group "development, test"');
		expect(correct?.label).not.toMatch(/^bundle add factory_bot --/);
	});

	test('support file uses FactoryBot::Syntax::Methods', () => {
		const correct = SUPPORT_FILE_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('FactoryBot::Syntax::Methods');
		expect(correct?.label).toContain('spec/support/factory_bot.rb');
	});

	test('rails_helper uses the autoload glob for spec/support', () => {
		const correct = UNCOMMENT_GLOB_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('Rails.root.glob');
		expect(correct?.label).toContain('spec/support/**/*.rb');
	});

	test('user factory uses sequence(:email_address) and password (not password_digest, not Faker)', () => {
		const correct = WRITE_FACTORY_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('sequence(:email_address)');
		expect(correct?.label).toContain('password { "password123" }');
		expect(correct?.label).not.toContain('Faker');
		expect(correct?.label).not.toContain('password_digest');
	});

	test('request spec covers Api::Products end-to-end (not /api/sessions, not email field)', () => {
		const correct = WRITE_SPEC_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('"Api::Products"');
		expect(correct?.label).toContain('type: :request');
		expect(correct?.label).toContain('/api/products');
		expect(correct?.label).toContain('featured: true');
		expect(correct?.label).toContain('Product.last.featured');
		expect(correct?.label).toContain('not_found');
		expect(correct?.label).not.toContain('/api/sessions');
		// Single-key 'email:' usage (e.g. params { email: ... }) is forbidden;
		// the column is `email_address`. Checking for the trailing space
		// avoids matching the legitimate string "email_address".
		expect(correct?.label).not.toMatch(/[^_]email:\s/);
	});
});

describe('Level 14: Testing: visualization vocabulary (curriculum state)', () => {
	test('every probe label uses customer-impact language, not editor / runner / deploy / CI', () => {
		for (const probeId of PROBE_IDS) {
			const label = PROBE_LABELS[probeId];
			expect(label).toBeDefined();
			for (const forbidden of FORBIDDEN_VOCAB) {
				expect(label).not.toContain(forbidden);
			}
		}
	});

	test('every scenario label uses customer-impact language, not editor / runner / deploy / CI', () => {
		for (const id of Object.keys(SCENARIO_LABELS)) {
			const label = SCENARIO_LABELS[id];
			expect(label).toBeDefined();
			for (const forbidden of FORBIDDEN_VOCAB) {
				expect(label).not.toContain(forbidden);
			}
		}
	});

	test('incident-log entries use plain customer-domain language only', () => {
		const allEntries = PROBE_IDS.flatMap((id) => PROBE_DAMAGE[id].incidentLog);
		for (const entry of allEntries) {
			for (const forbidden of FORBIDDEN_VOCAB) {
				expect(entry).not.toContain(forbidden);
			}
		}
	});

	test('discovery IDs describe customer-visible damage, not pipeline stages or tools', () => {
		expect(DISCOVERY_IDS).toContain('spam-product-on-homepage');
		expect(DISCOVERY_IDS).toContain('product-deleted-by-stranger');
		expect(DISCOVERY_IDS).toContain('login-down-overnight');
		// Forbidden IDs from previous failed redesigns:
		expect(DISCOVERY_IDS as readonly string[]).not.toContain('editor');
		expect(DISCOVERY_IDS as readonly string[]).not.toContain('runner');
		expect(DISCOVERY_IDS as readonly string[]).not.toContain('admin-fields');
		expect(DISCOVERY_IDS as readonly string[]).not.toContain('owner-only');
		expect(DISCOVERY_IDS as readonly string[]).not.toContain(
			'encrypted-contact',
		);
	});
});
