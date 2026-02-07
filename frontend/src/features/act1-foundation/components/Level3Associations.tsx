/**
 * Level 3: Semantic Associations
 *
 * Add a Comment model and choose the correct relationship type.
 * Decision modal appears when connecting Model → Model.
 */

import { useState } from 'react';
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

export function Level3Associations({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// Track whether comment has been added
	const [commentAdded, setCommentAdded] = useState(false);

	// Pre-built pipeline with Post model
	const pipeline = usePipelineState({
		initialNodes: [
			{ id: 'request-1', type: 'request', x: 80, y: 250, config: { locked: true } },
			{ id: 'router-1', type: 'router', x: 200, y: 250, config: { locked: true } },
			{ id: 'controller-1', type: 'controller', x: 340, y: 250, config: { locked: true } },
			{ id: 'post-model', type: 'model', x: 500, y: 250, config: { label: 'Post', locked: true } },
			{ id: 'database-1', type: 'database', x: 680, y: 250, config: { locked: true } },
			{ id: 'view-1', type: 'view', x: 840, y: 250, config: { locked: true } },
			{ id: 'response-1', type: 'response', x: 980, y: 250, config: { locked: true } },
		],
		initialConnections: [
			{ id: 'c1', sourceNodeId: 'request-1', targetNodeId: 'router-1' },
			{ id: 'c2', sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
			{ id: 'c3', sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
			{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-1' },
			{ id: 'c5', sourceNodeId: 'database-1', targetNodeId: 'view-1' },
			{ id: 'c6', sourceNodeId: 'view-1', targetNodeId: 'response-1' },
		],
		onBeforeDrop: (type, nodes) => type === 'model' && !commentAdded,
		onNodeDropped: (node) => {
			if (node.type === 'model') {
				setCommentAdded(true);
				// Update the node config to set the label to 'Comment'
				pipeline.setPlacedNodes((prev) =>
					prev.map((n) =>
						n.id === node.id
							? { ...n, config: { ...n.config, label: 'Comment' } }
							: n,
					),
				);
			}
		},
		onConnectionCreated: (conn) => {
			// Check if both nodes are models
			const sourceNode = pipeline.placedNodes.find((n) => n.id === conn.sourceNodeId);
			const targetNode = pipeline.placedNodes.find((n) => n.id === conn.targetNodeId);
			if (sourceNode?.type === 'model' && targetNode?.type === 'model') {
				// Show decision modal for relationship type
				setPendingRelationship({
					connectionId: conn.id,
					sourceId: conn.sourceNodeId,
					targetId: conn.targetNodeId,
				});
				setShowDecisionModal(true);
			}
		},
	});

	// Relationship type state
	const [relationshipType, setRelationshipType] = useState<string | null>(null);
	const [showDecisionModal, setShowDecisionModal] = useState(false);
	const [pendingRelationship, setPendingRelationship] = useState<{
		connectionId: string;
		sourceId: string;
		targetId: string;
	} | null>(null);

	// Check if level is complete
	const isComplete = relationshipType === 'has_many';

	// Handle decision modal choice
	const handleRelationshipChoice = (choice: string) => {
		setRelationshipType(choice);
		setShowDecisionModal(false);
		setPendingRelationship(null);
	};

	// Handle completing the level
	const handleComplete = async () => {
		const success = await completeLevel('act1-level3-associations', {
			stars: 3,
			decisions: { relationship: relationshipType! },
		});
		if (success) {
			onComplete({ stars: 3, decisions: { relationship: relationshipType! } });
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

		// Show what happens in view
		if (relationshipType) {
			files.push({
				filename: 'app/views/posts/show.html.erb',
				language: 'ruby',
				code:
					relationshipType === 'has_many'
						? `<h1><%= @post.title %></h1>

<h2>Comments (<%= @post.comments.count %>)</h2>
<% @post.comments.each do |comment| %>
  <div class="comment">
    <%= comment.body %>
  </div>
<% end %>`
						: `<h1><%= @post.title %></h1>

<h2>Comment</h2>
<% if @post.comment %>
  <div class="comment">
    <%= @post.comment.body %>
  </div>
<% end %>
<!-- Only showing ONE comment! -->`,
				highlight: relationshipType === 'has_many' ? [3, 4, 5] : [8],
			});
		}

		return files;
	};

	// Get connection color based on relationship type
	const getConnectionColor = (conn: typeof pipeline.connections[0]) => {
		const sourceNode = pipeline.placedNodes.find((n) => n.id === conn.sourceNodeId);
		const targetNode = pipeline.placedNodes.find((n) => n.id === conn.targetNodeId);
		const isModelConnection = sourceNode?.type === 'model' && targetNode?.type === 'model';

		if (isModelConnection) {
			if (relationshipType === 'has_many') return '#22c55e';
			if (relationshipType) return '#ef4444';
			return '#8b5cf6';
		}
		return '#6b7280';
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Add Comments to Posts using the correct ActiveRecord association."
					instructions={[
						'Drag the Comment Model to the canvas',
						'Connect the Post Model to the Comment Model',
						'Choose the correct relationship type in the dialog',
					]}
					scenario="We have a Blog, but we can't show Comments. The data isn't linking."
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
					levelNumber={3}
					onExit={onExit}
					onReset={() => {
						pipeline.setPlacedNodes([
							{ id: 'request-1', type: 'request', x: 80, y: 250, config: { locked: true } },
							{ id: 'router-1', type: 'router', x: 200, y: 250, config: { locked: true } },
							{ id: 'controller-1', type: 'controller', x: 340, y: 250, config: { locked: true } },
							{ id: 'post-model', type: 'model', x: 500, y: 250, config: { label: 'Post', locked: true } },
							{ id: 'database-1', type: 'database', x: 680, y: 250, config: { locked: true } },
							{ id: 'view-1', type: 'view', x: 840, y: 250, config: { locked: true } },
							{ id: 'response-1', type: 'response', x: 980, y: 250, config: { locked: true } },
						]);
						pipeline.setConnections([
							{ id: 'c1', sourceNodeId: 'request-1', targetNodeId: 'router-1' },
							{ id: 'c2', sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
							{ id: 'c3', sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
							{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-1' },
							{ id: 'c5', sourceNodeId: 'database-1', targetNodeId: 'view-1' },
							{ id: 'c6', sourceNodeId: 'view-1', targetNodeId: 'response-1' },
						]);
						setCommentAdded(false);
						setRelationshipType(null);
					}}
				/>

				<PipelineCanvas
					canvasRef={pipeline.canvasRef}
					connections={pipeline.connections}
					connectionColorOverride={getConnectionColor}
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
											className={`w-full p-4 h-auto rounded-lg border text-left transition-all ${
												option.correct
													? 'border-border hover:border-success hover:bg-success/10'
													: 'border-border hover:border-muted-foreground hover:bg-secondary'
											}`}
											key={option.value}
											onClick={() => handleRelationshipChoice(option.value)}
											variant="outline"
										>
											<div className="flex flex-col w-full">
												<div className="flex items-center justify-between mb-1">
													<span className="font-mono text-primary">
														{option.label}
													</span>
													{option.correct && (
														<span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded">
															Recommended
														</span>
													)}
												</div>
												<div className="text-sm text-muted-foreground">
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
									className="mt-4 w-full"
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
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-destructive/80 border border-destructive text-destructive-foreground px-6 py-3 rounded-lg z-10">
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
					learningGoal="Understanding ActiveRecord associations: has_many, has_one, belongs_to, and when to use each."
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
							<p className="text-sm text-muted-foreground">
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

export default Level3Associations;
