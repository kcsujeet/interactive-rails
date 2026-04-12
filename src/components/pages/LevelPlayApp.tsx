/**
 * Level Play App Component
 *
 * The main level gameplay interface.
 * Custom level components handle their own layout and interactions.
 * Falls back to a generic pipeline builder for unimplemented levels.
 */

import { useCallback, useEffect, useState } from 'react';
import { getActForLevel, getLevel } from '@/lib/acts-registry';
import { getLevelComponent } from '@/lib/levels-registry';
import { completeLevel as completeLevelProgress } from '@/lib/progress';
import { generateCodeFiles, getLearningGoal } from '@/utils/codeGeneration';
import {
	type Connection,
	type LevelData,
	levelChallenges,
	PipelineCanvas,
	usePipelineSimulation,
	usePipelineState,
	usePipelineValidation,
} from '../game-barrel';
import {
	CenterPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
} from '../levels';
import { CodePreviewPanel } from '../levels/CodePreviewPanel';
import { NodePalette } from '../NodePalette';

interface LevelPlayAppProps {
	levelId: string;
}

export function LevelPlayApp({ levelId }: LevelPlayAppProps) {
	const [loading, setLoading] = useState(true);
	const [stability] = useState(100);
	const [levelData, setLevelData] = useState<LevelData | null>(null);

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
		deleteConnection,
		deleteSelectedNode,
	} = pipelineState;

	// Validation hook
	const validation = usePipelineValidation(levelId, placedNodes, connections);
	const { isPipelineBroken, breakReason, hasSolutionNode, checkChallenge } =
		validation;

	// Get challenge from content or level challenges
	const challenge = levelChallenges[levelId];
	const level = getLevel(levelId);
	const act = getActForLevel(levelId);

	// Simulation hook - pass level-specific solution type
	const simulation = usePipelineSimulation(
		'playing',
		placedNodes,
		connections,
		isPipelineBroken,
		hasSolutionNode,
		challenge?.solutionNodeType,
	);
	const { liveMetrics, setLiveMetrics, queryParticles } = simulation;

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadLevel should only run once on mount
	useEffect(() => {
		loadLevel();
	}, []);

	function loadLevel() {
		const activeLevel = level;

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
		initializeLevel();
	}

	function initializeLevel() {
		if (challenge) {
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
		} else if (level?.startingPipeline) {
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
	}

	// Validate pipeline for LevelHeader's Submit button
	const handleValidate = useCallback(() => {
		const result = checkChallenge(liveMetrics);
		if (result.valid) {
			return {
				valid: true,
				message: `Pipeline valid! Score: ${result.score}`,
			};
		}
		return {
			valid: false,
			message: 'Invalid Pipeline',
			details: result.errors.slice(0, 4),
		};
	}, [checkChallenge, liveMetrics]);

	const handleComplete = useCallback(async () => {
		const result = checkChallenge(liveMetrics);
		const stars = result.score >= 80 ? 3 : result.score >= 50 ? 2 : 1;

		try {
			const saveResult = await completeLevelProgress({
				levelId,
				stars,
				finalStability: stability,
				timeToComplete: 300,
				finalMetrics: {
					avgLatency: 50,
					queriesPerRequest: 3,
					cacheHitRate: 80,
					errorRate: 0,
				},
			});

			if (saveResult.success) {
				window.location.href = `/acts/${act?.id || 1}/${levelId}/complete?stars=${stars}`;
			}
		} catch (err) {
			console.error('Failed to save completion:', err);
		}
	}, [
		checkChallenge,
		liveMetrics,
		stability,
		levelId,
		act,
	]);

	if (loading) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-sm text-muted-foreground">Loading level...</div>
			</div>
		);
	}

	// Check if this level has a custom component
	const CustomLevelComponent = getLevelComponent(levelId);
	if (CustomLevelComponent) {
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
							window.location.href = `/acts/${act?.id || 1}/${levelId}/complete?stars=${stars}`;
						}
					} catch (err) {
						console.error('Failed to save level completion:', err);
					}
				}}
			/>
		);
	}

	// Fallback: generic pipeline builder for unimplemented levels
	const codeFiles = level ? generateCodeFiles(level) : [];
	const learningGoal = level ? getLearningGoal(level) : undefined;

	return (
		<LevelLayout>
			<LeftPanel>
				<NodePalette
					availableNodes={level?.availableNodes || challenge?.availableNodes}
					breakReason={breakReason}
					challenge={challenge}
					draggedNodeType={draggedNodeType}
					isPipelineBroken={isPipelineBroken}
					liveMetrics={liveMetrics}
					onDragEnd={handleDragEnd}
					onDragStart={handleDragStart}
					showMetrics={
						!!challenge?.initialMetrics || (!!level && !!act?.metricsVisible)
					}
				/>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={act?.id}
					levelName={levelData?.name || ''}
					levelNumber={level?.levelNumber || 0}
					onComplete={handleComplete}
					onReset={initializeLevel}
					onValidate={handleValidate}
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
						onDeleteNode={deleteSelectedNode}
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
						simulationRunning={true}
					/>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={codeFiles} learningGoal={learningGoal} />
			</RightPanel>
		</LevelLayout>
	);
}

export default LevelPlayApp;
