/**
 * Pipeline Store
 *
 * Manages the state of the visual pipeline editor including:
 * - Nodes and their configurations
 * - Connections between nodes
 * - Selection state
 * - Undo/redo history
 *
 * Uses React Flow's internal types for compatibility.
 */

import type {
	Connection,
	Edge,
	EdgeChange,
	Node,
	NodeChange,
	XYPosition,
} from '@xyflow/react';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// Types
// ============================================

export type NodeType =
	| 'request'
	| 'router'
	| 'controller'
	| 'model'
	| 'database'
	| 'cache'
	| 'view'
	| 'response'
	| 'background_job';

export interface PipelineNodeData extends Record<string, unknown> {
	label: string;
	nodeType: NodeType;
	config: Record<string, unknown>;
	metrics?: {
		processTime: number;
		queryCount: number;
		cacheHits: number;
		errorCount: number;
	};
	status: 'idle' | 'processing' | 'error' | 'success';
}

export type PipelineNode = Node<PipelineNodeData>;
export type PipelineEdge = Edge<{
	animated?: boolean;
	dataFlow?: {
		requestsPerSecond: number;
		avgLatency: number;
	};
}>;

interface HistoryState {
	nodes: PipelineNode[];
	edges: PipelineEdge[];
}

export interface PipelineState {
	// Core state
	nodes: PipelineNode[];
	edges: PipelineEdge[];

	// Selection
	selectedNodeIds: string[];
	selectedEdgeIds: string[];

	// Metadata
	pipelineId: string | null;
	pipelineName: string;
	isDirty: boolean;

	// Validation
	isValid: boolean;
	validationErrors: string[];

	// History
	history: HistoryState[];
	historyIndex: number;
	maxHistorySize: number;

	// Actions - Node operations
	addNode: (type: NodeType, position: XYPosition) => string;
	removeNode: (nodeId: string) => void;
	updateNodeData: (nodeId: string, data: Partial<PipelineNodeData>) => void;
	updateNodePosition: (nodeId: string, position: XYPosition) => void;

	// Actions - Edge operations
	addEdge: (connection: Connection) => boolean;
	removeEdge: (edgeId: string) => void;

	// Actions - React Flow callbacks
	onNodesChange: (changes: NodeChange<PipelineNode>[]) => void;
	onEdgesChange: (changes: EdgeChange<PipelineEdge>[]) => void;
	onConnect: (connection: Connection) => void;

	// Actions - Selection
	selectNode: (nodeId: string | null, additive?: boolean) => void;
	selectEdge: (edgeId: string | null, additive?: boolean) => void;
	clearSelection: () => void;

	// Actions - History
	undo: () => void;
	redo: () => void;
	saveToHistory: () => void;

	// Actions - Pipeline operations
	loadPipeline: (
		id: string,
		name: string,
		nodes: PipelineNode[],
		edges: PipelineEdge[],
	) => void;
	clearPipeline: () => void;
	resetPipeline: () => void;

	// Actions - Validation
	validate: () => void;
}

// ============================================
// Node Defaults
// ============================================

const NODE_DEFAULTS: Record<NodeType, { label: string; color: string }> = {
	request: { label: 'Request', color: '#3b82f6' },
	router: { label: 'Router', color: '#a78bfa' },
	controller: { label: 'Controller', color: '#10b981' },
	model: { label: 'Model', color: '#f59e0b' },
	database: { label: 'Database', color: '#ef4444' },
	cache: { label: 'Cache', color: '#06b6d4' },
	view: { label: 'View', color: '#a855f7' },
	response: { label: 'Response', color: '#22c55e' },
	background_job: { label: 'Background Job', color: '#9333ea' },
};

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
	return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createNode(type: NodeType, position: XYPosition): PipelineNode {
	const defaults = NODE_DEFAULTS[type];
	return {
		id: generateId(),
		type,
		position,
		data: {
			label: defaults.label,
			nodeType: type,
			config: {},
			status: 'idle',
		},
	};
}

