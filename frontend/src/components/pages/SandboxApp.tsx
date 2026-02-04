/**
 * Sandbox App Component
 *
 * Free-form pipeline builder for practice mode.
 */

import { useState } from 'react';
import { Button } from '../ui/Button';

interface NodeData {
	id: string;
	type: string;
	position: { x: number; y: number };
	config: Record<string, unknown>;
}

interface Connection {
	sourceNodeId: string;
	targetNodeId: string;
}

const nodeTypes = [
	{
		type: 'request',
		name: 'Request',
		color: '#3b82f6',
		description: 'Entry point for HTTP requests',
	},
	{
		type: 'router',
		name: 'Router',
		color: '#a78bfa',
		description: 'Routes requests to controllers',
	},
	{
		type: 'controller',
		name: 'Controller',
		color: '#10b981',
		description: 'Handles request logic',
	},
	{
		type: 'model',
		name: 'Model',
		color: '#f59e0b',
		description: 'ActiveRecord models',
	},
	{
		type: 'database',
		name: 'Database',
		color: '#ef4444',
		description: 'PostgreSQL/SQLite',
	},
	{
		type: 'cache',
		name: 'Cache',
		color: '#06b6d4',
		description: 'Redis/Memcached',
	},
	{
		type: 'view',
		name: 'View',
		color: '#a855f7',
		description: 'ERB/Jbuilder templates',
	},
	{
		type: 'response',
		name: 'Response',
		color: '#22c55e',
		description: 'Exit point for responses',
	},
	{
		type: 'background_job',
		name: 'Background Job',
		color: '#9333ea',
		description: 'Sidekiq/ActiveJob',
	},
];

