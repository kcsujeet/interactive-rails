/**
 * Pipeline Validation Hook
 * Path finding and validation logic
 */

import { useCallback, useMemo } from 'react';
import { getLevel } from '@/features/acts-registry';
import type {
	Connection,
	LiveMetrics,
	PlacedNode,
	SuccessCondition,
	ValidationResult,
} from '@/types';
import { isValidConnection, levelChallenges } from '@/utils/gameData';

export interface UsePipelineValidationReturn {
	isPipelineBroken: boolean;
	breakReason: string | null;
	hasSolutionNode: boolean;
	findPath: (startType: string, endType: string) => boolean;
	validatePipeline: () => ValidationResult;
	checkChallenge: (metrics?: LiveMetrics) => ValidationResult;
}

export function usePipelineValidation(
	levelId: string,
	placedNodes: PlacedNode[],
	connections: Connection[],
): UsePipelineValidationReturn {
	// BFS path finding
	const findPath = useCallback(
		(startType: string, endType: string): boolean => {
			const startNode = placedNodes.find((n) => n.type === startType);
			const endNode = placedNodes.find((n) => n.type === endType);
			if (!startNode || !endNode) return false;

			const visited = new Set<string>();
			const queue = [startNode.id];

			while (queue.length > 0) {
				const currentId = queue.shift();
				if (!currentId || visited.has(currentId)) continue;
				visited.add(currentId);

				const currentNode = placedNodes.find((n) => n.id === currentId);
				if (currentNode?.type === endType) return true;

				for (const conn of connections) {
					if (
						conn.sourceNodeId === currentId &&
						!visited.has(conn.targetNodeId)
					) {
						queue.push(conn.targetNodeId);
					}
				}
			}
			return false;
		},
		[placedNodes, connections],
	);

	// Pipeline state
	const { isPipelineBroken, breakReason } = useMemo(() => {
		const hasRequestToResponse = findPath('request', 'response');
		const modelNode = placedNodes.find((n) => n.type === 'model');
		const dbNode = placedNodes.find((n) => n.type === 'database');
		const hasModelToDatabase =
			modelNode && dbNode ? findPath('model', 'database') : true;

		const broken = !hasRequestToResponse || !hasModelToDatabase;
		const reason = !hasRequestToResponse
			? 'No path from Request to Response'
			: !hasModelToDatabase
				? 'Model not connected to Database'
				: null;

		return { isPipelineBroken: broken, breakReason: reason };
	}, [findPath, placedNodes]);

	// Check if solution node is present for this level
	const hasSolutionNode = useMemo(() => {
		const challenge = levelChallenges[levelId];
		if (!challenge) return false;

		const solutionType = challenge.solutionNodeType;

		if (solutionType === 'multiple') {
			const hasEagerLoad = placedNodes.some((n) => n.type === 'eager_load');
			const hasCache = placedNodes.some((n) => n.type === 'cache');
			return hasEagerLoad && hasCache;
		}

		const hasSolution = placedNodes.some((n) => n.type === solutionType);
		const solutionConnected = connections.some((c) => {
			const source = placedNodes.find((n) => n.id === c.sourceNodeId);
			const target = placedNodes.find((n) => n.id === c.targetNodeId);
			return source?.type === solutionType || target?.type === solutionType;
		});

		return hasSolution && solutionConnected;
	}, [levelId, placedNodes, connections]);

	// Validate entire pipeline
	const validatePipeline = useCallback((): ValidationResult => {
		const errors: string[] = [];
		let score = 0;

		const types = placedNodes.map((n) => n.type);
		const hasRequest = types.includes('request');
		const hasRouter = types.includes('router');
		const hasController = types.includes('controller');
		const hasResponse = types.includes('response');

		if (!hasRequest) errors.push('Missing Request node (start of pipeline)');
		if (!hasRouter) errors.push('Missing Router node');
		if (!hasController) errors.push('Missing Controller node');
		if (!hasResponse) errors.push('Missing Response node (end of pipeline)');

		let validConnectionCount = 0;
		let invalidConnectionCount = 0;

		for (const conn of connections) {
			const sourceNode = placedNodes.find((n) => n.id === conn.sourceNodeId);
			const targetNode = placedNodes.find((n) => n.id === conn.targetNodeId);

			if (sourceNode && targetNode) {
				if (isValidConnection(sourceNode.type, targetNode.type)) {
					validConnectionCount++;
				} else {
					invalidConnectionCount++;
					errors.push(`Invalid: ${sourceNode.type} → ${targetNode.type}`);
				}
			}
		}

		const hasCompletePath = findPath('request', 'response');
		if (!hasCompletePath && hasRequest && hasResponse) {
			errors.push('No complete path from Request to Response');
		}

		if (hasRequest) score += 10;
		if (hasRouter) score += 10;
		if (hasController) score += 10;
		if (hasResponse) score += 10;
		score += validConnectionCount * 15;
		score -= invalidConnectionCount * 20;
		if (hasCompletePath) score += 30;
		if (types.includes('cache')) score += 10;
		if (types.filter((t) => t === 'model').length > 1) score += 10;

		return {
			valid: errors.length === 0 && hasCompletePath,
			errors,
			warnings: [],
			score: Math.max(0, Math.min(100, score)),
		};
	}, [placedNodes, connections, findPath]);

	// Evaluate a single success condition
	const evaluateCondition = useCallback(
		(
			condition: SuccessCondition,
			metrics?: LiveMetrics,
		): { passed: boolean; message: string } => {
			switch (condition.type) {
				case 'node_present': {
					const hasNode = placedNodes.some(
						(n) => n.type === condition.nodeType,
					);
					return {
						passed: hasNode,
						message: hasNode ? '' : `Missing ${condition.nodeType} node`,
					};
				}
				case 'node_absent': {
					const hasNode = placedNodes.some(
						(n) => n.type === condition.nodeType,
					);
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
					// Every node must be part of a connected path from request to response
					const reqNode = placedNodes.find((n) => n.type === 'request');
					const resNode = placedNodes.find((n) => n.type === 'response');
					if (!reqNode || !resNode) {
						return {
							passed: false,
							message: 'Missing Request or Response node',
						};
					}

					// BFS from request to find all reachable nodes
					const reachable = new Set<string>();
					const bfsQueue = [reqNode.id];
					while (bfsQueue.length > 0) {
						const id = bfsQueue.shift()!;
						if (reachable.has(id)) continue;
						reachable.add(id);
						for (const conn of connections) {
							if (
								conn.sourceNodeId === id &&
								!reachable.has(conn.targetNodeId)
							) {
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

					// Every placed node must be reachable from request
					const disconnected = placedNodes.filter((n) => !reachable.has(n.id));
					if (disconnected.length > 0) {
						return {
							passed: false,
							message: 'All nodes must be connected in the pipeline',
						};
					}

					return { passed: true, message: '' };
				}
				case 'metric': {
					// Metric conditions would be checked during simulation
					// For now, pass if the pipeline structure is correct
					return { passed: true, message: '' };
				}
				default:
					return { passed: true, message: '' };
			}
		},
		[placedNodes, connections],
	);

	// Check challenge-specific success condition
	const checkChallenge = useCallback(
		(metrics?: LiveMetrics): ValidationResult => {
			// First check legacy challenge format
			const challenge = levelChallenges[levelId];
			if (challenge) {
				const result = challenge.successCondition(placedNodes, connections);
				return {
					valid: result.success,
					errors: result.success ? [] : [result.message],
					warnings: [],
					score: result.success ? 100 : 0,
				};
			}

			// Then check new Level format from acts
			const level = getLevel(levelId);
			if (level?.successConditions) {
				const errors: string[] = [];
				let passedCount = 0;

				for (const condition of level.successConditions) {
					const result = evaluateCondition(condition);
					if (result.passed) {
						passedCount++;
					} else if (result.message) {
						errors.push(result.message);
					}
				}

				const allPassed = passedCount === level.successConditions.length;
				const score = Math.round(
					(passedCount / level.successConditions.length) * 100,
				);

				return {
					valid: allPassed,
					errors,
					warnings: [],
					score,
				};
			}

			// Fallback to general pipeline validation
			return validatePipeline();
		},
		[levelId, placedNodes, connections, evaluateCondition, validatePipeline],
	);

	return {
		isPipelineBroken,
		breakReason,
		hasSolutionNode,
		findPath,
		validatePipeline,
		checkChallenge,
	};
}
