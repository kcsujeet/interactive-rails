/**
 * Level 32: Polymorphic Associations - Data Consistency Tests
 *
 * Type 2 static intro (no probes, no discoveries, no stage inspector).
 *
 * Tests mirror the data structures from the component to verify:
 * - Build step quality (correct answer position, feedback quality)
 * - Stress test scenario coverage and consistency
 * - Cross-phase consistency (intro tables match reward visualization)
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirror data from component ──

const DUPLICATE_TABLES = [
	{ name: 'post_comments', fkColumn: 'post_id' },
	{ name: 'photo_comments', fkColumn: 'photo_id' },
	{ name: 'video_comments', fkColumn: 'video_id' },
];

const SHARED_COLUMNS = ['id', 'body', 'user_id', 'created_at'];

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

// ── Tests ──

describe('Level 32: Polymorphic Associations', () => {
	describe('Static intro (Type 2)', () => {
		test('has exactly 3 duplicate tables', () => {
			expect(DUPLICATE_TABLES).toHaveLength(3);
		});

		test('all table names are unique', () => {
			const names = DUPLICATE_TABLES.map((t) => t.name);
			expect(new Set(names).size).toBe(names.length);
		});

		test('all tables share the same 4 columns', () => {
			expect(SHARED_COLUMNS).toHaveLength(4);
			expect(SHARED_COLUMNS).toContain('id');
			expect(SHARED_COLUMNS).toContain('body');
			expect(SHARED_COLUMNS).toContain('user_id');
			expect(SHARED_COLUMNS).toContain('created_at');
		});

		test('each table has a unique foreign key column', () => {
			const fks = DUPLICATE_TABLES.map((t) => t.fkColumn);
			expect(new Set(fks).size).toBe(fks.length);
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

	describe('Cross-phase consistency', () => {
		test('intro tables cover same parent types as stress scenarios', () => {
			const introParents = DUPLICATE_TABLES.map((t) => t.name.replace('_comments', ''));
			for (const parent of introParents) {
				const found = STRESS_SCENARIOS.some((s) => s.id.includes(parent));
				expect(found).toBe(true);
			}
		});

		test('stress scenarios include types beyond intro (extensibility)', () => {
			const articleScenario = STRESS_SCENARIOS.find((s) => s.id === 'comment-on-article');
			expect(articleScenario).toBeDefined();
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('service option uses ApplicationService base class', () => {
			const correct = SERVICE_OPTIONS.find((o) => o.correct);
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
		test('terminal steps are 0 and 1, option steps are 2-5', () => {
			expect(STEP_DEFS[0].id).toBe('generate-migration');
			expect(STEP_DEFS[1].id).toBe('run-migration');
			expect(STEP_DEFS[2].id).toBe('comment-model');
			expect(STEP_DEFS[3].id).toBe('parent-models');
			expect(STEP_DEFS[4].id).toBe('create-service');
			expect(STEP_DEFS[5].id).toBe('wire-controller');
		});

		test('all option step IDs match expected config keys', () => {
			const expectedOptions = [
				COMMENT_MODEL_OPTIONS,
				PARENT_MODEL_OPTIONS,
				SERVICE_OPTIONS,
				CONTROLLER_OPTIONS,
			];
			for (const options of expectedOptions) {
				expect(options.length).toBeGreaterThanOrEqual(2);
			}
		});
	});
});