export function SandboxApp() {
	const [nodes, setNodes] = useState<NodeData[]>([]);
	const [connections, setConnections] = useState<Connection[]>([]);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [isSimulating, setIsSimulating] = useState(false);

	function addNode(type: string) {
		const newNode: NodeData = {
			id: `node-${Date.now()}`,
			type,
			position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
			config: {},
		};
		setNodes([...nodes, newNode]);
	}

	function removeSelectedNode() {
		if (!selectedNodeId) return;
		setNodes(nodes.filter((n) => n.id !== selectedNodeId));
		setConnections(
			connections.filter(
				(c) =>
					c.sourceNodeId !== selectedNodeId &&
					c.targetNodeId !== selectedNodeId,
			),
		);
		setSelectedNodeId(null);
	}

	function clearCanvas() {
		setNodes([]);
		setConnections([]);
		setSelectedNodeId(null);
	}

	function toggleSimulation() {
		setIsSimulating(!isSimulating);
	}

	return (
		<div className="h-[calc(100vh-120px)] flex">
			{/* Left sidebar - Node Palette */}
			<div className="w-72 bg-card border-r border-border overflow-y-auto flex-shrink-0">
				<div className="p-4">
					<h2 className="text-lg font-bold text-foreground mb-2">
						Sandbox Mode
					</h2>
					<p className="text-xs text-muted-foreground mb-4">
						Free-form pipeline builder for practice. No objectives, no time
						limits.
					</p>

					<div className="mb-4">
						<Button asChild className="w-full">
							<a href="/acts">Back to Acts</a>
						</Button>
					</div>

					<h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
						Node Palette
					</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Click to add to canvas
					</p>

					<div className="space-y-2">
						{nodeTypes.map((nodeType) => (
							<Button
								className="w-full h-auto p-3 justify-start bg-secondary border border-border hover:border-muted-foreground hover:bg-secondary/80"
								key={nodeType.type}
								onClick={() => addNode(nodeType.type)}
								variant="ghost"
							>
								<div className="flex items-center gap-3">
									<div
										className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs"
										style={{ backgroundColor: nodeType.color, color: 'white' }}
									>
										{nodeType.name.slice(0, 2).toUpperCase()}
									</div>
									<div className="text-left">
										<div className="text-sm text-foreground font-medium">
											{nodeType.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{nodeType.description}
										</div>
									</div>
								</div>
							</Button>
						))}
					</div>
				</div>
			</div>

			{/* Main canvas area */}
			<div className="flex-1 flex flex-col">
				{/* Top toolbar */}
				<div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
					<div className="flex items-center gap-2">
						<Button onClick={clearCanvas} size="sm" variant="secondary">
							Clear All
						</Button>
						<Button
							disabled={!selectedNodeId}
							onClick={removeSelectedNode}
							size="sm"
							variant={selectedNodeId ? 'destructive' : 'outline'}
						>
							Delete Selected
						</Button>
					</div>

					<div className="flex items-center gap-4">
						<div className="text-sm text-muted-foreground">
							{nodes.length} nodes, {connections.length} connections
						</div>
						<Button
							className={
								isSimulating
									? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
									: 'bg-success text-success-foreground hover:bg-success/90'
							}
							onClick={toggleSimulation}
							size="sm"
						>
							{isSimulating ? 'Stop Simulation' : 'Start Simulation'}
						</Button>
					</div>
				</div>

				{/* Canvas */}
				<div className="flex-1 bg-background relative overflow-hidden">
					{/* Grid pattern */}
					<div
						className="absolute inset-0"
						style={{
							backgroundImage:
								'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
							backgroundSize: '40px 40px',
						}}
					/>

					{/* Nodes */}
					{nodes.map((node) => {
						const nodeType = nodeTypes.find((t) => t.type === node.type);
						const isSelected = node.id === selectedNodeId;

						return (
							<div
								className={`absolute cursor-pointer transition-shadow ${
									isSelected
										? 'ring-2 ring-warning ring-offset-2 ring-offset-background'
										: ''
								}`}
								key={node.id}
								onClick={() => setSelectedNodeId(node.id)}
								style={{
									left: node.position.x,
									top: node.position.y,
									transform: 'translate(-50%, -50%)',
								}}
							>
								<div
									className="w-40 rounded-lg border-2 overflow-hidden"
									style={{ borderColor: nodeType?.color || '#6b7280' }}
								>
									<div
										className="px-3 py-2 text-white text-sm font-medium"
										style={{ backgroundColor: nodeType?.color || '#6b7280' }}
									>
										{nodeType?.name || node.type}
									</div>
									<div className="bg-card px-3 py-2">
										<div className="text-xs text-muted-foreground">
											{nodeType?.description || ''}
										</div>
									</div>
								</div>
							</div>
						);
					})}

					{/* Empty state */}
					{nodes.length === 0 && (
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="text-center">
								<p className="text-muted-foreground text-lg mb-2">
									Sandbox Canvas
								</p>
								<p className="text-muted text-sm">
									Click nodes in the palette to add them
								</p>
								<p className="text-muted text-sm mt-1">
									Drag nodes to position them
								</p>
							</div>
						</div>
					)}

					{/* Simulation overlay */}
					{isSimulating && (
						<div className="absolute top-4 left-1/2 -translate-x-1/2 bg-success/90 text-success-foreground px-4 py-2 rounded-full text-sm font-medium animate-pulse">
							Simulation Running...
						</div>
					)}
				</div>
			</div>

			{/* Right sidebar - Inspector/Metrics */}
			<div className="w-80 bg-card border-l border-border overflow-y-auto flex-shrink-0">
				<div className="p-4">
					<h2 className="text-lg font-bold text-foreground mb-4">Inspector</h2>

					{selectedNodeId ? (
						<div>
							<h3 className="text-sm font-semibold text-foreground mb-2">
								Selected Node
							</h3>
							<div className="bg-secondary rounded-lg p-4">
								<p className="text-foreground">
									{nodes.find((n) => n.id === selectedNodeId)?.type}
								</p>
								<p className="text-xs text-muted-foreground mt-2">
									Click on node ports to create connections
								</p>
							</div>
						</div>
					) : (
						<div className="space-y-4">
							<div>
								<h3 className="text-sm font-semibold text-foreground mb-2">
									Metrics
								</h3>
								<div className="space-y-2">
									<div className="flex justify-between items-center p-2 bg-secondary rounded">
										<span className="text-xs text-muted-foreground">
											Latency p95
										</span>
										<span className="text-sm text-success font-mono">--ms</span>
									</div>
									<div className="flex justify-between items-center p-2 bg-secondary rounded">
										<span className="text-xs text-muted-foreground">
											Queries/Request
										</span>
										<span className="text-sm text-success font-mono">--</span>
									</div>
									<div className="flex justify-between items-center p-2 bg-secondary rounded">
										<span className="text-xs text-muted-foreground">
											Cache Hit Rate
										</span>
										<span className="text-sm text-muted-foreground font-mono">
											--%
										</span>
									</div>
									<div className="flex justify-between items-center p-2 bg-secondary rounded">
										<span className="text-xs text-muted-foreground">
											Error Rate
										</span>
										<span className="text-sm text-success font-mono">0%</span>
									</div>
								</div>
							</div>

							<div>
								<h3 className="text-sm font-semibold text-foreground mb-2">
									Tips
								</h3>
								<div className="bg-primary/10 border border-primary/20 rounded p-3 text-xs text-primary">
									<p className="mb-2">
										<strong>Sandbox mode</strong> is for practice!
									</p>
									<ul className="list-disc list-inside space-y-1 text-muted-foreground">
										<li>Try building a complete request flow</li>
										<li>Add caching to see hit rates improve</li>
										<li>Configure models with eager loading</li>
										<li>Watch metrics change as you optimize</li>
									</ul>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default SandboxApp;
