/**
 * Tests for Level 6: Separation of Concerns
 *
 * Player places code blocks from a palette into the correct architectural layer.
 * Teaches: Controllers handle HTTP, Models handle data, Services handle business logic.
 */

import { describe, expect, test } from 'bun:test';

// Types matching the component
interface CodeBlock {
	id: string;
	name: string;
	code: string;
	color: string;
	description: string;
	correctTarget: 'controller' | 'model' | 'service';
	currentLocation: string | null; // null = in palette, or node id
}

interface ValidationResult {
	valid: boolean;
	message: string;
	details?: string[];
}

// Recreate validation logic from component
function validateLevel6Solution(blocks: CodeBlock[]): ValidationResult {
	const errors: string[] = [];

	// Check all blocks are placed
	const unplacedBlocks = blocks.filter((b) => b.currentLocation === null);
	if (unplacedBlocks.length > 0) {
		errors.push(`${unplacedBlocks.length} block(s) still need to be placed`);
	}

	// Check blocks are in correct locations
	const ARCHITECTURE_NODES = [
		{ id: 'controller', name: 'OrdersController' },
		{ id: 'model', name: 'Order' },
		{ id: 'service', name: 'CheckoutService' },
	];

	for (const block of blocks) {
		if (
			block.currentLocation &&
			block.currentLocation !== block.correctTarget
		) {
			const targetNode = ARCHITECTURE_NODES.find(
				(n) => n.id === block.currentLocation,
			);
			errors.push(
				`"${block.name}" doesn't belong in ${targetNode?.name || 'that location'}`,
			);
		}
	}

	if (errors.length > 0) {
		return {
			valid: false,
			message: 'Architecture needs adjustment!',
			details: errors,
		};
	}

	return {
		valid: true,
		message: 'Clean architecture - each layer has a single responsibility!',
	};
}

// Test data - matches the component's CODE_BLOCKS
const CODE_BLOCKS: CodeBlock[] = [
	{
		id: 'params',
		name: 'Permit Params',
		code: 'params.require(:order).permit(:product_id, :quantity)',
		color: '#3b82f6',
		description: 'Handles incoming HTTP parameters',
		correctTarget: 'controller',
		currentLocation: null,
	},
	{
		id: 'response',
		name: 'Render Response',
		code: 'render json: { order: @order }, status: :created',
		color: '#06b6d4',
		description: 'Formats HTTP response',
		correctTarget: 'controller',
		currentLocation: null,
	},
	{
		id: 'validation',
		name: 'Validation',
		code: 'validates :total, numericality: { greater_than: 0 }',
		color: '#22c55e',
		description: 'Ensures data integrity',
		correctTarget: 'model',
		currentLocation: null,
	},
	{
		id: 'association',
		name: 'Association',
		code: 'belongs_to :user\nhas_many :line_items',
		color: '#10b981',
		description: 'Defines data relationships',
		correctTarget: 'model',
		currentLocation: null,
	},
	{
		id: 'payment',
		name: 'Process Payment',
		code: 'Stripe::Charge.create(amount: total_cents)',
		color: '#f59e0b',
		description: 'External API integration',
		correctTarget: 'service',
		currentLocation: null,
	},
	{
		id: 'email',
		name: 'Send Receipt',
		code: 'OrderMailer.receipt(@order).deliver_later',
		color: '#ef4444',
		description: 'Triggers side effects',
		correctTarget: 'service',
		currentLocation: null,
	},
];

