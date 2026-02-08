/**
 * Level 8: Semantic Associations
 *
 * Add a Comment model and choose the correct relationship type.
 * Decision modal appears when connecting Model → Model.
 */

import { useCallback, useEffect, useState } from 'react';
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
import { PipelineCanvas } from '@/components/PipelineCanvas';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { usePipelineState } from '@/hooks/usePipelineState';

export function Level7Associations({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// Pre-built pipeline with Post model
	const pipeline = usePipelineState({
		initialNodes: [
			{ id: 'request-1', type: 'request', x: 130, y: 280 },
			{ id: 'router-1', type: 'router', x: 350, y: 280 },
			{ id: 'controller-1', type: 'controller', x: 570, y: 280 },
			{ id: 'post-model', type: 'model', x: 810, y: 150, label: 'Post' },
			{ id: 'database-1', type: 'database', x: 1060, y: 150 },
			{ id: 'serializer-1', type: 'serializer', x: 810, y: 410 },
			{ id: 'response-1', type: 'response', x: 1060, y: 410 },
		],
		initialConnections: [
			{ id: 'c1', sourceNodeId: 'request-1', targetNodeId: 'router-1' },
			{ id: 'c2', sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
			{ id: 'c3', sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-1' },
			{ id: 'c5', sourceNodeId: 'controller-1', targetNodeId: 'serializer-1' },
			{ id: 'c6', sourceNodeId: 'serializer-1', targetNodeId: 'response-1' },
		],
		onBeforeDrop: (type, nodes) => {
			// Only allow dropping model if comment not yet added
			return type === 'model' && !nodes.some((n) => n.id === 'comment-model');
		},
	});

	const [commentAdded, setCommentAdded] = useState(false);
	const [relationshipType, setRelationshipType] = useState<string | null>(null);
	const [showDecisionModal, setShowDecisionModal] = useState(false);
	const [pendingRelationship, setPendingRelationship] = useState<{
		sourceNodeId: string;
		targetNodeId: string;
	} | null>(null);

	// Check if level is complete
	const isComplete = relationshipType === 'has_many';

	// Detect when Comment model is added and update its label
	useEffect(() => {
		const commentNode = pipeline.placedNodes.find(
			(n) => n.id === 'comment-model',
		);
		if (commentNode && !commentNode.label) {
			pipeline.updateNode('comment-model', { label: 'Comment' });
			setCommentAdded(true);
		}
	}, [pipeline]);

	// Handle connection creation - intercept model-to-model connections
	const handleConnectionCreated = useCallback(
		(sourceNodeId: string, targetNodeId: string) => {
			const sourceNode = pipeline.placedNodes.find(
				(n) => n.id === sourceNodeId,
			);
			const targetNode = pipeline.placedNodes.find(
				(n) => n.id === targetNodeId,
			);

			// Check if connecting two models
			if (sourceNode?.type === 'model' && targetNode?.type === 'model') {
				// Show decision modal
				setPendingRelationship({ sourceNodeId, targetNodeId });
				setShowDecisionModal(true);
				return false; // Don't create connection yet
			}

			return true; // Allow other connections
		},
		[pipeline.placedNodes],
	);

	// Handle decision modal choice
	const handleRelationshipChoice = (choice: string) => {
		if (pendingRelationship) {
			// Create connection with relationship type metadata
			const newConnection = {
				id: `conn-${Date.now()}`,
				sourceNodeId: pendingRelationship.sourceNodeId,
				targetNodeId: pendingRelationship.targetNodeId,
				relationshipType: choice,
			};
			pipeline.setConnections((prev) => [...prev, newConnection]);
			setRelationshipType(choice);
		}
		setShowDecisionModal(false);
		setPendingRelationship(null);
	};

	// Handle completing the level
	const handleComplete = async () => {
		const success = await completeLevel('act1-level7-associations', {
			stars: 3,
			decisions: { relationship: relationshipType! },
		});
		if (success) {
			onComplete({ stars: 3, decisions: { relationship: relationshipType! } });
		}
	};

	// Override node drag behavior - only allow dragging comment model
	const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
		if (nodeId === 'comment-model') {
			pipeline.handleNodeMouseDown(nodeId, e);
		}
	};

	// Generate code preview
	const getCodeFiles = () => {
		const files = [];

		// Post model
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code: relationshipType
				? `class Post < ApplicationRecord
  ${relationshipType} :comments${relationshipType === 'has_many' ? ', dependent: :destroy' : ''}
end`
				: `class Post < ApplicationRecord
  # No associations defined yet
end`,
			highlight: relationshipType ? [2] : [],
		});

		// Comment model (if added)
		if (commentAdded) {
			files.push({
				filename: 'app/models/comment.rb',
				language: 'ruby',
				code: `class Comment < ApplicationRecord
  belongs_to :post
end`,
				highlight: [2],
			});
		}

		// Show serializer output
		if (relationshipType) {
			files.push({
				filename: 'app/blueprints/post_blueprint.rb',
				language: 'ruby',
				code:
					relationshipType === 'has_many'
						? `class PostBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :body

  association :comments, blueprint: CommentBlueprint
end

# GET /api/v1/posts/1
# => { "id": 1, "title": "Hello",
#      "comments": [{ "id": 1, "body": "Nice!" }, ...] }`
						: relationshipType === 'has_one'
							? `class PostBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :body

  association :comment, blueprint: CommentBlueprint
end

# GET /api/v1/posts/1
# => { "id": 1, "title": "Hello",
#      "comment": { "id": 1, "body": "Nice!" } }
# Only ONE comment per post!`
							: `class PostBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :body

  association :comments, blueprint: CommentBlueprint
end

# has_and_belongs_to_many means comments are
# shared between posts — not what you want here!`,
				highlight: relationshipType === 'has_many' ? [5] : [10, 11],
			});
		}

		return files;
	};

	// Custom connection color logic for model-to-model connections
	const getConnectionColor = useCallback((connection: any) => {
		if (connection.relationshipType) {
			// Color based on correctness
			return connection.relationshipType === 'has_many' ? '#22c55e' : '#ef4444';
		}
		return undefined; // Use default color
	}, []);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn ActiveRecord associations. The relationship type determines how models connect to each other."
					instructions={[
						'Drag the Comment Model to the canvas',
						'Connect the Post Model to the Comment Model',
						'Choose the correct relationship type in the dialog',
					]}
					scenario="Your blog needs comments! Each Post can have multiple Comments. But how do you tell Rails about this relationship?"
				>
					<NodePalette title="Available Components">
						{!commentAdded ? (
							<NodePaletteGroup title="Models">
								<DraggableNode
									color="#8b5cf6"
									description="Comment model for posts"
									icon="M"
									name="Comment"
									onDragEnd={pipeline.handleDragEnd}
									onDragStart={pipeline.handleDragStart}
									type="model"
								/>
							</NodePaletteGroup>
						) : (
							<div className="text-sm text-muted-foreground text-center py-4">
								Comment model added!
								{!relationshipType && (
									<div className="mt-2">Now connect Post → Comment</div>
								)}
							</div>
						)}
					</NodePalette>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Semantic Associations"
					levelNumber={7}
					onExit={onExit}
					onReset={() => {
						pipeline.setPlacedNodes([
							{ id: 'request-1', type: 'request', x: 130, y: 280 },
							{ id: 'router-1', type: 'router', x: 350, y: 280 },
							{ id: 'controller-1', type: 'controller', x: 570, y: 280 },
							{ id: 'post-model', type: 'model', x: 810, y: 150, label: 'Post' },
							{ id: 'database-1', type: 'database', x: 1060, y: 150 },
							{ id: 'serializer-1', type: 'serializer', x: 810, y: 410 },
							{ id: 'response-1', type: 'response', x: 1060, y: 410 },
						]);
						pipeline.setConnections([
							{ id: 'c1', sourceNodeId: 'request-1', targetNodeId: 'router-1' },
							{ id: 'c2', sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
							{ id: 'c3', sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
							{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-1' },
							{ id: 'c5', sourceNodeId: 'controller-1', targetNodeId: 'serializer-1' },
							{ id: 'c6', sourceNodeId: 'serializer-1', targetNodeId: 'response-1' },
						]);
						setCommentAdded(false);
						setRelationshipType(null);
					}}
				/>

				<PipelineCanvas
					canvasRef={pipeline.canvasRef}
					connectionColorFn={getConnectionColor}
					connections={pipeline.connections}
					draggedNodeType={pipeline.draggedNodeType}
					draggingNodeId={pipeline.draggingNodeId}
					onClick={pipeline.handleCanvasClick}
					onCompleteConnection={(targetNodeId) => {
						if (pipeline.pendingConnection) {
							const allowed = handleConnectionCreated(
								pipeline.pendingConnection.sourceNodeId,
								targetNodeId,
							);
							if (allowed) {
								pipeline.completeConnection(targetNodeId);
							} else {
								// Clear pending connection without creating it
								pipeline.setPendingConnection(null);
							}
						}
					}}
					onDeleteConnection={pipeline.deleteConnection}
					onDeleteNode={pipeline.deleteSelectedNode}
					onDragOver={pipeline.handleDragOver}
					onDrop={pipeline.handleDrop}
					onMouseMove={pipeline.handleCanvasMouseMove}
					onMouseUp={pipeline.handleCanvasMouseUp}
					onNodeMouseDown={handleNodeMouseDown}
					onStartConnection={pipeline.startConnection}
					pendingConnection={pipeline.pendingConnection}
					placedNodes={pipeline.placedNodes}
					selectedNodeId={pipeline.selectedNodeId}
				>
					{/* Decision Modal */}
					{showDecisionModal && (
						<div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
							<div className="bg-card border border-border rounded-xl p-6 max-w-md shadow-2xl">
								<h3 className="text-xl font-bold text-foreground mb-2">
									Relationship Type?
								</h3>
								<p className="text-muted-foreground text-sm mb-6">
									How should Post relate to Comment?
								</p>

								<div className="space-y-3">
									{[
										{
											value: 'has_one',
											label: 'has_one',
											preview: 'Only ONE comment per post',
											consequence: 'Limits posts to a single comment',
											correct: false,
										},
										{
											value: 'has_many',
											label: 'has_many',
											preview: 'ALL comments for a post',
											consequence: 'Posts can have unlimited comments',
											correct: true,
										},
										{
											value: 'has_and_belongs_to_many',
											label: 'has_and_belongs_to_many',
											preview: 'Comments shared between posts',
											consequence: 'Creates many-to-many relationship',
											correct: false,
										},
									].map((option) => (
										<Button
											className={`w-full p-4 h-auto rounded-lg text-left transition-all ${
												option.correct
													? 'border-border hover:border-success hover:bg-success/10'
													: 'border-border hover:border-muted-foreground hover:bg-secondary'
											}`}
											key={option.value}
											onClick={() => handleRelationshipChoice(option.value)}
											variant="outline"
										>
											<div className="w-full">
												<div className="flex items-center justify-between mb-1">
													<span className="font-mono text-primary">
														{option.label}
													</span>
													{option.correct && (
														<span className="text-xs text-success bg-success/20 px-2 py-0.5 rounded">
															Recommended
														</span>
													)}
												</div>
												<div className="text-sm text-foreground">
													{option.preview}
												</div>
												<div className="text-xs text-muted-foreground mt-1">
													{option.consequence}
												</div>
											</div>
										</Button>
									))}
								</div>

								<Button
									className="mt-4 text-muted-foreground hover:text-foreground text-sm w-full text-center"
									onClick={() => {
										setShowDecisionModal(false);
										setPendingRelationship(null);
									}}
									variant="ghost"
								>
									Cancel
								</Button>
							</div>
						</div>
					)}

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

					{/* Wrong choice feedback */}
					{relationshipType && relationshipType !== 'has_many' && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-destructive/80 border border-destructive text-foreground px-6 py-3 rounded-lg z-10">
							Wrong relationship type!{' '}
							{relationshipType === 'has_one'
								? 'Only one comment shows.'
								: 'Comments would be shared between posts.'}
						</div>
					)}
				</PipelineCanvas>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="ActiveRecord associations define relationships between models: has_many, has_one, belongs_to. Choose the right one based on the real-world relationship."
				>
					{/* Relationship explanation */}
					{relationshipType && (
						<div
							className={`p-4 border-t ${relationshipType === 'has_many' ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'}`}
						>
							<div
								className={`text-xs font-semibold uppercase tracking-wider mb-2 ${relationshipType === 'has_many' ? 'text-success' : 'text-destructive'}`}
							>
								{relationshipType === 'has_many'
									? 'Correct!'
									: 'Not quite right'}
							</div>
							<p className="text-sm text-foreground">
								{relationshipType === 'has_many'
									? 'A Post has_many Comments is the correct one-to-many relationship. Each post can have multiple comments.'
									: relationshipType === 'has_one'
										? 'has_one limits each post to a single comment. Posts typically have many comments!'
										: 'has_and_belongs_to_many creates a many-to-many relationship. Comments belong to specific posts, not shared between them.'}
							</p>
						</div>
					)}
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level7Associations;
