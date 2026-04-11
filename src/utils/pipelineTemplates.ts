import type { PipelineState } from '@/types';

interface PipelineOptions {
	modelId?: string;
	modelLabel?: string;
}

/**
 * Standard 7-node pipeline with 2-row layout and serializer.
 *
 * Top row (y:220):    Request → Router → Controller → Model → Database
 * Bottom row (y:400):                    Serializer → Response
 *
 * Controller feeds both Model (right) and Serializer (down).
 */
export function standardPipeline(opts?: PipelineOptions): PipelineState {
	const modelId = opts?.modelId ?? 'model-node';
	return {
		nodes: [
			{ id: 'request-node', type: 'request', x: 100, y: 220, locked: true },
			{ id: 'router-node', type: 'router', x: 280, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 460,
				y: 220,
				locked: true,
			},
			{
				id: modelId,
				type: 'model',
				x: 660,
				y: 220,
				locked: true,
				...(opts?.modelLabel ? { config: { label: opts.modelLabel } } : {}),
			},
			{ id: 'database-node', type: 'database', x: 860, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 460,
				y: 400,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 660, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: modelId },
			{ id: 'c4', sourceNodeId: modelId, targetNodeId: 'database-node' },
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c6',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	};
}

/**
 * 8-node pipeline with middleware, 2-row layout, and serializer.
 *
 * Top row (y:220):    Request → Middleware → Router → Controller → Model → Database
 * Bottom row (y:400):                                 Serializer → Response
 *
 * Controller feeds both Model (right) and Serializer (down).
 */
export function middlewarePipeline(opts?: PipelineOptions): PipelineState {
	const modelId = opts?.modelId ?? 'model-node';
	return {
		nodes: [
			{ id: 'request-node', type: 'request', x: 60, y: 220, locked: true },
			{
				id: 'middleware-node',
				type: 'middleware',
				x: 220,
				y: 220,
				locked: true,
			},
			{ id: 'router-node', type: 'router', x: 380, y: 220, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 540,
				y: 220,
				locked: true,
			},
			{
				id: modelId,
				type: 'model',
				x: 720,
				y: 220,
				locked: true,
				...(opts?.modelLabel ? { config: { label: opts.modelLabel } } : {}),
			},
			{ id: 'database-node', type: 'database', x: 900, y: 220, locked: true },
			{
				id: 'serializer-node',
				type: 'serializer',
				x: 540,
				y: 400,
				locked: true,
			},
			{ id: 'response-node', type: 'response', x: 720, y: 400, locked: true },
		],
		connections: [
			{
				id: 'c1',
				sourceNodeId: 'request-node',
				targetNodeId: 'middleware-node',
			},
			{
				id: 'c2',
				sourceNodeId: 'middleware-node',
				targetNodeId: 'router-node',
			},
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: modelId },
			{ id: 'c5', sourceNodeId: modelId, targetNodeId: 'database-node' },
			{
				id: 'c6',
				sourceNodeId: 'controller-node',
				targetNodeId: 'serializer-node',
			},
			{
				id: 'c7',
				sourceNodeId: 'serializer-node',
				targetNodeId: 'response-node',
			},
		],
	};
}
