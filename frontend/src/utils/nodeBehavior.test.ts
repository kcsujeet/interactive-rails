import { describe, expect, test } from 'bun:test';
import { findCriticalPath, getParticleConfig } from './nodeBehavior';

// ============================================
// Helpers
// ============================================

function node(id: string, type: string) {
	return { id, type };
}

function conn(sourceNodeId: string, targetNodeId: string) {
	return { sourceNodeId, targetNodeId };
}

// ============================================
// findCriticalPath
// ============================================

describe('findCriticalPath', () => {
	test('returns empty when no request node', () => {
		expect(findCriticalPath([node('res', 'response')], [])).toEqual([]);
	});

	test('returns empty when no response node', () => {
		expect(findCriticalPath([node('req', 'request')], [])).toEqual([]);
	});

	test('returns empty when no path exists', () => {
		const nodes = [node('req', 'request'), node('res', 'response')];
		expect(findCriticalPath(nodes, [])).toEqual([]);
	});

	test('finds direct request to response path', () => {
		const nodes = [node('req', 'request'), node('res', 'response')];
		expect(findCriticalPath(nodes, [conn('req', 'res')])).toEqual(['req', 'res']);
	});

	test('finds path through linear pipeline', () => {
		const nodes = [
			node('req', 'request'),
			node('rtr', 'router'),
			node('ctrl', 'controller'),
			node('res', 'response'),
		];
		const connections = [conn('req', 'rtr'), conn('rtr', 'ctrl'), conn('ctrl', 'res')];
		expect(findCriticalPath(nodes, connections)).toEqual(['req', 'rtr', 'ctrl', 'res']);
	});

	test('finds path through branching pipeline', () => {
		const nodes = [
			node('req', 'request'),
			node('ctrl', 'controller'),
			node('mdl', 'model'),
			node('ser', 'serializer'),
			node('res', 'response'),
		];
		const connections = [
			conn('req', 'ctrl'),
			conn('ctrl', 'mdl'),
			conn('ctrl', 'ser'),
			conn('ser', 'res'),
		];
		const path = findCriticalPath(nodes, connections);
		expect(path[0]).toBe('req');
		expect(path[path.length - 1]).toBe('res');
	});

	test('returns empty for empty inputs', () => {
		expect(findCriticalPath([], [])).toEqual([]);
	});
});

// ============================================
// getParticleConfig
// ============================================

describe('getParticleConfig', () => {
	describe('non-performance levels', () => {
		test('returns null when solutionNodeType is undefined', () => {
			expect(getParticleConfig(undefined, false)).toBeNull();
		});

		test('returns null even with hasSolutionNode true', () => {
			expect(getParticleConfig(undefined, true)).toBeNull();
		});

		test('returns null for unknown solutionNodeType', () => {
			expect(getParticleConfig('unknown_type', false)).toBeNull();
		});
	});

	describe('unsolved performance levels', () => {
		test('eager_load: heavy particles for N+1 visualization', () => {
			const config = getParticleConfig('eager_load', false);
			expect(config).not.toBeNull();
			expect(config!.particleCount).toBe(15);
			expect(config!.spawnRate).toBe(300);
		});

		test('index: slow single particle', () => {
			const config = getParticleConfig('index', false);
			expect(config).not.toBeNull();
			expect(config!.particleCount).toBe(1);
			expect(config!.speed).toBe(0.03);
		});

		test('cache: moderate particles', () => {
			const config = getParticleConfig('cache', false);
			expect(config).not.toBeNull();
			expect(config!.particleCount).toBe(3);
		});

		test('multiple: heavy particles', () => {
			const config = getParticleConfig('multiple', false);
			expect(config).not.toBeNull();
			expect(config!.particleCount).toBe(10);
		});
	});

	describe('solved performance levels', () => {
		test('returns calm single particle when solution is placed', () => {
			const config = getParticleConfig('eager_load', true);
			expect(config).not.toBeNull();
			expect(config!.particleCount).toBe(1);
			expect(config!.spawnRate).toBe(1000);
			expect(config!.speed).toBe(0.08);
		});

		test('calm particle regardless of solution type', () => {
			for (const type of ['eager_load', 'index', 'cache', 'multiple']) {
				const config = getParticleConfig(type, true);
				expect(config!.particleCount).toBe(1);
			}
		});
	});
});
