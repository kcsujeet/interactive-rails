/**
 * Level 7: Semantic Associations
 *
 * Add a Comment model and choose the correct relationship type.
 * Decision modal appears when connecting Model → Model.
 */

import type { MouseEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ValidationResult } from '@/components/levels';
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

const INITIAL_NODES = [
	{ id: 'request-1', type: 'request', x: 130, y: 280 },
	{ id: 'router-1', type: 'router', x: 350, y: 280 },
	{ id: 'controller-1', type: 'controller', x: 570, y: 280 },
	{
		id: 'post-model',
		type: 'model',
		x: 810,
		y: 150,
		config: { label: 'Post' },
	},
	{ id: 'database-1', type: 'database', x: 1060, y: 150 },
	{ id: 'serializer-1', type: 'serializer', x: 810, y: 410 },
	{ id: 'response-1', type: 'response', x: 1060, y: 410 },
] as const;

const INITIAL_CONNECTIONS = [
	{ id: 'c1', sourceNodeId: 'request-1', targetNodeId: 'router-1' },
	{ id: 'c2', sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
	{ id: 'c3', sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
	{ id: 'c4', sourceNodeId: 'post-model', targetNodeId: 'database-1' },
	{ id: 'c5', sourceNodeId: 'controller-1', targetNodeId: 'serializer-1' },
	{ id: 'c6', sourceNodeId: 'serializer-1', targetNodeId: 'response-1' },
] as const;

/** Find the comment model node (any model that isn't the initial post-model) */
function findCommentNode(
	nodes: { id: string; type: string; config?: { label?: string } }[],
) {
	return nodes.find((n) => n.type === 'model' && n.id !== 'post-model');
}

export function Level7Associations({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// Pre-built pipeline with Post model
	const pipeline = usePipelineState({
		initialNodes: [...INITIAL_NODES],
		initialConnections: [...INITIAL_CONNECTIONS],
		onBeforeDrop: (type, nodes) => {
			// Only allow dropping a model if no comment model exists yet
			return type === 'model' && !findCommentNode(nodes);
		},
	});

	const [commentAdded, setCommentAdded] = useState(false);
	const [relationshipType, setRelationshipType] = useState<string | null>(null);
	const [showDecisionModal, setShowDecisionModal] = useState(false);
	const [pendingRelationship, setPendingRelationship] = useState<{
		sourceNodeId: string;
		targetNodeId: string;
	} | null>(null);

	// Detect when Comment model is added and update its label
	useEffect(() => {
		const commentNode = findCommentNode(pipeline.placedNodes);
		if (commentNode && !commentNode.config?.label) {
			pipeline.updateNode(commentNode.id, { config: { label: 'Comment' } });
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

	// Validate the current pipeline state for the Submit button
	const handleValidate = useCallback((): ValidationResult => {
		if (!commentAdded) {
			return {
				valid: false,
				message: 'Add the Comment model',
				details: ['Drag the Comment model onto the canvas'],
			};
		}
		if (!relationshipType) {
			return {
				valid: false,
				message: 'Connect the models',
				details: ['Draw a connection from Post to Comment'],
			};
		}
		if (relationshipType !== 'has_many') {
			return {
				valid: false,
				message: 'Wrong relationship type',
				details: ['Think about how many comments a post can have'],
			};
		}
		return {
			valid: true,
			message: 'Correct! has_many is the right relationship.',
		};
	}, [commentAdded, relationshipType]);

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
				filename: 'app/serializers/post_serializer.rb',
				language: 'ruby',
				code:
					relationshipType === 'has_many'
						? `class PostSerializer < BaseSerializer
  attribute :title
  attribute :body

  has_many :comments, serializer: CommentSerializer
end

# GET /api/v1/posts/1
# => { "data": { "id": "1", "type": "posts",
#      "attributes": { "title": "Hello" },
#      "relationships": { "comments": { "data": [...] } } } }`
						: relationshipType === 'has_one'
							? `class PostSerializer < BaseSerializer
  attribute :title
  attribute :body

  has_one :comment, serializer: CommentSerializer
end

# GET /api/v1/posts/1
# => { "data": { "id": "1", "type": "posts",
#      "attributes": { "title": "Hello" },
#      "relationships": { "comment": { "data": {...} } } } }
# Only ONE comment per post!`
							: `class PostSerializer < BaseSerializer
  attribute :title
  attribute :body

  has_many :comments, serializer: CommentSerializer
end

# has_and_belongs_to_many means comments are
# shared between posts — not what you want here!`,
				highlight: relationshipType === 'has_many' ? [5] : [12, 13],
			});
		}

		return files;
	};

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
					<NodePalette>
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
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						pipeline.setPlacedNodes([...INITIAL_NODES]);
						pipeline.setConnections([...INITIAL_CONNECTIONS]);
						setCommentAdded(false);
						setRelationshipType(null);
					}}
					onValidate={handleValidate}
				/>

				<PipelineCanvas
					canvasRef={pipeline.canvasRef}
					connections={pipeline.connections}
					draggedNodeType={pipeline.draggedNodeType}
					draggingNodeId={pipeline.draggingNodeId}
					onClick={pipeline.handleCanvasClick}
					onCompleteConnection={(e: MouseEvent, targetNodeId: string) => {
						if (pipeline.pendingConnection) {
							const allowed = handleConnectionCreated(
								pipeline.pendingConnection.sourceNodeId,
								targetNodeId,
							);
							if (allowed) {
								pipeline.completeConnection(e, targetNodeId);
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
											consequence: 'Limits posts to a single comment',
										},
										{
											value: 'has_many',
											label: 'has_many',
											consequence: 'Posts can have unlimited comments',
										},
										{
											value: 'has_and_belongs_to_many',
											label: 'has_and_belongs_to_many',
											consequence:
												'Comments are shared between posts via a join table',
										},
									].map((option) => (
										<Button
											className="w-full p-4 h-auto rounded-lg text-left transition-all border-border hover:border-primary hover:bg-primary/5"
											key={option.value}
											onClick={() => handleRelationshipChoice(option.value)}
											variant="outline"
										>
											<div className="w-full">
												<span className="font-mono text-primary">
													{option.label}
												</span>
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
				</PipelineCanvas>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="ActiveRecord associations define relationships between models: has_many, has_one, belongs_to. Choose the right one based on the real-world relationship."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level7Associations;
