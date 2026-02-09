/**
 * Tests for Pipeline Validation
 *
 * Tests the evaluateCondition logic, especially:
 * - pipeline_complete: all nodes reachable from request to response
 * - node_present / node_absent: node type existence checks
 * - connection: specific source→target connection checks
 */

import { describe, expect, test } from 'bun:test';

// Minimal types matching the real ones
interface PlacedNode {
	id: string;
	type: string;
	x: number;
	y: number;
	locked?: boolean;
}

interface Connection {
	id: string;
	sourceNodeId: string;
	targetNodeId: string;
}

interface SuccessCondition {
	type: string;
	nodeType?: string;
	sourceType?: string;
	targetType?: string;
}

// Extracted from usePipelineValidation.ts — pure function version of evaluateCondition
function evaluateCondition(
	condition: SuccessCondition,
	placedNodes: PlacedNode[],
	connections: Connection[],
): { passed: boolean; message: string } {
	switch (condition.type) {
		case 'node_present': {
			const hasNode = placedNodes.some((n) => n.type === condition.nodeType);
			return {
				passed: hasNode,
				message: hasNode ? '' : `Missing ${condition.nodeType} node`,
			};
		}
		case 'node_absent': {
			const hasNode = placedNodes.some((n) => n.type === condition.nodeType);
			return {
				passed: !hasNode,
				message: !hasNode ? '' : `Remove the ${condition.nodeType} node`,
			};
		}
		case 'connection': {
			const hasConnection = connections.some((conn) => {
				const source = placedNodes.find((n) => n.id === conn.sourceNodeId);
				const target = placedNodes.find((n) => n.id === conn.targetNodeId);
				return (
					source?.type === condition.sourceType &&
					target?.type === condition.targetType
				);
			});
			return {
				passed: hasConnection,
				message: hasConnection
					? ''
					: `Connect ${condition.sourceType} → ${condition.targetType}`,
			};
		}
		case 'pipeline_complete': {
			const reqNode = placedNodes.find((n) => n.type === 'request');
			const resNode = placedNodes.find((n) => n.type === 'response');
			if (!reqNode || !resNode) {
				return { passed: false, message: 'Missing Request or Response node' };
			}

			const reachable = new Set<string>();
			const bfsQueue = [reqNode.id];
			while (bfsQueue.length > 0) {
				const id = bfsQueue.shift()!;
				if (reachable.has(id)) continue;
				reachable.add(id);
				for (const conn of connections) {
					if (conn.sourceNodeId === id && !reachable.has(conn.targetNodeId)) {
						bfsQueue.push(conn.targetNodeId);
					}
				}
			}

			if (!reachable.has(resNode.id)) {
				return {
					passed: false,
					message: 'No complete path from Request to Response',
				};
			}

			const disconnected = placedNodes.filter((n) => !reachable.has(n.id));
			if (disconnected.length > 0) {
				return {
					passed: false,
					message: 'All nodes must be connected in the pipeline',
				};
			}

			return { passed: true, message: '' };
		}
		default:
			return { passed: true, message: '' };
	}
}

// ============================================
// Helpers
// ============================================

function node(id: string, type: string): PlacedNode {
	return { id, type, x: 0, y: 0 };
}

function conn(sourceNodeId: string, targetNodeId: string): Connection {
	return {
		id: `c-${sourceNodeId}-${targetNodeId}`,
		sourceNodeId,
		targetNodeId,
	};
}

// ============================================
// Tests
// ============================================

