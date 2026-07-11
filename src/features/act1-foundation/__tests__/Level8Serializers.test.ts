/**
 * Level 8: Serializers. Reward-honesty pins (2026-07-11).
 *
 * The audit's P0 finding: the final controller kept `render json:
 * product` in create/update while the reward claimed timestamps no
 * longer leak on POST/PATCH. Every action that renders a product must
 * route through the serializer, or the POST/PATCH scenarios are lies.
 */

import { describe, expect, test } from 'bun:test';
import { getCodeFiles } from '../components/level-8-serializers/Level8Serializers';

describe('Level 8: the reward tells the truth about POST/PATCH', () => {
	const finalController = () => {
		const files = getCodeFiles('reward', 5, ['name', 'description', 'price']);
		const controller = files.find((f) =>
			f.filename.includes('products_controller.rb'),
		);
		expect(controller).toBeDefined();
		return controller?.code ?? '';
	};

	test('create and update render through the serializer', () => {
		const code = finalController();
		// The raw dump must be gone from every success path.
		expect(code.includes('render json: product,')).toBe(false);
		expect(code.includes('render json: product\n')).toBe(false);
		// All three product-rendering actions use the serializer.
		const serializerCalls = code.match(/ProductSerializer\.new\(/g) ?? [];
		expect(serializerCalls.length).toBeGreaterThanOrEqual(4); // index, show, create, update
	});

	test('error paths still render the errors hash (serializers are for resources)', () => {
		const code = finalController();
		expect(code).toContain('render json: { errors: product.errors }');
	});
});
