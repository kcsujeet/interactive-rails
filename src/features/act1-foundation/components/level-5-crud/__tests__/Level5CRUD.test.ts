/**
 * Tests for Level 5: CRUD Operations.
 *
 * Type 1 (no observe phase): Rails Console terminal-choice walkthrough
 * of Create, Read, Update, Destroy, Verify on the Product model.
 * No probes, no stress scenarios. Tests focus on build-step quality.
 *
 * Per testing.md: mirror data structures from the component, do not
 * import.
 *
 * Validates:
 * - Each step has exactly one correct option.
 * - Every wrong option has substantive feedback.
 * - Wrong-option feedback never reveals the correct answer.
 * - Option IDs and labels are unique within each step.
 * - Canonical answers reflect ActiveRecord conventions
 *   (`create` persists with validations, `find` for primary key,
 *   `update` for full lifecycle, `destroy` runs callbacks,
 *   `count` for cheap aggregate).
 */

import { describe, expect, test } from 'bun:test';

// ─────────────────────────────────────────────
// Mirrored data from Level5CRUD.tsx
// ─────────────────────────────────────────────

interface OptionShape {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const CREATE_OPTIONS: OptionShape[] = [
	{
		id: 'new',
		label: 'Product.new(name: "Hello", description: "My first product")',
		correct: false,
		feedback:
			'"new" builds the object in memory but doesn\'t save it to the database. You need the method that persists immediately.',
	},
	{
		id: 'insert',
		label: 'Product.insert(name: "Hello", description: "My first product")',
		correct: false,
		feedback:
			'"insert" does a raw SQL INSERT, skipping validations and callbacks. For the full lifecycle, pick the method that validates and saves in one step.',
	},
	{
		id: 'create',
		label: 'Product.create(name: "Hello", description: "My first product")',
		correct: true,
	},
];

const READ_OPTIONS: OptionShape[] = [
	{
		id: 'select',
		label: 'Product.select(1)',
		correct: false,
		feedback:
			'"select" filters columns (like SQL SELECT columns), not records. You need the method that fetches a single record by primary key.',
	},
	{
		id: 'find',
		label: 'Product.find(1)',
		correct: true,
	},
	{
		id: 'where',
		label: 'Product.where(1)',
		correct: false,
		feedback:
			'"where" takes conditions like where(name: "Hello"), not a bare ID. You need the method designed for primary key lookups.',
	},
];

const UPDATE_OPTIONS: OptionShape[] = [
	{
		id: 'assign',
		label: 'product.name = "Updated"',
		correct: false,
		feedback:
			'Assignment only changes the Ruby object in memory. You need the method that validates and persists to the DB in one call.',
	},
	{
		id: 'update_column',
		label: 'product.update_column(:name, "Updated")',
		correct: false,
		feedback:
			'"update_column" skips validations and callbacks. You need the method that goes through the full Rails lifecycle.',
	},
	{
		id: 'update',
		label: 'product.update(name: "Updated")',
		correct: true,
	},
];

const DESTROY_OPTIONS: OptionShape[] = [
	{
		id: 'delete',
		label: 'product.delete',
		correct: false,
		feedback:
			'"delete" runs SQL directly, skipping callbacks. You need the method that runs lifecycle hooks like dependent associations.',
	},
	{
		id: 'destroy',
		label: 'product.destroy',
		correct: true,
	},
];

const VERIFY_OPTIONS: OptionShape[] = [
	{
		id: 'all-length',
		label: 'Product.all.length',
		correct: false,
		feedback:
			"all.length loads every record into memory just to count them. There's a more efficient way.",
	},
	{
		id: 'exists',
		label: 'Product.exists?',
		correct: false,
		feedback:
			'exists? returns true/false, not a count. You need to see how many records remain.',
	},
	{
		id: 'count',
		label: 'Product.count',
		correct: true,
	},
];

const ALL_STEPS: { name: string; options: OptionShape[] }[] = [
	{ name: 'create', options: CREATE_OPTIONS },
	{ name: 'read', options: READ_OPTIONS },
	{ name: 'update', options: UPDATE_OPTIONS },
	{ name: 'destroy', options: DESTROY_OPTIONS },
	{ name: 'verify', options: VERIFY_OPTIONS },
];

// Distinctive substrings of each step's correct answer that must NOT
// appear in that step's wrong-option feedback. Picks must be specific
// enough to be the actual answer giveaway, not the bare verb (which
// shows up legitimately in conceptual prose).
const CORRECT_ANSWER_KEYWORDS: Record<string, string[]> = {
	// Correct: `Product.create(...)` — the giveaway is the literal call.
	create: ['Product.create', '.create('],
	// Correct: `Product.find(1)`.
	read: ['Product.find', '.find('],
	// Correct: `product.update(name: "Updated")`. The bare word "update"
	// appears in legitimate feedback (e.g. "update_column"), so check the
	// full method-call form. Note: feedback for `update_column` legitimately
	// uses "update_column"; the leak we're catching is `product.update(`.
	update: ['product.update(', '.update(name'],
	// Correct: `product.destroy`.
	destroy: ['product.destroy', '.destroy'],
	// Correct: `Product.count`.
	verify: ['Product.count', '.count'],
};

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Level 5: CRUD Operations — build step quality', () => {
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

describe('Level 5: CRUD Operations — narrative consistency', () => {
	test('create step uses Product.create (validates + persists)', () => {
		const correct = CREATE_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('Product.create(');
		expect(correct?.label).not.toContain('Product.new');
		expect(correct?.label).not.toContain('Product.insert');
	});

	test('read step uses Product.find (primary key lookup)', () => {
		const correct = READ_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('Product.find(1)');
	});

	test('update step uses product.update (full lifecycle)', () => {
		const correct = UPDATE_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('product.update(name: "Updated")');
		expect(correct?.label).not.toContain('update_column');
	});

	test('destroy step uses product.destroy (runs callbacks)', () => {
		const correct = DESTROY_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('product.destroy');
		expect(correct?.label).not.toBe('product.delete');
	});

	test('verify step uses Product.count (cheap aggregate)', () => {
		const correct = VERIFY_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('Product.count');
		expect(correct?.label).not.toContain('Product.all');
	});
});