describe('evaluateCondition', () => {
	describe('node_present', () => {
		test('passes when node type exists', () => {
			const nodes = [node('r', 'router')];
			const result = evaluateCondition(
				{ type: 'node_present', nodeType: 'router' },
				nodes,
				[],
			);
			expect(result.passed).toBe(true);
			expect(result.message).toBe('');
		});

		test('fails when node type is missing', () => {
			const nodes = [node('c', 'controller')];
			const result = evaluateCondition(
				{ type: 'node_present', nodeType: 'router' },
				nodes,
				[],
			);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('router');
		});

		test('fails with empty nodes', () => {
			const result = evaluateCondition(
				{ type: 'node_present', nodeType: 'router' },
				[],
				[],
			);
			expect(result.passed).toBe(false);
		});
	});

	describe('node_absent', () => {
		test('passes when node type is missing', () => {
			const nodes = [node('c', 'controller')];
			const result = evaluateCondition(
				{ type: 'node_absent', nodeType: 'cache' },
				nodes,
				[],
			);
			expect(result.passed).toBe(true);
			expect(result.message).toBe('');
		});

		test('fails when node type exists', () => {
			const nodes = [node('c', 'cache')];
			const result = evaluateCondition(
				{ type: 'node_absent', nodeType: 'cache' },
				nodes,
				[],
			);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('Remove');
		});
	});

	describe('connection', () => {
		test('passes when exact connection exists', () => {
			const nodes = [node('req', 'request'), node('rtr', 'router')];
			const connections = [conn('req', 'rtr')];
			const result = evaluateCondition(
				{ type: 'connection', sourceType: 'request', targetType: 'router' },
				nodes,
				connections,
			);
			expect(result.passed).toBe(true);
		});

		test('fails when connection is missing', () => {
			const nodes = [node('req', 'request'), node('rtr', 'router')];
			const result = evaluateCondition(
				{ type: 'connection', sourceType: 'request', targetType: 'router' },
				nodes,
				[],
			);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('request');
			expect(result.message).toContain('router');
		});

		test('fails when connection direction is reversed', () => {
			const nodes = [node('req', 'request'), node('rtr', 'router')];
			const connections = [conn('rtr', 'req')]; // wrong direction
			const result = evaluateCondition(
				{ type: 'connection', sourceType: 'request', targetType: 'router' },
				nodes,
				connections,
			);
			expect(result.passed).toBe(false);
		});

		test('fails when connection exists but between wrong node types', () => {
			const nodes = [
				node('req', 'request'),
				node('rtr', 'router'),
				node('ctrl', 'controller'),
			];
			const connections = [conn('req', 'ctrl')]; // request→controller, not request→router
			const result = evaluateCondition(
				{ type: 'connection', sourceType: 'request', targetType: 'router' },
				nodes,
				connections,
			);
			expect(result.passed).toBe(false);
		});
	});

	describe('pipeline_complete', () => {
		const condition = { type: 'pipeline_complete' };

		test('fails when no request node', () => {
			const nodes = [node('res', 'response')];
			const result = evaluateCondition(condition, nodes, []);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('Missing');
		});

		test('fails when no response node', () => {
			const nodes = [node('req', 'request')];
			const result = evaluateCondition(condition, nodes, []);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('Missing');
		});

		test('fails with no connections between request and response', () => {
			const nodes = [node('req', 'request'), node('res', 'response')];
			const result = evaluateCondition(condition, nodes, []);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('No complete path');
		});

		test('passes with direct request→response connection', () => {
			const nodes = [node('req', 'request'), node('res', 'response')];
			const connections = [conn('req', 'res')];
			const result = evaluateCondition(condition, nodes, connections);
			expect(result.passed).toBe(true);
		});

		test('passes with full linear pipeline', () => {
			const nodes = [
				node('req', 'request'),
				node('rtr', 'router'),
				node('ctrl', 'controller'),
				node('mdl', 'model'),
				node('db', 'database'),
				node('ser', 'serializer'),
				node('res', 'response'),
			];
			const connections = [
				conn('req', 'rtr'),
				conn('rtr', 'ctrl'),
				conn('ctrl', 'mdl'),
				conn('mdl', 'db'),
				conn('db', 'ser'),
				conn('ser', 'res'),
			];
			const result = evaluateCondition(condition, nodes, connections);
			expect(result.passed).toBe(true);
			expect(result.message).toBe('');
		});

		test('fails when a node is disconnected from the pipeline', () => {
			const nodes = [
				node('req', 'request'),
				node('rtr', 'router'),
				node('ctrl', 'controller'),
				node('res', 'response'),
			];
			// router is not connected — req→ctrl→res, router floats
			const connections = [conn('req', 'ctrl'), conn('ctrl', 'res')];
			const result = evaluateCondition(condition, nodes, connections);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('All nodes must be connected');
		});

		test('fails when response is not reachable (broken chain)', () => {
			const nodes = [
				node('req', 'request'),
				node('rtr', 'router'),
				node('ctrl', 'controller'),
				node('res', 'response'),
			];
			// req→rtr→ctrl, but ctrl not connected to res
			const connections = [conn('req', 'rtr'), conn('rtr', 'ctrl')];
			const result = evaluateCondition(condition, nodes, connections);
			expect(result.passed).toBe(false);
			expect(result.message).toContain('No complete path');
		});

		test('fails with Level 6 scenario: only initial connections, router disconnected', () => {
			// Reproduces the exact bug from the screenshot
			const nodes = [
				node('request-node', 'request'),
				node('controller-node', 'controller'),
				node('model-node', 'model'),
				node('database-node', 'database'),
				node('serializer-node', 'serializer'),
				node('response-node', 'response'),
				node('router-1', 'router'), // user-added, floating
			];
			const connections = [
				conn('controller-node', 'model-node'),
				conn('model-node', 'database-node'),
			];
			const result = evaluateCondition(condition, nodes, connections);
			expect(result.passed).toBe(false);
		});

		test('passes with Level 6 fully wired pipeline', () => {
			const nodes = [
				node('request-node', 'request'),
				node('router-1', 'router'),
				node('controller-node', 'controller'),
				node('model-node', 'model'),
				node('database-node', 'database'),
				node('serializer-node', 'serializer'),
				node('response-node', 'response'),
			];
			const connections = [
				conn('request-node', 'router-1'),
				conn('router-1', 'controller-node'),
				conn('controller-node', 'model-node'),
				conn('model-node', 'database-node'),
				conn('database-node', 'serializer-node'),
				conn('serializer-node', 'response-node'),
			];
			const result = evaluateCondition(condition, nodes, connections);
			expect(result.passed).toBe(true);
		});

		test('handles branching pipeline (controller → model AND controller → serializer)', () => {
			const nodes = [
				node('req', 'request'),
				node('rtr', 'router'),
				node('ctrl', 'controller'),
				node('mdl', 'model'),
				node('db', 'database'),
				node('ser', 'serializer'),
				node('res', 'response'),
			];
			// controller branches: ctrl→mdl→db and ctrl→ser→res
			const connections = [
				conn('req', 'rtr'),
				conn('rtr', 'ctrl'),
				conn('ctrl', 'mdl'),
				conn('mdl', 'db'),
				conn('ctrl', 'ser'),
				conn('ser', 'res'),
			];
			const result = evaluateCondition(condition, nodes, connections);
			// db is reachable from req, but is db a dead end? That's fine —
			// the condition checks that all nodes are reachable, not that all lead to response
			expect(result.passed).toBe(true);
		});

		test('fails with empty canvas', () => {
			const result = evaluateCondition(condition, [], []);
			expect(result.passed).toBe(false);
		});
	});

	describe('unknown condition type', () => {
		test('defaults to passed for unhandled types', () => {
			const result = evaluateCondition({ type: 'some_future_type' }, [], []);
			expect(result.passed).toBe(true);
		});
	});
});