function validatePipeline(
	nodes: PipelineNode[],
	edges: PipelineEdge[],
): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Check for request node
	const hasRequest = nodes.some((n) => n.data.nodeType === 'request');
	if (!hasRequest) {
		errors.push('Pipeline must have a Request node');
	}

	// Check for response node
	const hasResponse = nodes.some((n) => n.data.nodeType === 'response');
	if (!hasResponse) {
		errors.push('Pipeline must have a Response node');
	}

	// Check for disconnected nodes (except request)
	const connectedNodeIds = new Set<string>();
	for (const edge of edges) {
		connectedNodeIds.add(edge.source);
		connectedNodeIds.add(edge.target);
	}

	for (const node of nodes) {
		if (node.data.nodeType === 'request') continue;
		if (!connectedNodeIds.has(node.id)) {
			errors.push(
				`Node "${node.data.label}" (${node.id.slice(0, 8)}) is not connected`,
			);
		}
	}

	// Check for cycles (simple check)
	const visited = new Set<string>();
	const visiting = new Set<string>();

	function hasCycle(nodeId: string): boolean {
		if (visiting.has(nodeId)) return true;
		if (visited.has(nodeId)) return false;

		visiting.add(nodeId);

		const outgoingEdges = edges.filter((e) => e.source === nodeId);
		for (const edge of outgoingEdges) {
			if (hasCycle(edge.target)) return true;
		}

		visiting.delete(nodeId);
		visited.add(nodeId);
		return false;
	}

	const requestNode = nodes.find((n) => n.data.nodeType === 'request');
	if (requestNode && hasCycle(requestNode.id)) {
		errors.push('Pipeline contains a cycle');
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

// ============================================
// Store
// ============================================

export const usePipelineStore = create<PipelineState>()(
	devtools(
		subscribeWithSelector(
			immer((set, get) => ({
				// Initial state
				nodes: [],
				edges: [],
				selectedNodeIds: [],
				selectedEdgeIds: [],
				pipelineId: null,
				pipelineName: 'Untitled Pipeline',
				isDirty: false,
				isValid: true,
				validationErrors: [],
				history: [],
				historyIndex: -1,
				maxHistorySize: 50,

				// Node operations
				addNode: (type, position) => {
					const node = createNode(type, position);
					set((state) => {
						state.saveToHistory();
						state.nodes.push(node);
						state.isDirty = true;
					});
					get().validate();
					return node.id;
				},

				removeNode: (nodeId) => {
					set((state) => {
						state.saveToHistory();
						state.nodes = state.nodes.filter((n) => n.id !== nodeId);
						state.edges = state.edges.filter(
							(e) => e.source !== nodeId && e.target !== nodeId,
						);
						state.selectedNodeIds = state.selectedNodeIds.filter(
							(id) => id !== nodeId,
						);
						state.isDirty = true;
					});
					get().validate();
				},

				updateNodeData: (nodeId, data) => {
					set((state) => {
						const node = state.nodes.find((n) => n.id === nodeId);
						if (node) {
							node.data = { ...node.data, ...data };
							state.isDirty = true;
						}
					});
				},

				updateNodePosition: (nodeId, position) => {
					set((state) => {
						const node = state.nodes.find((n) => n.id === nodeId);
						if (node) {
							node.position = position;
						}
					});
				},

				// Edge operations
				addEdge: (connection) => {
					const { source, target, sourceHandle, targetHandle } = connection;
					if (!source || !target) return false;

					// Check for existing connection
					const edges = get().edges;
					const exists = edges.some(
						(e) =>
							e.source === source &&
							e.target === target &&
							e.sourceHandle === sourceHandle &&
							e.targetHandle === targetHandle,
					);
					if (exists) return false;

					// Check for self-connection
					if (source === target) return false;

					set((state) => {
						state.saveToHistory();
						state.edges = addEdge(
							{
								...connection,
								id: `edge_${source}_${target}_${Date.now()}`,
								type: 'smoothstep',
								animated: true,
							},
							state.edges,
						);
						state.isDirty = true;
					});
					get().validate();
					return true;
				},

				removeEdge: (edgeId) => {
					set((state) => {
						state.saveToHistory();
						state.edges = state.edges.filter((e) => e.id !== edgeId);
						state.selectedEdgeIds = state.selectedEdgeIds.filter(
							(id) => id !== edgeId,
						);
						state.isDirty = true;
					});
					get().validate();
				},

				// React Flow callbacks
				onNodesChange: (changes) => {
					set((state) => {
						state.nodes = applyNodeChanges(
							changes,
							state.nodes,
						) as PipelineNode[];
					});
				},

				onEdgesChange: (changes) => {
					set((state) => {
						state.edges = applyEdgeChanges(
							changes,
							state.edges,
						) as PipelineEdge[];
					});
				},

				onConnect: (connection) => {
					get().addEdge(connection);
				},

				// Selection
				selectNode: (nodeId, additive = false) => {
					set((state) => {
						if (nodeId === null) {
							state.selectedNodeIds = [];
						} else if (additive) {
							const index = state.selectedNodeIds.indexOf(nodeId);
							if (index === -1) {
								state.selectedNodeIds.push(nodeId);
							} else {
								state.selectedNodeIds.splice(index, 1);
							}
						} else {
							state.selectedNodeIds = [nodeId];
						}
						state.selectedEdgeIds = [];
					});
				},

				selectEdge: (edgeId, additive = false) => {
					set((state) => {
						if (edgeId === null) {
							state.selectedEdgeIds = [];
						} else if (additive) {
							const index = state.selectedEdgeIds.indexOf(edgeId);
							if (index === -1) {
								state.selectedEdgeIds.push(edgeId);
							} else {
								state.selectedEdgeIds.splice(index, 1);
							}
						} else {
							state.selectedEdgeIds = [edgeId];
						}
						state.selectedNodeIds = [];
					});
				},

				clearSelection: () => {
					set((state) => {
						state.selectedNodeIds = [];
						state.selectedEdgeIds = [];
					});
				},

				// History
				saveToHistory: () => {
					set((state) => {
						// Remove any future history if we're not at the end
						if (state.historyIndex < state.history.length - 1) {
							state.history = state.history.slice(0, state.historyIndex + 1);
						}

						// Add current state to history
						state.history.push({
							nodes: JSON.parse(JSON.stringify(state.nodes)),
							edges: JSON.parse(JSON.stringify(state.edges)),
						});

						// Limit history size
						if (state.history.length > state.maxHistorySize) {
							state.history.shift();
						}

						state.historyIndex = state.history.length - 1;
					});
				},

				undo: () => {
					const { historyIndex, history } = get();
					if (historyIndex <= 0) return;

					set((state) => {
						const prevState = history[historyIndex - 1];
						state.nodes = JSON.parse(JSON.stringify(prevState.nodes));
						state.edges = JSON.parse(JSON.stringify(prevState.edges));
						state.historyIndex = historyIndex - 1;
						state.isDirty = true;
					});
					get().validate();
				},

				redo: () => {
					const { historyIndex, history } = get();
					if (historyIndex >= history.length - 1) return;

					set((state) => {
						const nextState = history[historyIndex + 1];
						state.nodes = JSON.parse(JSON.stringify(nextState.nodes));
						state.edges = JSON.parse(JSON.stringify(nextState.edges));
						state.historyIndex = historyIndex + 1;
						state.isDirty = true;
					});
					get().validate();
				},

				// Pipeline operations
				loadPipeline: (id, name, nodes, edges) => {
					set((state) => {
						state.pipelineId = id;
						state.pipelineName = name;
						state.nodes = nodes;
						state.edges = edges;
						state.selectedNodeIds = [];
						state.selectedEdgeIds = [];
						state.isDirty = false;
						state.history = [];
						state.historyIndex = -1;
					});
					get().validate();
				},

				clearPipeline: () => {
					set((state) => {
						state.saveToHistory();
						state.nodes = [];
						state.edges = [];
						state.selectedNodeIds = [];
						state.selectedEdgeIds = [];
						state.isDirty = true;
					});
					get().validate();
				},

				resetPipeline: () => {
					set((state) => {
						state.pipelineId = null;
						state.pipelineName = 'Untitled Pipeline';
						state.nodes = [];
						state.edges = [];
						state.selectedNodeIds = [];
						state.selectedEdgeIds = [];
						state.isDirty = false;
						state.isValid = true;
						state.validationErrors = [];
						state.history = [];
						state.historyIndex = -1;
					});
				},

				// Validation
				validate: () => {
					const { nodes, edges } = get();
					const result = validatePipeline(nodes, edges);
					set((state) => {
						state.isValid = result.isValid;
						state.validationErrors = result.errors;
					});
				},
			})),
		),
		{ name: 'pipeline-store' },
	),
);

// ============================================
// Selectors
// ============================================

export const selectSelectedNodes = (state: PipelineState) =>
	state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));

export const selectSelectedEdges = (state: PipelineState) =>
	state.edges.filter((e) => state.selectedEdgeIds.includes(e.id));

export const selectNodeById = (nodeId: string) => (state: PipelineState) =>
	state.nodes.find((n) => n.id === nodeId);

export const selectCanUndo = (state: PipelineState) => state.historyIndex > 0;

export const selectCanRedo = (state: PipelineState) =>
	state.historyIndex < state.history.length - 1;
