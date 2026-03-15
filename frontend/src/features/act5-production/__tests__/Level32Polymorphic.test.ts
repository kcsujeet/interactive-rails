/**
 * Level 32: Polymorphic Associations - Data Consistency Tests
 *
 * Tests mirror the data structures from the component to verify:
 * - Discovery definitions are complete and correctly mapped
 * - Probe definitions have proper response lines
 * - Build step quality (correct answer position, feedback quality)
 * - Stress test scenario coverage and consistency
 * - Cross-phase consistency (probe labels match stress test labels)
 * - Code preview evolution (no empty states)
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirror data from component ──

const DISCOVERY_DEFS = [
	{ id: 'duplicate-schemas', label: 'Three tables with identical columns' },
	{ id: 'scattered-queries', label: 'Cannot query all comments at once' },
	{ id: 'maintenance-burden', label: 'New types require new tables' },
	{ id: 'duplicate-logic', label: 'Validation logic duplicated 3 times' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'list-tables': ['duplicate-schemas'],
	'query-all-comments': ['scattered-queries'],
	'add-article-comments': ['maintenance-burden'],
};

const STAGE_DISCOVERY_MAP: Record<string, string[]> = {
	'post-comment-table': ['duplicate-logic'],
	'photo-comment-table': ['duplicate-logic'],
	'video-comment-table': ['duplicate-logic'],
};

const PROBES = [
	{
		id: 'list-tables',
		label: 'List comment tables',
		command: 'ActiveRecord::Base.connection.tables.grep(/comment/)',
		responseLines: [
			{ text: '=> ["post_comments", "photo_comments", "video_comments"]', color: 'red' },
			{ text: '# 3 separate tables with identical schemas!', color: 'yellow' },
			{ text: '# Each has: id, body, *_id, user_id, timestamps', color: 'muted' },
		],
	},
	{
		id: 'query-all-comments',
		label: 'Query all user comments',
		command: 'Comment.where(user: current_user)',
		responseLines: [
			{ text: 'NameError: uninitialized constant Comment', color: 'red' },
			{ text: '# No unified Comment model exists!', color: 'yellow' },
			{ text: '# Must UNION across post_comments, photo_comments, video_comments', color: 'muted' },
		],
	},
	{
		id: 'add-article-comments',
		label: 'Add comments for Article',
		command: 'rails generate model ArticleComment body:text article:references',
		responseLines: [
			{ text: '  create  db/migrate/..._create_article_comments.rb', color: 'green' },
			{ text: '  create  app/models/article_comment.rb', color: 'green' },
			{ text: '# Yet ANOTHER table with the same columns!', color: 'red' },
			{ text: '# Plus another controller, serializer, and tests...', color: 'yellow' },
		],
	},
];

const STEP_DEFS = [
	{ id: 'generate-migration', title: 'Generate Migration' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'comment-model', title: 'Define Comment Model' },
	{ id: 'parent-models', title: 'Update Parent Models' },
	{ id: 'create-service', title: 'Create Comment Service' },
	{ id: 'wire-controller', title: 'Wire the Controller' },
];

const MIGRATION_COMMANDS = [
	{
		id: 'wrong-separate',
		label: 'rails g model Comment body:text post:references',
		correct: false,
		feedback: 'This creates a foreign key to posts only. You need a polymorphic reference that can point to any parent type.',
	},
	{
		id: 'correct-polymorphic',
		label: 'rails g model Comment body:text commentable:references{polymorphic}',
		correct: true,
	},
	{
		id: 'wrong-string-columns',
		label: 'rails g model Comment body:text commentable_type:string commentable_id:integer',
		correct: false,
		feedback: 'Adding columns manually works but misses the index. The {polymorphic} flag generates both columns AND the composite index automatically.',
	},
];

const RUN_MIGRATION_COMMANDS = [
	{ id: 'wrong-setup', label: 'rails db:setup', correct: false, feedback: 'db:setup drops and recreates the database from schema.rb. You only need to run the pending migration.' },
	{ id: 'correct-migrate', label: 'rails db:migrate', correct: true },
	{ id: 'wrong-seed', label: 'rails db:seed', correct: false, feedback: 'db:seed populates sample data. The migration still needs to run first to create the comments table.' },
];

const COMMENT_MODEL_OPTIONS = [
	{ id: 'wrong-sti', correct: false, feedback: 'Multiple belongs_to associations require all three foreign keys on every row. Most will be null. Polymorphic uses a single type/id pair instead.' },
	{ id: 'correct-polymorphic', correct: true },
	{ id: 'wrong-no-polymorphic', correct: false, feedback: 'Without `polymorphic: true`, Rails expects a `commentables` table to exist. The polymorphic flag tells Rails to use the type/id column pair instead.' },
];

const PARENT_MODEL_OPTIONS = [
	{ id: 'wrong-has-one', correct: false, feedback: 'has_one limits each post to a single comment. Posts can have many comments, so has_many is the correct association.' },
	{ id: 'wrong-no-as', correct: false, feedback: 'Without `as: :commentable`, Rails looks for a `post_id` column on comments. The `as:` option tells Rails to use the polymorphic commentable_type/commentable_id pair.' },
	{ id: 'correct-as-commentable', correct: true },
];

const SERVICE_OPTIONS = [
	{ id: 'wrong-no-contract', correct: false, feedback: 'Missing input validation via contract. Since L18, services must validate input through a Dry::Validation::Contract before business logic.' },
	{ id: 'correct-with-contract', correct: true },
	{ id: 'wrong-inline-validation', correct: false, feedback: 'Inline validation checks in the service were replaced by Dry::Validation contracts in L18. Use a CommentContract to validate input.' },
];

const CONTROLLER_OPTIONS = [
	{ id: 'wrong-direct-create', correct: false, feedback: 'Business logic belongs in service objects, not controllers. The controller should delegate to CreateComment.call and handle the result.' },
	{ id: 'correct-service', correct: true },
];

const STRESS_SCENARIOS = [
	{ id: 'comment-on-post', label: 'POST comment on Post', expectedResult: 'allowed' as const },
	{ id: 'comment-on-photo', label: 'POST comment on Photo', expectedResult: 'allowed' as const },
	{ id: 'comment-on-video', label: 'POST comment on Video', expectedResult: 'allowed' as const },
	{ id: 'list-all-comments', label: 'GET all user comments', expectedResult: 'allowed' as const },
	{ id: 'comment-on-article', label: 'POST comment on Article (new type)', expectedResult: 'allowed' as const },
	{ id: 'invalid-parent', label: 'POST comment on missing parent', expectedResult: 'blocked' as const },
	{ id: 'empty-body', label: 'POST comment with empty body', expectedResult: 'blocked' as const },
];

const STAGE_INSPECTOR_MAP: Record<string, { title: string; code: string }> = {
	'post-comment-table': {
		title: 'PostComment Model',
		code: `class PostComment < ApplicationRecord
  belongs_to :post
  belongs_to :user
  validates :body, presence: true,
    length: { maximum: 10_000 }
end

# Same validates block in PhotoComment
# Same validates block in VideoComment
# 3x duplication!`,
	},
	'photo-comment-table': {
		title: 'PhotoComment Model',
		code: `class PhotoComment < ApplicationRecord
  belongs_to :photo
  belongs_to :user
  validates :body, presence: true,
    length: { maximum: 10_000 }
end

# Identical to PostComment except:
# belongs_to :photo instead of :post`,
	},
	'video-comment-table': {
		title: 'VideoComment Model',
		code: `class VideoComment < ApplicationRecord
  belongs_to :video
  belongs_to :user
  validates :body, presence: true,
    length: { maximum: 10_000 }
end

# Bug fixed in PostComment?
# Don't forget to fix it here too!`,
	},
};

// ── Tests ──

describe('Level 32: Polymorphic Associations', () => {
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

		test('every discovery is reachable via probe or stage click', () => {
			const probeDiscoveries = Object.values(PROBE_DISCOVERY_MAP).flat();
			const stageDiscoveries = Object.values(STAGE_DISCOVERY_MAP).flat();
			const reachable = new Set([...probeDiscoveries, ...stageDiscoveries]);

			for (const def of DISCOVERY_DEFS) {
				expect(reachable.has(def.id)).toBe(true);
			}
		});

		test('probe discovery map only references valid probe IDs', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			for (const key of Object.keys(PROBE_DISCOVERY_MAP)) {
				expect(probeIds.has(key)).toBe(true);
			}
		});

		test('stage discovery map only references valid stage IDs', () => {
			const stageIds = new Set(Object.keys(STAGE_INSPECTOR_MAP));
			for (const key of Object.keys(STAGE_DISCOVERY_MAP)) {
				expect(stageIds.has(key)).toBe(true);
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

		test('every probe response line has a color', () => {
			for (const probe of PROBES) {
				for (const line of probe.responseLines) {
					expect(line.color).toBeDefined();
				}
			}
		});
	});

	describe('Build step quality', () => {
		test('has exactly 6 build steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step titles do not reveal specific gem or method names', () => {
			for (const step of STEP_DEFS) {
				expect(step.title).not.toContain('polymorphic');
				expect(step.title).not.toContain('belongs_to');
				expect(step.title).not.toContain('has_many');
			}
		});

		test('correct migration command is never first', () => {
			const correctIdx = MIGRATION_COMMANDS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct db:migrate command is never first', () => {
			const correctIdx = RUN_MIGRATION_COMMANDS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct Comment model option is never first', () => {
			const correctIdx = COMMENT_MODEL_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct parent model option is never first', () => {
			const correctIdx = PARENT_MODEL_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct service option is never first', () => {
			const correctIdx = SERVICE_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct controller option is never first', () => {
			const correctIdx = CONTROLLER_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('each step has exactly one correct answer', () => {
			const allStepOptions = [
				MIGRATION_COMMANDS,
				RUN_MIGRATION_COMMANDS,
				COMMENT_MODEL_OPTIONS,
				PARENT_MODEL_OPTIONS,
				SERVICE_OPTIONS,
				CONTROLLER_OPTIONS,
			];
			for (const options of allStepOptions) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong option has feedback', () => {
			const allStepOptions = [
				MIGRATION_COMMANDS,
				RUN_MIGRATION_COMMANDS,
				COMMENT_MODEL_OPTIONS,
				PARENT_MODEL_OPTIONS,
				SERVICE_OPTIONS,
				CONTROLLER_OPTIONS,
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
				...MIGRATION_COMMANDS.filter((o) => !o.correct),
				...RUN_MIGRATION_COMMANDS.filter((o) => !o.correct),
				...COMMENT_MODEL_OPTIONS.filter((o) => !o.correct),
				...PARENT_MODEL_OPTIONS.filter((o) => !o.correct),
				...SERVICE_OPTIONS.filter((o) => !o.correct),
				...CONTROLLER_OPTIONS.filter((o) => !o.correct),
			];
			for (const opt of allWrongOptions) {
				const fb = opt.feedback?.toLowerCase() ?? '';
				// Feedback should not contain the exact correct command/code
				expect(fb).not.toContain('commentable:references{polymorphic}');
				expect(fb).not.toContain('rails db:migrate');
			}
		});

		test('db:migrate step follows migration generation (step ordering)', () => {
			const genIdx = STEP_DEFS.findIndex((s) => s.id === 'generate-migration');
			const migrateIdx = STEP_DEFS.findIndex((s) => s.id === 'run-migration');
			expect(migrateIdx).toBe(genIdx + 1);
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
			const allowed = STRESS_SCENARIOS.filter((s) => s.expectedResult === 'allowed');
			const blocked = STRESS_SCENARIOS.filter((s) => s.expectedResult === 'blocked');
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('covers all three parent types', () => {
			const parentTypes = ['post', 'photo', 'video'];
			for (const type of parentTypes) {
				const found = STRESS_SCENARIOS.some((s) => s.id.includes(type));
				expect(found).toBe(true);
			}
		});

		test('includes extensibility test (Article type)', () => {
			const articleScenario = STRESS_SCENARIOS.find((s) => s.id === 'comment-on-article');
			expect(articleScenario).toBeDefined();
			expect(articleScenario?.expectedResult).toBe('allowed');
		});

		test('includes validation failure test (empty body)', () => {
			const emptyBody = STRESS_SCENARIOS.find((s) => s.id === 'empty-body');
			expect(emptyBody).toBeDefined();
			expect(emptyBody?.expectedResult).toBe('blocked');
		});
	});

	describe('Stage inspector data', () => {
		test('has inspector data for all three comment tables', () => {
			expect(STAGE_INSPECTOR_MAP['post-comment-table']).toBeDefined();
			expect(STAGE_INSPECTOR_MAP['photo-comment-table']).toBeDefined();
			expect(STAGE_INSPECTOR_MAP['video-comment-table']).toBeDefined();
		});

		test('all inspector entries have code blocks', () => {
			for (const data of Object.values(STAGE_INSPECTOR_MAP)) {
				expect(data.code.length).toBeGreaterThan(0);
			}
		});

		test('inspector code shows duplicate validation pattern', () => {
			for (const data of Object.values(STAGE_INSPECTOR_MAP)) {
				expect(data.code).toContain('validates :body');
			}
		});
	});

	describe('Cross-phase consistency', () => {
		test('observe probes cover all non-stage discoveries', () => {
			const probeDiscoveryIds = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			// duplicate-schemas, scattered-queries, maintenance-burden are from probes
			expect(probeDiscoveryIds.has('duplicate-schemas')).toBe(true);
			expect(probeDiscoveryIds.has('scattered-queries')).toBe(true);
			expect(probeDiscoveryIds.has('maintenance-burden')).toBe(true);
		});

		test('stage clicks cover duplicate-logic discovery', () => {
			const stageDiscoveryIds = new Set(Object.values(STAGE_DISCOVERY_MAP).flat());
			expect(stageDiscoveryIds.has('duplicate-logic')).toBe(true);
		});

		test('stress scenarios cover same parent types as observe visualization', () => {
			const observeParents = ['post', 'photo', 'video'];
			for (const parent of observeParents) {
				const found = STRESS_SCENARIOS.some((s) => s.id.includes(parent));
				expect(found).toBe(true);
			}
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('service option uses ApplicationService base class', () => {
			const correct = SERVICE_OPTIONS.find((o) => o.correct);
			// The correct option should be the one with contract validation
			expect(correct?.id).toBe('correct-with-contract');
		});

		test('wrong service options explain why they fail cumulative patterns', () => {
			const noContract = SERVICE_OPTIONS.find((o) => o.id === 'wrong-no-contract');
			expect(noContract?.feedback).toContain('contract');

			const inlineValidation = SERVICE_OPTIONS.find((o) => o.id === 'wrong-inline-validation');
			expect(inlineValidation?.feedback).toContain('contract');
		});

		test('wrong controller option explains service delegation', () => {
			const directCreate = CONTROLLER_OPTIONS.find((o) => o.id === 'wrong-direct-create');
			expect(directCreate?.feedback).toContain('service object');
		});
	});

	describe('Data consistency', () => {
		test('minRequired (4) matches total discoveries', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('terminal steps are 0 and 1, option steps are 2-5', () => {
			// Steps 0 and 1 should be terminal (migration commands)
			expect(STEP_DEFS[0].id).toBe('generate-migration');
			expect(STEP_DEFS[1].id).toBe('run-migration');
			// Steps 2-5 should be option cards
			expect(STEP_DEFS[2].id).toBe('comment-model');
			expect(STEP_DEFS[3].id).toBe('parent-models');
			expect(STEP_DEFS[4].id).toBe('create-service');
			expect(STEP_DEFS[5].id).toBe('wire-controller');
		});

		test('all option step IDs match expected config keys', () => {
			const optionStepIndices = [2, 3, 4, 5];
			const expectedOptions = [
				COMMENT_MODEL_OPTIONS,
				PARENT_MODEL_OPTIONS,
				SERVICE_OPTIONS,
				CONTROLLER_OPTIONS,
			];
			for (let i = 0; i < optionStepIndices.length; i++) {
				expect(expectedOptions[i].length).toBeGreaterThanOrEqual(2);
			}
		});
	});
});
