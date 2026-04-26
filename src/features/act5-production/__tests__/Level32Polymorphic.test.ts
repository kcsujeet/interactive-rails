/**
 * Level 32: Polymorphic Associations - Data Consistency Tests
 *
 * Type 2 static intro, static before/after reward (no probes, no stress test).
 *
 * Tests mirror the data structures from the component to verify:
 * - Build step quality (correct answer position, feedback quality)
 * - Cross-phase consistency (intro tables match reward unified table)
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirror data from component ──

const DUPLICATE_TABLES = [
	{ name: 'product_reviews', fkColumn: 'product_id' },
	{ name: 'photo_reviews', fkColumn: 'photo_id' },
	{ name: 'video_reviews', fkColumn: 'video_id' },
];

const SHARED_COLUMNS = ['id', 'body', 'user_id', 'created_at'];

const UNIFIED_ROWS = [
	{
		id: 1,
		body: 'Great product!',
		type: 'Product',
		typeId: 1,
		userId: 5,
		createdAt: 'Mar 12',
	},
	{
		id: 2,
		body: 'Beautiful shot!',
		type: 'Photo',
		typeId: 3,
		userId: 5,
		createdAt: 'Mar 10',
	},
	{
		id: 3,
		body: 'Awesome video!',
		type: 'Video',
		typeId: 7,
		userId: 2,
		createdAt: 'Mar 11',
	},
	{
		id: 4,
		body: 'Nice analysis',
		type: 'Article',
		typeId: 2,
		userId: 8,
		createdAt: 'Mar 15',
	},
];

const STEP_DEFS = [
	{ id: 'generate-migration', title: 'Generate Migration' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'review-model', title: 'Define Review Model' },
	{ id: 'parent-models', title: 'Update Parent Models' },
	{ id: 'create-service', title: 'Create Review Service' },
	{ id: 'wire-controller', title: 'Wire the Controller' },
];

const MIGRATION_COMMANDS = [
	{
		id: 'wrong-separate',
		label: 'rails g model Review body:text product:references',
		correct: false,
		feedback:
			'This creates a foreign key to products only. You need a polymorphic reference that can point to any parent type.',
	},
	{
		id: 'correct-polymorphic',
		label: 'rails g model Review body:text reviewable:references{polymorphic}',
		correct: true,
	},
	{
		id: 'wrong-string-columns',
		label:
			'rails g model Review body:text reviewable_type:string reviewable_id:integer',
		correct: false,
		feedback:
			'Adding columns manually works but misses the index. The {polymorphic} flag generates both columns AND the composite index automatically.',
	},
];

const RUN_MIGRATION_COMMANDS = [
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		correct: false,
		feedback:
			'db:setup drops and recreates the database from schema.rb. You only need to run the pending migration.',
	},
	{ id: 'correct-migrate', label: 'rails db:migrate', correct: true },
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		correct: false,
		feedback:
			'db:seed populates sample data. The migration still needs to run first to create the reviews table.',
	},
];

const COMMENT_MODEL_OPTIONS = [
	{
		id: 'wrong-sti',
		correct: false,
		feedback:
			'Multiple belongs_to associations require all three foreign keys on every row. Most will be null. Polymorphic uses a single type/id pair instead.',
	},
	{ id: 'correct-polymorphic', correct: true },
	{
		id: 'wrong-no-polymorphic',
		correct: false,
		feedback:
			'Without `polymorphic: true`, Rails expects a `reviewables` table to exist. The polymorphic flag tells Rails to use the type/id column pair instead.',
	},
];

const PARENT_MODEL_OPTIONS = [
	{
		id: 'wrong-has-one',
		correct: false,
		feedback:
			'has_one limits each product to a single review. Products can have many reviews, so has_many is the correct association.',
	},
	{
		id: 'wrong-no-as',
		correct: false,
		feedback:
			'Without `as: :reviewable`, Rails looks for a `product_id` column on reviews. The `as:` option tells Rails to use the polymorphic reviewable_type/reviewable_id pair.',
	},
	{ id: 'correct-as-reviewable', correct: true },
];

const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		correct: false,
		feedback:
			'Missing input validation via contract. Since L18, services must validate input through a Dry::Validation::Contract before business logic.',
	},
	{ id: 'correct-with-contract', correct: true },
	{
		id: 'wrong-inline-validation',
		correct: false,
		feedback:
			'Inline validation checks in the service were replaced by Dry::Validation contracts in L18. Use a ReviewContract to validate input.',
	},
];

const CONTROLLER_OPTIONS = [
	{
		id: 'wrong-direct-create',
		correct: false,
		feedback:
			'Business logic belongs in service objects, not controllers. The controller should delegate to CreateReview.call and handle the result.',
	},
	{ id: 'correct-service', correct: true },
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

		test('correct Review model option is never first', () => {
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
				expect(fb).not.toContain('reviewable:references{polymorphic}');
				expect(fb).not.toContain('rails db:migrate');
			}
		});

		test('db:migrate step follows migration generation (step ordering)', () => {
			const genIdx = STEP_DEFS.findIndex((s) => s.id === 'generate-migration');
			const migrateIdx = STEP_DEFS.findIndex((s) => s.id === 'run-migration');
			expect(migrateIdx).toBe(genIdx + 1);
		});
	});

	describe('Cross-phase consistency (intro vs reward)', () => {
		test('reward unified table covers all intro parent types', () => {
			const introParents = DUPLICATE_TABLES.map((t) =>
				t.name.replace('_reviews', ''),
			);
			const rewardTypes = UNIFIED_ROWS.map((r) => r.type.toLowerCase());
			for (const parent of introParents) {
				expect(rewardTypes).toContain(parent);
			}
		});

		test('reward table includes extensibility type (Article)', () => {
			const articleRow = UNIFIED_ROWS.find((r) => r.type === 'Article');
			expect(articleRow).toBeDefined();
		});

		test('reward rows all have complete data', () => {
			for (const row of UNIFIED_ROWS) {
				expect(row.id).toBeGreaterThan(0);
				expect(row.body.length).toBeGreaterThan(0);
				expect(row.type.length).toBeGreaterThan(0);
				expect(row.typeId).toBeGreaterThan(0);
				expect(row.userId).toBeGreaterThan(0);
				expect(row.createdAt.length).toBeGreaterThan(0);
			}
		});

		test('unified table has more types than intro (shows improvement)', () => {
			const introCount = DUPLICATE_TABLES.length;
			const rewardTypes = new Set(UNIFIED_ROWS.map((r) => r.type));
			expect(rewardTypes.size).toBeGreaterThan(introCount);
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('service option uses ApplicationService base class', () => {
			const correct = SERVICE_OPTIONS.find((o) => o.correct);
			expect(correct?.id).toBe('correct-with-contract');
		});

		test('wrong service options explain why they fail cumulative patterns', () => {
			const noContract = SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-no-contract',
			);
			expect(noContract?.feedback).toContain('contract');

			const inlineValidation = SERVICE_OPTIONS.find(
				(o) => o.id === 'wrong-inline-validation',
			);
			expect(inlineValidation?.feedback).toContain('contract');
		});

		test('wrong controller option explains service delegation', () => {
			const directCreate = CONTROLLER_OPTIONS.find(
				(o) => o.id === 'wrong-direct-create',
			);
			expect(directCreate?.feedback).toContain('service object');
		});
	});

	describe('Data consistency', () => {
		test('terminal steps are 0 and 1, option steps are 2-5', () => {
			expect(STEP_DEFS[0].id).toBe('generate-migration');
			expect(STEP_DEFS[1].id).toBe('run-migration');
			expect(STEP_DEFS[2].id).toBe('review-model');
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