describe('Level 6: Separation of Concerns', () => {
	describe('Initial State (all blocks in palette)', () => {
		test('should be invalid when no blocks are placed', () => {
			const result = validateLevel6Solution(CODE_BLOCKS);

			expect(result.valid).toBe(false);
			expect(result.details).toBeDefined();
			expect(
				result.details!.some((d) =>
					d.includes('6 block(s) still need to be placed'),
				),
			).toBe(true);
		});
	});

	describe('Partial Solutions', () => {
		test('should be invalid when only some blocks are placed', () => {
			const blocks = CODE_BLOCKS.map((b) =>
				b.id === 'params' ? { ...b, currentLocation: 'controller' } : b,
			);

			const result = validateLevel6Solution(blocks);

			expect(result.valid).toBe(false);
			expect(
				result.details!.some((d) =>
					d.includes('5 block(s) still need to be placed'),
				),
			).toBe(true);
		});

		test('should be invalid when blocks are placed in wrong locations', () => {
			const blocks = CODE_BLOCKS.map((b) => {
				// Place all blocks, but put payment in controller (wrong!)
				if (b.id === 'params') return { ...b, currentLocation: 'controller' };
				if (b.id === 'response') return { ...b, currentLocation: 'controller' };
				if (b.id === 'validation') return { ...b, currentLocation: 'model' };
				if (b.id === 'association') return { ...b, currentLocation: 'model' };
				if (b.id === 'payment') return { ...b, currentLocation: 'controller' }; // WRONG
				if (b.id === 'email') return { ...b, currentLocation: 'service' };
				return b;
			});

			const result = validateLevel6Solution(blocks);

			expect(result.valid).toBe(false);
			expect(
				result.details!.some(
					(d) =>
						d.includes('Process Payment') && d.includes('OrdersController'),
				),
			).toBe(true);
		});

		test('should be invalid when model blocks placed in service', () => {
			const blocks = CODE_BLOCKS.map((b) => {
				if (b.id === 'params') return { ...b, currentLocation: 'controller' };
				if (b.id === 'response') return { ...b, currentLocation: 'controller' };
				if (b.id === 'validation') return { ...b, currentLocation: 'service' }; // WRONG
				if (b.id === 'association') return { ...b, currentLocation: 'model' };
				if (b.id === 'payment') return { ...b, currentLocation: 'service' };
				if (b.id === 'email') return { ...b, currentLocation: 'service' };
				return b;
			});

			const result = validateLevel6Solution(blocks);

			expect(result.valid).toBe(false);
			expect(
				result.details!.some(
					(d) => d.includes('Validation') && d.includes('CheckoutService'),
				),
			).toBe(true);
		});

		test('should be invalid when service blocks placed in model', () => {
			const blocks = CODE_BLOCKS.map((b) => {
				if (b.id === 'params') return { ...b, currentLocation: 'controller' };
				if (b.id === 'response') return { ...b, currentLocation: 'controller' };
				if (b.id === 'validation') return { ...b, currentLocation: 'model' };
				if (b.id === 'association') return { ...b, currentLocation: 'model' };
				if (b.id === 'payment') return { ...b, currentLocation: 'model' }; // WRONG
				if (b.id === 'email') return { ...b, currentLocation: 'model' }; // WRONG
				return b;
			});

			const result = validateLevel6Solution(blocks);

			expect(result.valid).toBe(false);
			expect(
				result.details!.some(
					(d) => d.includes('Process Payment') && d.includes('Order'),
				),
			).toBe(true);
			expect(
				result.details!.some(
					(d) => d.includes('Send Receipt') && d.includes('Order'),
				),
			).toBe(true);
		});
	});

	describe('Correct Solution', () => {
		test('should be valid when all blocks are in correct locations', () => {
			const blocks = CODE_BLOCKS.map((b) => ({
				...b,
				currentLocation: b.correctTarget,
			}));

			const result = validateLevel6Solution(blocks);

			expect(result.valid).toBe(true);
			expect(result.message).toContain('single responsibility');
		});

		test('should have no errors when all blocks correctly placed', () => {
			const blocks = CODE_BLOCKS.map((b) => ({
				...b,
				currentLocation: b.correctTarget,
			}));

			const result = validateLevel6Solution(blocks);

			expect(result.details).toBeUndefined();
		});
	});

	describe('Block Classification', () => {
		test('Permit Params should go to Controller', () => {
			const block = CODE_BLOCKS.find((b) => b.id === 'params')!;
			expect(block.correctTarget).toBe('controller');
		});

		test('Render Response should go to Controller', () => {
			const block = CODE_BLOCKS.find((b) => b.id === 'response')!;
			expect(block.correctTarget).toBe('controller');
		});

		test('Validation should go to Model', () => {
			const block = CODE_BLOCKS.find((b) => b.id === 'validation')!;
			expect(block.correctTarget).toBe('model');
		});

		test('Association should go to Model', () => {
			const block = CODE_BLOCKS.find((b) => b.id === 'association')!;
			expect(block.correctTarget).toBe('model');
		});

		test('Process Payment should go to Service', () => {
			const block = CODE_BLOCKS.find((b) => b.id === 'payment')!;
			expect(block.correctTarget).toBe('service');
		});

		test('Send Receipt should go to Service', () => {
			const block = CODE_BLOCKS.find((b) => b.id === 'email')!;
			expect(block.correctTarget).toBe('service');
		});
	});

	describe('Architecture Principles', () => {
		test('should have 2 controller-related blocks', () => {
			const controllerBlocks = CODE_BLOCKS.filter(
				(b) => b.correctTarget === 'controller',
			);
			expect(controllerBlocks.length).toBe(2);
		});

		test('should have 2 model-related blocks', () => {
			const modelBlocks = CODE_BLOCKS.filter(
				(b) => b.correctTarget === 'model',
			);
			expect(modelBlocks.length).toBe(2);
		});

		test('should have 2 service-related blocks', () => {
			const serviceBlocks = CODE_BLOCKS.filter(
				(b) => b.correctTarget === 'service',
			);
			expect(serviceBlocks.length).toBe(2);
		});

		test('HTTP concerns belong in Controller', () => {
			const httpBlocks = CODE_BLOCKS.filter(
				(b) =>
					b.description.toLowerCase().includes('http') ||
					b.description.toLowerCase().includes('response') ||
					b.description.toLowerCase().includes('parameter'),
			);
			httpBlocks.forEach((b) => expect(b.correctTarget).toBe('controller'));
		});

		test('Data concerns belong in Model', () => {
			const dataBlocks = CODE_BLOCKS.filter(
				(b) =>
					b.description.toLowerCase().includes('data') ||
					b.description.toLowerCase().includes('relationship'),
			);
			dataBlocks.forEach((b) => expect(b.correctTarget).toBe('model'));
		});

		test('Business logic belongs in Service', () => {
			const businessBlocks = CODE_BLOCKS.filter(
				(b) =>
					b.description.toLowerCase().includes('external') ||
					b.description.toLowerCase().includes('side effect'),
			);
			businessBlocks.forEach((b) => expect(b.correctTarget).toBe('service'));
		});
	});
});
