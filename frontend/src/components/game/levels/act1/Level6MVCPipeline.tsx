/**
 * Level 6: The MVC Pipeline
 *
 * Build the complete MVC pipeline. Ghost particles "poof" when hitting dead ends.
 * Success when full Request -> Response path is complete.
 *
 * This is the capstone of Act 1 - combining everything learned in levels 2-5.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../ui/Button';
import type { LevelComponentProps } from '../index';
import {
	CanvasNode,
	CenterPanel,
	CodePreviewPanel,
	ConnectionLayer,
	DraggableNode,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	NodePalette,
	NodePaletteGroup,
	RightPanel,
	useLevelCompletion,
} from '../shared';

interface PlacedNode {
	id: string;
	type: string;
	x: number;
	y: number;
}

interface Connection {
	id: string;
	sourceId: string;
	targetId: string;
}

// Node definitions for this level
const NODE_DEFS: Record<
	string,
	{ name: string; icon: string; color: string; description: string }
> = {
	request: {
		name: 'Request',
		icon: 'R',
		color: '#22c55e',
		description: 'HTTP request from browser',
	},
	router: {
		name: 'Router',
		icon: '/',
		color: '#f59e0b',
		description: 'routes.rb - URL mapping',
	},
	controller: {
		name: 'Controller',
		icon: 'C',
		color: '#3b82f6',
		description: 'Handles request logic',
	},
	model: {
		name: 'Model',
		icon: 'M',
		color: '#8b5cf6',
		description: 'ActiveRecord data layer',
	},
	database: {
		name: 'Database',
		icon: 'D',
		color: '#06b6d4',
		description: 'PostgreSQL/SQLite storage',
	},
	view: {
		name: 'View',
		icon: 'V',
		color: '#ec4899',
		description: 'ERB template rendering',
	},
	response: {
		name: 'Response',
		icon: 'R',
		color: '#10b981',
		description: 'HTML sent to browser',
	},
};

// Expected connections for validation
const EXPECTED_PATH = [
	{ from: 'request', to: 'router' },
	{ from: 'router', to: 'controller' },
	{ from: 'controller', to: 'model' },
	{ from: 'model', to: 'database' },
	{ from: 'database', to: 'view' },
	{ from: 'view', to: 'response' },
];

export function Level6MVCPipeline({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// Nodes and connections state
	const [placedNodes, setPlacedNodes] = useState<PlacedNode[]>([
		{ id: 'request-1', type: 'request', x: 100, y: 300 },
	]);
	const [connections, setConnections] = useState<Connection[]>([]);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [pendingConnection, setPendingConnection] = useState<{
		sourceId: string;
		x: number;
		y: number;
	} | null>(null);
	const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);
	const canvasRef = useRef<HTMLDivElement>(null);

	// Particle state for ghost particles
	const [particles, setParticles] = useState<
		Array<{
			id: string;
			x: number;
			y: number;
			targetX: number;
			targetY: number;
			progress: number;
			state: 'moving' | 'poof' | 'success';
		}>
	>([]);

	// Check if level is complete
	const isComplete = useCallback(() => {
		// Check if all required node types are present
		const nodeTypes = new Set(placedNodes.map((n) => n.type));
		const requiredTypes = [
			'request',
			'router',
			'controller',
			'model',
			'database',
			'view',
			'response',
		];
		if (!requiredTypes.every((t) => nodeTypes.has(t))) return false;

		// Check if all required connections exist
		for (const expected of EXPECTED_PATH) {
			const sourceNode = placedNodes.find((n) => n.type === expected.from);
			const targetNode = placedNodes.find((n) => n.type === expected.to);
			if (!sourceNode || !targetNode) return false;

			const hasConnection = connections.some(
				(c) => c.sourceId === sourceNode.id && c.targetId === targetNode.id,
			);
			if (!hasConnection) return false;
		}

		return true;
	}, [placedNodes, connections]);

	// Spawn particles from request node
	useEffect(() => {
		const interval = setInterval(() => {
			const requestNode = placedNodes.find((n) => n.type === 'request');
			if (!requestNode) return;

			// Find next node in path
			const conn = connections.find((c) => c.sourceId === requestNode.id);
			if (!conn) {
				// No connection - spawn poof particle
				const id = `particle-${Date.now()}`;
				setParticles((prev) => [
					...prev,
					{
						id,
						x: requestNode.x + 60,
						y: requestNode.y,
						targetX: requestNode.x + 150,
						targetY: requestNode.y,
						progress: 0,
						state: 'poof',
					},
				]);
			} else {
				// Has connection - trace the path
				const targetNode = placedNodes.find((n) => n.id === conn.targetId);
				if (targetNode) {
					const id = `particle-${Date.now()}`;
					setParticles((prev) => [
						...prev,
						{
							id,
							x: requestNode.x + 60,
							y: requestNode.y,
							targetX: targetNode.x - 60,
							targetY: targetNode.y,
							progress: 0,
							state: isComplete() ? 'success' : 'moving',
						},
					]);
				}
			}
		}, 1500);

		return () => clearInterval(interval);
	}, [placedNodes, connections, isComplete]);

	// Animate particles
	useEffect(() => {
		const interval = setInterval(() => {
			setParticles((prev) =>
				prev
					.map((p) => ({
						...p,
						progress: Math.min(1, p.progress + 0.05),
					}))
					.filter(
						(p) => p.progress < 1 || (p.state === 'poof' && p.progress < 1.5),
					),
			);
		}, 50);

		return () => clearInterval(interval);
	}, []);

	// Handle completing the level
	const handleComplete = async () => {
		const success = await completeLevel('act1-level6-mvc-pipeline', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Drag handlers
	const handleDragStart = (e: React.DragEvent, type: string) => {
		e.dataTransfer.setData('nodeType', type);
		setDraggedNodeType(type);
	};

	const handleDragEnd = () => {
		setDraggedNodeType(null);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		const nodeType = e.dataTransfer.getData('nodeType');
		if (!nodeType || !canvasRef.current) return;

		// Check if this node type is already placed (only allow one of each)
		if (placedNodes.some((n) => n.type === nodeType)) return;

		const rect = canvasRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const newNode: PlacedNode = {
			id: `${nodeType}-${Date.now()}`,
			type: nodeType,
			x,
			y,
		};

		setPlacedNodes((prev) => [...prev, newNode]);
		setDraggedNodeType(null);
	};

	// Connection handlers
	const handleStartConnection = (nodeId: string, point: 'input' | 'output') => {
		// Only allow starting connections from output points
		if (point !== 'output') return;

		const node = placedNodes.find((n) => n.id === nodeId);
		if (node) {
			setPendingConnection({ sourceId: nodeId, x: node.x + 60, y: node.y });
		}
	};

	const handleCompleteConnection = (
		targetId: string,
		point: 'input' | 'output',
	) => {
		// Only allow completing connections to input points
		if (point !== 'input') return;

		if (pendingConnection && pendingConnection.sourceId !== targetId) {
			// Check if connection already exists
			const exists = connections.some(
				(c) =>
					c.sourceId === pendingConnection.sourceId && c.targetId === targetId,
			);
			if (!exists) {
				setConnections((prev) => [
					...prev,
					{
						id: `conn-${Date.now()}`,
						sourceId: pendingConnection.sourceId,
						targetId,
					},
				]);
			}
		}
		setPendingConnection(null);
	};

	const handleCanvasMouseMove = (e: React.MouseEvent) => {
		if (pendingConnection && canvasRef.current) {
			const rect = canvasRef.current.getBoundingClientRect();
			setPendingConnection({
				...pendingConnection,
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			});
		}
	};

	const handleCanvasClick = () => {
		setSelectedNodeId(null);
		setPendingConnection(null);
	};

	const handleNodeDrag = (id: string, x: number, y: number) => {
		setPlacedNodes((prev) =>
			prev.map((n) => (n.id === id ? { ...n, x, y } : n)),
		);
	};

	// Delete connection
	const deleteConnection = (connId: string) => {
		setConnections((prev) => prev.filter((c) => c.id !== connId));
	};

	// Generate code preview
	const getCodeFiles = () => {
		const files = [];

		// Routes file
		const hasRouter = placedNodes.some((n) => n.type === 'router');
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: hasRouter
				? `Rails.application.routes.draw do
  resources :posts
  root "posts#index"
end`
				: `# No routes defined yet
# Add a Router node to configure routes`,
			highlight: hasRouter ? [2, 3] : [],
		});

		// Controller file
		const hasController = placedNodes.some((n) => n.type === 'controller');
		const hasModel = placedNodes.some((n) => n.type === 'model');
		if (hasController) {
			files.push({
				filename: 'app/controllers/posts_controller.rb',
				language: 'ruby',
				code: `class PostsController < ApplicationController
  def index
    ${hasModel ? '@posts = Post.all' : '# No model connected'}
  end
end`,
				highlight: hasModel ? [3] : [],
			});
		}

		// View file
		const hasView = placedNodes.some((n) => n.type === 'view');
		if (hasView) {
			files.push({
				filename: 'app/views/posts/index.html.erb',
				language: 'ruby',
				code: `<h1>Posts</h1>
<% @posts.each do |post| %>
  <article>
    <h2><%= post.title %></h2>
    <p><%= post.body %></p>
  </article>
<% end %>`,
				highlight: [2, 3, 4, 5, 6],
			});
		}

		return files;
	};

	// Get connection coordinates
	const getConnectionCoords = () => {
		return connections
			.map((conn) => {
				const source = placedNodes.find((n) => n.id === conn.sourceId);
				const target = placedNodes.find((n) => n.id === conn.targetId);
				if (!source || !target) return null;
				return {
					id: conn.id,
					startX: source.x + 60,
					startY: source.y,
					endX: target.x - 60,
					endY: target.y,
					color: isComplete() ? '#22c55e' : '#6b7280',
					animated: true,
				};
			})
			.filter(Boolean) as Array<{
			id: string;
			startX: number;
			startY: number;
			endX: number;
			endY: number;
			color: string;
			animated: boolean;
		}>;
	};

	// Available nodes (not yet placed)
	const availableNodes = [
		'router',
		'controller',
		'model',
		'database',
		'view',
		'response',
	].filter((type) => !placedNodes.some((n) => n.type === type));

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Understand how a complete Rails request flows through MVC. This is the foundation for everything else."
					instructions={[
						'Drag nodes from the palette to the canvas',
						'Connect nodes by clicking the connection points',
						'Build: Request → Router → Controller → Model → Database → View → Response',
						'Watch particles flow through your complete pipeline!',
					]}
					scenario="Time to put it all together! Build the complete Rails MVC request/response cycle. You've learned each piece - now connect them."
				>
					<NodePalette title="MVC Components">
						<NodePaletteGroup title="Pipeline Nodes">
							{availableNodes.map((type) => {
								const def = NODE_DEFS[type];
								return (
									<DraggableNode
										color={def.color}
										description={def.description}
										icon={def.icon}
										key={type}
										name={def.name}
										onDragEnd={handleDragEnd}
										onDragStart={handleDragStart}
										type={type}
									/>
								);
							})}
						</NodePaletteGroup>

						{availableNodes.length === 0 && (
							<div className="text-sm text-muted-foreground text-center py-4">
								All nodes placed! Now connect them.
							</div>
						)}
					</NodePalette>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="The MVC Pipeline"
					levelNumber={6}
					onExit={onExit}
					onReset={() => {
						setPlacedNodes([
							{ id: 'request-1', type: 'request', x: 100, y: 300 },
						]);
						setConnections([]);
					}}
				/>

				{/* Canvas */}
				<div
					className="flex-1 relative bg-background overflow-hidden"
					onClick={handleCanvasClick}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onMouseMove={handleCanvasMouseMove}
					ref={canvasRef}
				>
					{/* Grid background */}
					<div
						className="absolute inset-0 opacity-10"
						style={{
							backgroundImage:
								'radial-gradient(circle, #374151 1px, transparent 1px)',
							backgroundSize: '30px 30px',
						}}
					/>

					{/* Connections SVG layer */}
					<ConnectionLayer
						connections={getConnectionCoords()}
						onConnectionClick={deleteConnection}
						pendingConnection={
							pendingConnection
								? {
										startX:
											placedNodes.find(
												(n) => n.id === pendingConnection.sourceId,
											)!.x + 60,
										startY: placedNodes.find(
											(n) => n.id === pendingConnection.sourceId,
										)!.y,
										endX: pendingConnection.x,
										endY: pendingConnection.y,
									}
								: null
						}
						selectedConnectionId={null}
					/>

					{/* Particles */}
					<svg className="absolute inset-0 pointer-events-none overflow-visible">
						{particles.map((p) => {
							const currentX = p.x + (p.targetX - p.x) * p.progress;
							const currentY = p.y + (p.targetY - p.y) * p.progress;
							const opacity =
								p.state === 'poof' ? Math.max(0, 1 - p.progress) : 1;

							if (p.state === 'poof') {
								// Poof effect - expanding red circles
								return (
									<g key={p.id}>
										{[0, 1, 2, 3, 4].map((i) => {
											const angle = (i / 5) * Math.PI * 2 + p.progress * 2;
											const distance = p.progress * 30;
											const px = currentX + Math.cos(angle) * distance;
											const py = currentY + Math.sin(angle) * distance;
											return (
												<circle
													cx={px}
													cy={py}
													fill="#ef4444"
													key={i}
													opacity={opacity * 0.8}
													r={4 * (1 - p.progress * 0.5)}
												/>
											);
										})}
										<text
											fill="#ef4444"
											fontSize="12"
											opacity={opacity}
											textAnchor="middle"
											x={currentX}
											y={currentY - 20}
										>
											poof!
										</text>
									</g>
								);
							}

							// Normal particle
							const color = p.state === 'success' ? '#22c55e' : '#f59e0b';
							return (
								<g key={p.id}>
									<circle cx={currentX} cy={currentY} fill={color} r="6" />
									<circle
										cx={currentX}
										cy={currentY}
										fill={color}
										opacity="0.3"
										r="10"
									/>
								</g>
							);
						})}
					</svg>

					{/* Placed nodes */}
					{placedNodes.map((node) => {
						const def = NODE_DEFS[node.type];
						return (
							<CanvasNode
								color={def.color}
								icon={def.icon}
								id={node.id}
								key={node.id}
								locked={node.type === 'request'}
								name={def.name}
								onCompleteConnection={handleCompleteConnection}
								onDrag={handleNodeDrag}
								onSelect={setSelectedNodeId}
								onStartConnection={handleStartConnection}
								selected={selectedNodeId === node.id}
								type={node.type}
								x={node.x}
								y={node.y}
							/>
						);
					})}

					{/* Completion overlay */}
					{isComplete() && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
							<Button
								className="bg-success hover:bg-success/90 text-foreground font-bold shadow-lg shadow-success/30"
								onClick={handleComplete}
								size="lg"
							>
								Complete Level
							</Button>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="The complete Rails MVC cycle: Request → Router → Controller → Model → Database → View → Response. This is the foundation of every Rails app."
				>
					{/* Status */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Pipeline Status
						</div>
						<div className="space-y-1 text-sm">
							{[
								'router',
								'controller',
								'model',
								'database',
								'view',
								'response',
							].map((type) => {
								const hasNode = placedNodes.some((n) => n.type === type);
								return (
									<div
										className={`flex items-center gap-2 ${hasNode ? 'text-success' : 'text-muted-foreground'}`}
										key={type}
									>
										<span>{hasNode ? '+' : '-'}</span>
										<span>{NODE_DEFS[type].name}</span>
									</div>
								);
							})}
						</div>
					</div>

					{/* Act 1 Summary */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Act 1 Complete!
						</div>
						<div className="text-xs text-muted-foreground space-y-1">
							<div>+ Models define your data</div>
							<div>+ CRUD operations manipulate data</div>
							<div>+ Controllers handle requests</div>
							<div>+ Views render responses</div>
							<div>+ MVC connects everything</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level6MVCPipeline;
