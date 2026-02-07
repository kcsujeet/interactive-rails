/**
 * Level 2: The First Request
 *
 * Build the MVC pipeline. Ghost particles "poof" when hitting dead ends.
 * Success when full Request -> Response path is complete.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PipelineCanvas } from '@/components/PipelineCanvas';
import { usePipelineState } from '@/hooks/usePipelineState';
import { getNodeInfo } from '@/utils/gameData';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	CenterPanel,
	CodePreviewPanel,
	DraggableNode,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	NodePalette,
	NodePaletteGroup,
	RightPanel,
	useLevelCompletion,
} from '@/components/levels';

// Expected connections for validation
const EXPECTED_PATH = [
	{ from: 'request', to: 'router' },
	{ from: 'router', to: 'controller' },
	{ from: 'controller', to: 'model' },
	{ from: 'model', to: 'database' },
	{ from: 'database', to: 'view' },
	{ from: 'view', to: 'response' },
];

const AVAILABLE_TYPES = ['router', 'controller', 'model', 'database', 'view', 'response'];

export function Level2FirstRequest({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	const pipeline = usePipelineState({
		initialNodes: [{ id: 'request-1', type: 'request', x: 100, y: 300 }],
		onBeforeDrop: (type, nodes) => !nodes.some((n) => n.type === type),
	});

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
		const nodeTypes = new Set(pipeline.placedNodes.map((n) => n.type));
		const requiredTypes = ['request', 'router', 'controller', 'model', 'database', 'view', 'response'];
		if (!requiredTypes.every((t) => nodeTypes.has(t))) return false;

		for (const expected of EXPECTED_PATH) {
			const sourceNode = pipeline.placedNodes.find((n) => n.type === expected.from);
			const targetNode = pipeline.placedNodes.find((n) => n.type === expected.to);
			if (!sourceNode || !targetNode) return false;

			const hasConnection = pipeline.connections.some(
				(c) => c.sourceNodeId === sourceNode.id && c.targetNodeId === targetNode.id,
			);
			if (!hasConnection) return false;
		}

		return true;
	}, [pipeline.placedNodes, pipeline.connections]);

	// Spawn particles from request node
	useEffect(() => {
		const interval = setInterval(() => {
			const requestNode = pipeline.placedNodes.find((n) => n.type === 'request');
			if (!requestNode) return;

			const conn = pipeline.connections.find((c) => c.sourceNodeId === requestNode.id);
			if (!conn) {
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
				const targetNode = pipeline.placedNodes.find((n) => n.id === conn.targetNodeId);
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
	}, [pipeline.placedNodes, pipeline.connections, isComplete]);

	// Animate particles
	useEffect(() => {
		const interval = setInterval(() => {
			setParticles((prev) =>
				prev
					.map((p) => ({ ...p, progress: Math.min(1, p.progress + 0.05) }))
					.filter((p) => p.progress < 1 || (p.state === 'poof' && p.progress < 1.5)),
			);
		}, 50);

		return () => clearInterval(interval);
	}, []);

	const handleComplete = async () => {
		const success = await completeLevel('act1-level2-first-request', { stars: 3 });
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Available nodes (not yet placed)
	const availableNodes = AVAILABLE_TYPES.filter(
		(type) => !pipeline.placedNodes.some((n) => n.type === type),
	);

	// Generate code preview
	const getCodeFiles = () => {
		const files = [];

		const hasRouter = pipeline.placedNodes.some((n) => n.type === 'router');
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

		const hasController = pipeline.placedNodes.some((n) => n.type === 'controller');
		const hasModel = pipeline.placedNodes.some((n) => n.type === 'model');
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

		const hasView = pipeline.placedNodes.some((n) => n.type === 'view');
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

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Build the Rails MVC pipeline. Watch particles turn green when the path is complete."
					instructions={[
						'Drag nodes from the palette to the canvas',
						'Connect nodes by clicking the connection points',
						'Build the complete MVC path: Request → Router → Controller → Model → Database → View → Response',
					]}
					scenario="The server is booting, but localhost:3000 is hitting a 404 Error. Requests are going into the void."
				>
					<NodePalette title="Available Components">
						<NodePaletteGroup title="MVC Components">
							{availableNodes.map((type) => {
								const info = getNodeInfo(type);
								return (
									<DraggableNode
										color={info.color}
										description={info.description || ''}
										icon={info.icon || type[0].toUpperCase()}
										key={type}
										name={info.name}
										onDragEnd={pipeline.handleDragEnd}
										onDragStart={pipeline.handleDragStart}
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
					levelName="The First Request"
					levelNumber={2}
					onExit={onExit}
					onReset={() => {
						pipeline.setPlacedNodes([
							{ id: 'request-1', type: 'request', x: 100, y: 300 },
						]);
						pipeline.setConnections([]);
					}}
				/>

				<PipelineCanvas
					canvasRef={pipeline.canvasRef}
					connections={pipeline.connections}
					draggedNodeType={pipeline.draggedNodeType}
					draggingNodeId={pipeline.draggingNodeId}
					onClick={pipeline.handleCanvasClick}
					onCompleteConnection={pipeline.completeConnection}
					onDeleteConnection={pipeline.deleteConnection}
					onDeleteNode={pipeline.deleteSelectedNode}
					onDragOver={pipeline.handleDragOver}
					onDrop={pipeline.handleDrop}
					onMouseMove={pipeline.handleCanvasMouseMove}
					onMouseUp={pipeline.handleCanvasMouseUp}
					onNodeMouseDown={pipeline.handleNodeMouseDown}
					onStartConnection={pipeline.startConnection}
					pendingConnection={pipeline.pendingConnection}
					placedNodes={pipeline.placedNodes}
					selectedNodeId={pipeline.selectedNodeId}
				>
					{/* Particles */}
					<svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 2 }}>
						{particles.map((p) => {
							const currentX = p.x + (p.targetX - p.x) * p.progress;
							const currentY = p.y + (p.targetY - p.y) * p.progress;
							const opacity = p.state === 'poof' ? Math.max(0, 1 - p.progress) : 1;

							if (p.state === 'poof') {
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

							const color = p.state === 'success' ? '#22c55e' : '#f59e0b';
							return (
								<g key={p.id}>
									<circle cx={currentX} cy={currentY} fill={color} r="6" />
									<circle cx={currentX} cy={currentY} fill={color} opacity="0.3" r="10" />
								</g>
							);
						})}
					</svg>

					{/* Completion overlay */}
					{isComplete() && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
							<Button
								className="bg-success hover:bg-success/90 text-foreground font-bold shadow-lg shadow-success/30"
								onClick={handleComplete}
								size="lg"
							>
								Complete Level
							</Button>
						</div>
					)}
				</PipelineCanvas>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="Understanding the Rails MVC request/response cycle and how routes, controllers, models, and views work together."
				>
					{/* Status */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Pipeline Status
						</div>
						<div className="space-y-1 text-sm">
							{AVAILABLE_TYPES.map((type) => {
								const hasNode = pipeline.placedNodes.some((n) => n.type === type);
								const info = getNodeInfo(type);
								return (
									<div
										className={`flex items-center gap-2 ${hasNode ? 'text-success' : 'text-muted-foreground'}`}
										key={type}
									>
										<span>{hasNode ? '+' : '-'}</span>
										<span>{info.name}</span>
									</div>
								);
							})}
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level2FirstRequest;
