/**
 * Level Play App Component
 *
 * The main level gameplay interface with pipeline builder and simulation.
 */

import { useEffect, useState } from 'react';
import { getActForLevel, getLevel, getNextLevel } from '../../content/acts';
import { completeLevel as completeLevelProgress } from "@/lib/progress";
import {
	CompletionScreen,
	type Connection,
	type GameState,
	GameTopBar,
	InspectorPanel,
	type LevelData,
	levelChallenges,
	NodePalette,
	PausedOverlay,
	PipelineCanvas,
	usePipelineSimulation,
	usePipelineState,
	usePipelineValidation,
	type ValidationResult,
} from '../game';
import { getLevelComponent } from '../game/levels';

interface LevelPlayAppProps {
	levelId: string;
}

export function LevelPlayApp({ levelId }: LevelPlayAppProps) {
	const [loading, setLoading] = useState(true);
	const [gameState, setGameState] = useState<GameState>('playing');
	const [currentRoom] = useState(0);
	const [stability] = useState(100);
	const [isInspectorOpen, setIsInspectorOpen] = useState(true);
	const [levelData, setLevelData] = useState<LevelData | null>(null);
	const [showValidation, setShowValidation] = useState(false);
	const [lastValidation, setLastValidation] = useState<ValidationResult | null>(
		null,
	);
	const [earnedStars, setEarnedStars] = useState(2);

	// Pipeline state hook
	const pipelineState = usePipelineState();
	const {
		placedNodes,
		setPlacedNodes,
		connections,
		setConnections,
		selectedNodeId,
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
	} = pipelineState;

	// Validation hook
	const validation = usePipelineValidation(levelId, placedNodes, connections);
	const { isPipelineBroken, breakReason, hasSolutionNode, checkChallenge } =
		validation;

	// Get challenge from content or level challenges
	const challenge = levelChallenges[levelId];
	const level = getLevel(levelId);

	// Simulation hook - pass level-specific solution type
	const simulation = usePipelineSimulation(
		gameState,
		placedNodes,
		connections,
		isPipelineBroken,
		hasSolutionNode,
		challenge?.solutionNodeType || 'eager_load',
	);
	const { liveMetrics, setLiveMetrics, queryParticles } = simulation;

	useEffect(() => {
		loadLevel();
	}, []);

	function loadLevel() {
		// 1. Fetch previous choices (Mocked for now - eventually from backend/context)
		// In a real implementation, we'd fetch this from the API or a global context
		const stackChoice = { frontend: 'react' }; // Default/Mock for testing dynamic logic

		const activeLevel = level;

		// 2. DYNAMIC PATCHING based on L1 Choices
		if (activeLevel && activeLevel.levelNumber === 2) {
			// Patch Level 2: If React, ask for Serializer instead of View
			// Note: We need to clone the level to avoid mutating the global constant
			const patchedLevel = JSON.parse(JSON.stringify(activeLevel));

			// If we chose React in L1 (we need to fetch this state, for now we assume React to test)
			// effective choice logic would be here.

			// For now, let's just LOG that we are ready to patch.
			// Real patching requires global app state which we don't have passed in here yet.
		}

		// Use new level content if available, otherwise fall back to legacy challenge
		const info = activeLevel
			? {
					name: activeLevel.name,
					description: activeLevel.trigger.description,
					concepts: [activeLevel.learningContent.title],
					scenario: activeLevel.problem.observation,
					problem: activeLevel.problem.codeExample,
					goal:
						activeLevel.problem.goal ||
						'Fix the pipeline to complete this level.',
				}
			: challenge
				? {
						name: challenge.name,
						description: challenge.description,
						concepts: challenge.concepts,
						scenario: challenge.scenario,
						problem: challenge.problem,
						goal: challenge.goal,
					}
				: {
						name: 'Unknown Level',
						description: '',
						concepts: [],
					};

		const data: LevelData = {
			id: levelId,
			name: info.name,
			description: info.description,
			rooms: [
				{ id: 'room-1', name: 'Room 1', description: 'First challenge' },
				{ id: 'room-2', name: 'Room 2', description: 'Second challenge' },
				{ id: 'room-3', name: 'Room 3', description: 'Final challenge' },
			],
			concepts: info.concepts,
			scenario: info.scenario,
			problem: info.problem,
			goal: info.goal,
		};

		setLevelData(data);
		setLoading(false);
		// Start the level immediately - briefing is shown on separate page
		initializeLevel();
	}

	function initializeLevel() {
		if (challenge) {
			// Use legacy challenge format
			setPlacedNodes([...challenge.initialNodes]);

			const initialConns: Connection[] = [];
			for (const connDef of challenge.initialConnections) {
				const sourceNode = challenge.initialNodes.find(
					(n) => n.type === connDef.sourceType,
				);
				const targetNode = challenge.initialNodes.find(
					(n) => n.type === connDef.targetType,
				);
				if (sourceNode && targetNode) {
					initialConns.push({
						id: `conn-${sourceNode.id}-${targetNode.id}`,
						sourceNodeId: sourceNode.id,
						targetNodeId: targetNode.id,
					});
				}
			}
			setConnections(initialConns);

			setLiveMetrics({
				queryCount: 0,
				latency: challenge.initialMetrics.latency,
				cpuLoad: 85,
				dbLoad: 95,
			});
		} else if (level) {
			// Use new Level content format from acts
			const initialNodes = level.startingPipeline.nodes.map((node) => ({
				id: node.id,
				type: node.type,
				x: node.x,
				y: node.y,
				config: node.config,
			}));
			setPlacedNodes(initialNodes);

			const initialConns: Connection[] = level.startingPipeline.connections.map(
				(conn) => ({
					id: conn.id,
					sourceNodeId: conn.sourceNodeId,
					targetNodeId: conn.targetNodeId,
				}),
			);
			setConnections(initialConns);

			setLiveMetrics({
				queryCount: 0,
				latency: 50,
				cpuLoad: 30,
				dbLoad: 40,
			});
		}
		setGameState('playing');
	}

	function pauseLevel() {
		setGameState('paused');
	}

	function resumeLevel() {
		setGameState('playing');
	}

	function exitLevel() {
		const act = getActForLevel(levelId);
		window.location.href = `/acts/${act?.id || 1}/${levelId}`;
	}

	function checkPipeline() {
		const result = checkChallenge(liveMetrics);
		setLastValidation(result);
		setShowValidation(true);
	}

	function resetValidation() {
		setShowValidation(false);
		setLastValidation(null);
	}

	// Reset validation when pipeline changes
	useEffect(() => {
		setShowValidation(false);
		setLastValidation(null);
	}, []);

	async function completeLevel(stars: number) {
		setEarnedStars(stars);
		try {
			// Scan for Stack Choices (Level 1)
			const terminals = placedNodes.filter((n) => n.type === 'terminal');
			let stackChoices;

			if (terminals.length > 0) {
				// Find what's connected to the terminal
				const connectedIds = new Set<string>();
				connections.forEach((c) => {
					if (c.sourceNodeId === terminals[0].id)
						connectedIds.add(c.targetNodeId);
					if (c.targetNodeId === terminals[0].id)
						connectedIds.add(c.sourceNodeId);
				});

				const connectedNodes = placedNodes.filter((n) =>
					connectedIds.has(n.id),
				);
				const dbChoice = connectedNodes.find(
					(n) => n.type === 'postgres' || n.type === 'sqlite',
				)?.type as 'postgres' | 'sqlite';
				const feChoice = connectedNodes.find(
					(n) => n.type === 'react' || n.type === 'erb' || n.type === 'hotwire',
				)?.type as 'react' | 'erb' | 'hotwire';

				if (dbChoice && feChoice) {
					stackChoices = { database: dbChoice, frontend: feChoice };
					console.log('Stack Choice Captured:', stackChoices);
				}
			}

			const result = await completeLevelProgress({
				levelId,
				stars,
				finalStability: stability,
				timeToComplete: 300,
				stackChoices,
				finalMetrics: {
					avgLatency: 50,
					queriesPerRequest: 3,
					cacheHitRate: 80,
					errorRate: 0,
				},
			});

			if (result.success) {
				setGameState('completed');
			}
		} catch (err) {
			console.error('Failed to save completion:', err);
		}
	}

	if (loading) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-sm text-muted-foreground">Loading level...</div>
			</div>
		);
	}

	if (gameState === 'completed') {
		const nextLevel = getNextLevel(levelId);
		return (
			<CompletionScreen
				isCapstone={level?.isCapstone}
				learningContent={level?.learningContent}
				levelName={levelData?.name || ''}
				nextLevelId={nextLevel?.id}
				nextLevelActId={nextLevel?.actId}
				onExit={exitLevel}
				stars={earnedStars}
			/>
		);
	}

	// Check if this level has a custom component
	const CustomLevelComponent = getLevelComponent(levelId);
	if (
		(gameState === 'playing' || gameState === 'paused') &&
		CustomLevelComponent
	) {
		return (
			<CustomLevelComponent
				onComplete={async (data) => {
					const stars = data?.stars ?? 3;
					try {
						const result = await completeLevelProgress({
							levelId,
							stars,
							finalStability: 100,
							timeToComplete: 120,
							finalMetrics: {
								avgLatency: 0,
								queriesPerRequest: 0,
								cacheHitRate: 0,
								errorRate: 0,
							},
						});

						if (result.success) {
							setEarnedStars(stars);
							setGameState('completed');
						}
					} catch (err) {
						console.error('Failed to save level completion:', err);
					}
				}}
				onExit={exitLevel}
			/>
		);
	}

	if (gameState === 'playing' || gameState === 'paused') {
		return (
			<div className="h-full flex">
				<NodePalette
					availableNodes={level?.availableNodes || challenge?.availableNodes}
					breakReason={breakReason}
					challenge={challenge}
					connectionsCount={connections.length}
					draggedNodeType={draggedNodeType}
					goal={levelData?.goal || challenge?.goal}
					isPipelineBroken={isPipelineBroken}
					liveMetrics={liveMetrics}
					onClearAll={clearAllNodes}
					onClearConnections={() => setConnections([])}
					onDeleteSelected={deleteSelectedNode}
					onDragEnd={handleDragEnd}
					onDragStart={handleDragStart}
					placedNodesCount={placedNodes.length}
					selectedNodeId={selectedNodeId}
					showMetrics={
						!!challenge?.initialMetrics ||
						(!!level && !!getActForLevel(levelId)?.metricsVisible)
					}
				/>

				<div className="flex-1 flex flex-col">
					<GameTopBar
						connectionsCount={connections.length}
						currentRoom={currentRoom}
						gameState={gameState}
						level={levelData}
						onExit={exitLevel}
						onPause={pauseLevel}
						onResume={resumeLevel}
						placedNodesCount={placedNodes.length}
						stability={stability}
					/>

					<div className="flex-1 relative flex flex-col">
						<PipelineCanvas
							canvasRef={canvasRef}
							connections={connections}
							draggedNodeType={draggedNodeType}
							draggingNodeId={draggingNodeId}
							isPipelineBroken={isPipelineBroken}
							onClick={handleCanvasClick}
							onCompleteConnection={completeConnection}
							onDeleteConnection={deleteConnection}
							onDragOver={handleDragOver}
							onDrop={handleDrop}
							onMouseMove={handleCanvasMouseMove}
							onMouseUp={handleCanvasMouseUp}
							onNodeMouseDown={handleNodeMouseDown}
							onStartConnection={startConnection}
							pendingConnection={pendingConnection}
							placedNodes={placedNodes}
							queryParticles={queryParticles}
							selectedNodeId={selectedNodeId}
							showValidation={showValidation}
							simulationRunning={gameState === 'playing'}
						/>

						{gameState === 'paused' && (
							<PausedOverlay onExit={exitLevel} onResume={resumeLevel} />
						)}
					</div>
				</div>

				<InspectorPanel
					challenge={challenge}
					connectionsCount={connections.length}
					initialNodesCount={level?.startingPipeline.nodes.length}
					isOpen={isInspectorOpen}
					lastValidation={lastValidation}
					onCheckPipeline={checkPipeline}
					onClose={() => setIsInspectorOpen(false)}
					onComplete={completeLevel}
					onDeleteSelected={deleteSelectedNode}
					onOpen={() => setIsInspectorOpen(true)}
					onResetValidation={resetValidation}
					onUpdateNode={updateNode}
					placedNodes={placedNodes}
					selectedNodeId={selectedNodeId}
					showValidation={showValidation}
				/>
			</div>
		);
	}

	return null;
}

export default LevelPlayApp;
