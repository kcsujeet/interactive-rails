/**
 * Pipeline State Hook
 * Manages nodes, connections, and drag interactions
 */

import {
	type DragEvent,
	type MouseEvent,
	type RefObject,
	useRef,
	useState,
} from 'react';
import type { Connection, PendingConnection, PlacedNode } from "@/types";

export interface UsePipelineStateReturn {
	placedNodes: PlacedNode[];
	setPlacedNodes: React.Dispatch<React.SetStateAction<PlacedNode[]>>;
	connections: Connection[];
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	selectedNodeId: string | null;
	setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
	pendingConnection: PendingConnection | null;
	draggingNodeId: string | null;
	draggedNodeType: string | null;
	canvasRef: RefObject<HTMLDivElement | null>;

	// Actions
	handleDragStart: (e: DragEvent<HTMLDivElement>, nodeType: string) => void;
	handleDragEnd: () => void;
	handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
	handleDrop: (e: DragEvent<HTMLDivElement>) => void;
	handleCanvasMouseMove: (e: MouseEvent) => void;
	handleCanvasMouseUp: () => void;
	handleCanvasClick: (e: MouseEvent) => void;
	handleNodeMouseDown: (e: MouseEvent, nodeId: string) => void;
	startConnection: (e: MouseEvent, nodeId: string) => void;
	completeConnection: (e: MouseEvent, targetNodeId: string) => void;
	updateNode: (nodeId: string, updates: Partial<PlacedNode>) => void;
	deleteConnection: (connectionId: string) => void;
	deleteSelectedNode: () => void;
	clearAllNodes: () => void;
}

export function usePipelineState(): UsePipelineStateReturn {
	const [placedNodes, setPlacedNodes] = useState<PlacedNode[]>([]);
	const [connections, setConnections] = useState<Connection[]>([]);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [pendingConnection, setPendingConnection] =
		useState<PendingConnection | null>(null);
	const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
	const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
		x: 0,
		y: 0,
	});
	const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);
	const canvasRef = useRef<HTMLDivElement>(null);

	// Drag handlers for palette nodes
	function handleDragStart(e: DragEvent<HTMLDivElement>, nodeType: string) {
		setDraggedNodeType(nodeType);
		e.dataTransfer.setData('text/plain', nodeType);
		e.dataTransfer.effectAllowed = 'copy';
	}

	function handleDragEnd() {
		setDraggedNodeType(null);
	}

	function handleDragOver(e: DragEvent<HTMLDivElement>) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	function handleDrop(e: DragEvent<HTMLDivElement>) {
		e.preventDefault();
		const nodeType = e.dataTransfer.getData('text/plain');

		if (!nodeType || !canvasRef.current) return;

		const rect = canvasRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const newNode: PlacedNode = {
			id: `node-${Date.now()}`,
			type: nodeType,
			x,
			y,
		};

		setPlacedNodes((prev) => [...prev, newNode]);
		setDraggedNodeType(null);
	}

	function handleCanvasMouseMove(e: MouseEvent) {
		if (!canvasRef.current) return;
		const rect = canvasRef.current.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		if (pendingConnection) {
			setPendingConnection({
				...pendingConnection,
				mouseX,
				mouseY,
			});
		}

		if (draggingNodeId) {
			setPlacedNodes((nodes) =>
				nodes.map((node) =>
					node.id === draggingNodeId
						? { ...node, x: mouseX - dragOffset.x, y: mouseY - dragOffset.y }
						: node,
				),
			);
		}
	}

	function handleCanvasMouseUp() {
		setPendingConnection(null);
		setDraggingNodeId(null);
	}

	function handleCanvasClick(e: MouseEvent) {
		// Only clear selection if clicking directly on the canvas (not on a node or connection)
		if (
			e.target === canvasRef.current ||
			(e.target as HTMLElement).closest('[data-canvas-bg]')
		) {
			setSelectedNodeId(null);
		}
	}

	function handleNodeMouseDown(e: MouseEvent, nodeId: string) {
		if ((e.target as HTMLElement).closest('[data-port]')) return;

		e.stopPropagation();
		const node = placedNodes.find((n) => n.id === nodeId);
		if (!node || !canvasRef.current) return;

		const rect = canvasRef.current.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		setDraggingNodeId(nodeId);
		setDragOffset({ x: mouseX - node.x, y: mouseY - node.y });
		setSelectedNodeId(nodeId);
	}

	function startConnection(e: MouseEvent, nodeId: string) {
		e.stopPropagation();
		if (!canvasRef.current) return;

		const rect = canvasRef.current.getBoundingClientRect();
		setPendingConnection({
			sourceNodeId: nodeId,
			mouseX: e.clientX - rect.left,
			mouseY: e.clientY - rect.top,
		});
	}

	function completeConnection(e: MouseEvent, targetNodeId: string) {
		e.stopPropagation();
		if (!pendingConnection) return;

		if (pendingConnection.sourceNodeId === targetNodeId) {
			setPendingConnection(null);
			return;
		}

		const exists = connections.some(
			(c) =>
				(c.sourceNodeId === pendingConnection.sourceNodeId &&
					c.targetNodeId === targetNodeId) ||
				(c.sourceNodeId === targetNodeId &&
					c.targetNodeId === pendingConnection.sourceNodeId),
		);

		if (!exists) {
			// Create the connection
			const newConnection = {
				id: `conn-${Date.now()}`,
				sourceNodeId: pendingConnection.sourceNodeId,
				targetNodeId,
			};

			setConnections((prev) => [...prev, newConnection]);

			// NEW: Stack Choice Logic (Level 1)
			// Check if we just connected the Terminal to a Tech Choice
			const sourceNode = placedNodes.find(
				(n) => n.id === pendingConnection.sourceNodeId,
			);
			const targetNode = placedNodes.find((n) => n.id === targetNodeId);

			if (sourceNode?.type === 'terminal' || targetNode?.type === 'terminal') {
				const otherNode =
					sourceNode?.type === 'terminal' ? targetNode : sourceNode;
				if (otherNode) {
					// We need to persist this choice.
					// Ideally, we'd emit an event here, but for now we'll let the LevelPlayApp scan the graph on submit.
					// However, we can enforce "Only 1 DB" here if we wanted.
					// For now, let's keep it simple and just allow the connection.
				}
			}
		}

		setPendingConnection(null);
	}

	function updateNode(nodeId: string, updates: Partial<PlacedNode>) {
		setPlacedNodes((prev) =>
			prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
		);
	}

	function deleteConnection(connectionId: string) {
		setConnections((prev) => prev.filter((c) => c.id !== connectionId));
	}

	function deleteSelectedNode() {
		if (!selectedNodeId) return;
		setPlacedNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
		setConnections((prev) =>
			prev.filter(
				(c) =>
					c.sourceNodeId !== selectedNodeId &&
					c.targetNodeId !== selectedNodeId,
			),
		);
		setSelectedNodeId(null);
	}

	function clearAllNodes() {
		setPlacedNodes([]);
		setConnections([]);
		setSelectedNodeId(null);
	}

	return {
		placedNodes,
		setPlacedNodes,
		connections,
		setConnections,
		selectedNodeId,
		setSelectedNodeId,
		pendingConnection,
		draggingNodeId,
		draggedNodeType,
		canvasRef,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDrop,
		handleCanvasMouseMove,
		handleCanvasMouseUp,
		handleCanvasClick,
		handleNodeMouseDown,
		startConnection,
		completeConnection,
		updateNode,
		deleteConnection,
		deleteSelectedNode,
		clearAllNodes,
	};
}
