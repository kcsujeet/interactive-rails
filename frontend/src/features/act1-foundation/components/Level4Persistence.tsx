/**
 * Level 4: Persistence Layer
 *
 * Models glow blue (transient) until connected to database.
 * "Simulate Restart" clears transient data.
 */

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PipelineCanvas } from '@/components/PipelineCanvas';
import type { NodeOverride } from '@/components/PipelineCanvas';
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

export function Level4Persistence({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	const [databaseAdded, setDatabaseAdded] = useState(false);
	const [modelsConnectedToDb, setModelsConnectedToDb] = useState<Set<string>>(
		new Set(),
	);
	const [dataCounter, setDataCounter] = useState(0);
	const [showRestartEffect, setShowRestartEffect] = useState(false);

	// Track model→database connections
	const handleConnectionCreated = useCallback(
		(conn: { id: string; sourceNodeId: string; targetNodeId: string }, sourceNode: any, targetNode: any) => {
			// Check if connecting model to database
			if (
				(sourceNode?.type === 'model' && targetNode?.type === 'database') ||
				(sourceNode?.type === 'database' && targetNode?.type === 'model')
			) {
				const modelId =
					sourceNode?.type === 'model' ? sourceNode.id : targetNode.id;
				setModelsConnectedToDb((prev) => new Set([...prev, modelId]));
			}
		},
		[],
	);

	// Pre-built pipeline (initialNodes with 7 nodes, initialConnections with 7 connections)
	const pipeline = usePipelineState({
		initialNodes: [
			{ id: 'request-1', type: 'request', x: 130, y: 280, locked: true },
			{ id: 'router-1', type: 'router', x: 350, y: 280, locked: true },
			{ id: 'controller-1', type: 'controller', x: 570, y: 280, locked: true },
			{ id: 'post-model', type: 'model', x: 810, y: 150, label: 'Post', locked: true },
			{ id: 'comment-model', type: 'model', x: 810, y: 280, label: 'Comment', locked: true },
			{ id: 'view-1', type: 'view', x: 810, y: 410, locked: true },
			{ id: 'response-1', type: 'response', x: 1060, y: 410, locked: true },
		],
		initialConnections: [
			{ id: 'c1', sourceNodeId: 'request-1', targetNodeId: 'router-1' },
			{ id: 'c2', sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
			{ id: 'c3', sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'comment-model' },
			{ id: 'c5', sourceNodeId: 'controller-1', targetNodeId: 'view-1' },
			{ id: 'c6', sourceNodeId: 'view-1', targetNodeId: 'response-1' },
		],
		onBeforeDrop: (type) => type === 'database' && !databaseAdded,
		onConnectionCreated: handleConnectionCreated,
	});

	// Check if level is complete - both models connected to database
	const isComplete =
		modelsConnectedToDb.has('post-model') &&
		modelsConnectedToDb.has('comment-model');

	// Simulate data creation
	const createData = () => {
		setDataCounter((prev) => prev + 1);
	};

	// Simulate restart - clears data if models aren't persisted
	const simulateRestart = () => {
		setShowRestartEffect(true);
		setTimeout(() => {
			if (!isComplete) {
				// Data is lost if models aren't connected to database
				setDataCounter(0);
			}
			setShowRestartEffect(false);
		}, 1000);
	};

	// Handle completing the level
	const handleComplete = async () => {
		const success = await completeLevel('act1-level4-persistence', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Reset function
	const handleReset = () => {
		pipeline.setPlacedNodes([
			{ id: 'request-1', type: 'request', x: 130, y: 280, locked: true },
			{ id: 'router-1', type: 'router', x: 350, y: 280, locked: true },
			{ id: 'controller-1', type: 'controller', x: 570, y: 280, locked: true },
			{ id: 'post-model', type: 'model', x: 810, y: 150, label: 'Post', locked: true },
			{ id: 'comment-model', type: 'model', x: 810, y: 280, label: 'Comment', locked: true },
			{ id: 'view-1', type: 'view', x: 810, y: 410, locked: true },
			{ id: 'response-1', type: 'response', x: 1060, y: 410, locked: true },
		]);
		pipeline.setConnections([
			{ id: 'c1', sourceNodeId: 'request-1', targetNodeId: 'router-1' },
			{ id: 'c2', sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
			{ id: 'c3', sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'comment-model' },
			{ id: 'c5', sourceNodeId: 'controller-1', targetNodeId: 'view-1' },
			{ id: 'c6', sourceNodeId: 'view-1', targetNodeId: 'response-1' },
		]);
		setDatabaseAdded(false);
		setModelsConnectedToDb(new Set());
		setDataCounter(0);
	};

	// Track when database is dropped
	const handleAfterDrop = useCallback(() => {
		setDatabaseAdded(true);
	}, []);

	// Node overrides for badge/glow per model node
	const nodeOverrides: NodeOverride[] = pipeline.placedNodes
		.filter((node) => node.type === 'model')
		.map((node) => {
			const isPersisted = modelsConnectedToDb.has(node.id);
			return {
				id: node.id,
				badge: isPersisted ? 'DB' : 'MEM',
				badgeColor: isPersisted ? '#22c55e' : '#3b82f6',
				glowColor: isPersisted
					? 'rgba(34, 197, 94, 0.4)'
					: 'rgba(59, 130, 246, 0.4)',
			};
		});

	// Connection color overrides - model to database connections are green
	const connectionOverrides = pipeline.connections.map((conn) => {
		const sourceNode = pipeline.placedNodes.find((n) => n.id === conn.sourceNodeId);
		const targetNode = pipeline.placedNodes.find((n) => n.id === conn.targetNodeId);
		const isDbConnection =
			(sourceNode?.type === 'model' && targetNode?.type === 'database') ||
			(sourceNode?.type === 'database' && targetNode?.type === 'model');

		return {
			...conn,
			color: isDbConnection ? '#22c55e' : '#6b7280',
		};
	});

	// Generate code preview
	const getCodeFiles = () => {
		const files = [];

		// Database config
		files.push({
			filename: 'config/database.yml',
			language: 'ruby',
			code: `default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development

production:
  <<: *default
  url: <%= ENV['DATABASE_URL'] %>`,
			highlight: isComplete ? [2, 11] : [],
		});

		// Model with persistence
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: modelsConnectedToDb.has('post-model')
				? `class Post < ApplicationRecord
  # Data persists to database
  has_many :comments

  validates :title, presence: true
end`
				: `class Post
  # WARNING: Not persisted!
  # Data lives in memory only
  attr_accessor :title, :body
end`,
			highlight: modelsConnectedToDb.has('post-model') ? [2] : [2, 3],
		});

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Make data survive server restarts by connecting models to persistent storage."
					instructions={[
						'Drag the Database node to the canvas',
						'Connect BOTH models (Post and Comment) to the Database',
						'Use "Simulate Restart" to verify data persists',
					]}
					scenario="Users are complaining their posts vanish when the Dyno restarts."
				>
					<NodePalette title="Available Components">
						{!databaseAdded ? (
							<NodePaletteGroup title="Storage">
								<DraggableNode
									color="#06b6d4"
									description="PostgreSQL persistent storage"
									icon="D"
									name="Database"
									onDragEnd={pipeline.handleDragEnd}
									onDragStart={(e, type) => {
										pipeline.handleDragStart(e, type);
										handleAfterDrop();
									}}
									type="database"
								/>
							</NodePaletteGroup>
						) : (
							<div className="text-sm text-muted-foreground text-center py-4">
								Database added!
								{!isComplete && (
									<div className="mt-2">Connect both models to it.</div>
								)}
							</div>
						)}
					</NodePalette>

					{/* Data counter & restart */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Data Simulation
						</div>

						<div className="bg-secondary rounded-lg p-4 mb-3">
							<div
								className="text-2xl font-bold text-center mb-1"
								style={{
									color: isComplete
										? 'hsl(var(--success))'
										: 'hsl(var(--primary))',
								}}
							>
								{dataCounter}
							</div>
							<div className="text-xs text-muted-foreground text-center">
								Records Created
							</div>
						</div>

						<div className="space-y-2">
							<Button className="w-full" onClick={createData}>
								+ Create Record
							</Button>
							<Button
								className="w-full"
								onClick={simulateRestart}
								variant="destructive"
							>
								Simulate Restart
							</Button>
						</div>

						{showRestartEffect && (
							<div
								className={`mt-3 text-center text-sm ${isComplete ? 'text-success' : 'text-destructive'}`}
							>
								{isComplete
									? 'Data survived restart!'
									: 'Data lost on restart!'}
							</div>
						)}
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Persistence Layer"
					levelNumber={4}
					onExit={onExit}
					onReset={handleReset}
				/>

				<PipelineCanvas
					canvasRef={pipeline.canvasRef}
					connections={connectionOverrides}
					draggedNodeType={pipeline.draggedNodeType}
					draggingNodeId={pipeline.draggingNodeId}
					nodeOverrides={nodeOverrides}
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
					{/* Restart effect overlay */}
					{showRestartEffect && (
						<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40 pointer-events-none">
							<div className="text-2xl font-bold text-warning animate-pulse">
								Restarting...
							</div>
						</div>
					)}

					{/* Legend */}
					<div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 text-xs space-y-2 z-10 pointer-events-none">
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded bg-primary/40 border border-primary" />
							<span className="text-muted-foreground">
								Transient (memory only)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-4 h-4 rounded bg-success/40 border border-success" />
							<span className="text-muted-foreground">
								Persisted (database)
							</span>
						</div>
					</div>

					{/* Completion button */}
					{isComplete && (
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
					learningGoal="Understanding the difference between transient (memory) and persistent (database) data storage."
				>
					{/* Persistence status */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Persistence Status
						</div>
						<div className="space-y-2 text-sm">
							<div
								className={`flex items-center gap-2 ${modelsConnectedToDb.has('post-model') ? 'text-success' : 'text-primary'}`}
							>
								<span>{modelsConnectedToDb.has('post-model') ? '+' : '-'}</span>
								<span>
									Post Model:{' '}
									{modelsConnectedToDb.has('post-model')
										? 'Persisted'
										: 'Transient'}
								</span>
							</div>
							<div
								className={`flex items-center gap-2 ${modelsConnectedToDb.has('comment-model') ? 'text-success' : 'text-primary'}`}
							>
								<span>
									{modelsConnectedToDb.has('comment-model') ? '+' : '-'}
								</span>
								<span>
									Comment Model:{' '}
									{modelsConnectedToDb.has('comment-model')
										? 'Persisted'
										: 'Transient'}
								</span>
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level4Persistence;
