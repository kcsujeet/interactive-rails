/**
 * Level 11: Separation of Concerns
 *
 * Player places code blocks into the correct architectural layer.
 * Teaches: Controllers handle HTTP, Models handle data, Services handle business logic.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';

interface CodeBlock {
	id: string;
	name: string;
	code: string;
	color: string;
	description: string;
	correctTarget: 'controller' | 'model' | 'service';
	currentLocation: string | null;
}

const CODE_BLOCKS: CodeBlock[] = [
	{
		id: 'params',
		name: 'Permit Params',
		code: 'params.require(:order).permit(:product_id, :quantity)',
		color: '#3b82f6',
		description: 'Handles incoming HTTP parameters',
		correctTarget: 'controller',
		currentLocation: null,
	},
	{
		id: 'response',
		name: 'Render Response',
		code: 'render json: { order: @order }, status: :created',
		color: '#06b6d4',
		description: 'Formats HTTP response',
		correctTarget: 'controller',
		currentLocation: null,
	},
	{
		id: 'validation',
		name: 'Validation',
		code: 'validates :total, numericality: { greater_than: 0 }',
		color: '#22c55e',
		description: 'Ensures data integrity',
		correctTarget: 'model',
		currentLocation: null,
	},
	{
		id: 'association',
		name: 'Association',
		code: 'belongs_to :user\nhas_many :line_items',
		color: '#10b981',
		description: 'Defines data relationships',
		correctTarget: 'model',
		currentLocation: null,
	},
	{
		id: 'payment',
		name: 'Process Payment',
		code: 'Stripe::Charge.create(amount: total_cents)',
		color: '#f59e0b',
		description: 'External API integration',
		correctTarget: 'service',
		currentLocation: null,
	},
	{
		id: 'email',
		name: 'Send Receipt',
		code: 'OrderMailer.receipt(@order).deliver_later',
		color: '#ef4444',
		description: 'Triggers side effects',
		correctTarget: 'service',
		currentLocation: null,
	},
];

const ARCHITECTURE_NODES = [
	{
		id: 'controller',
		name: 'OrdersController',
		description: 'HTTP layer - requests & responses',
		icon: 'C',
		color: '#3b82f6',
	},
	{
		id: 'model',
		name: 'Order',
		description: 'Data layer - structure & validation',
		icon: 'M',
		color: '#22c55e',
	},
	{
		id: 'service',
		name: 'CheckoutService',
		description: 'Business layer - logic & orchestration',
		icon: 'S',
		color: '#f59e0b',
	},
];

export function Level11SeparationOfConcerns({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [blocks, setBlocks] = useState<CodeBlock[]>(CODE_BLOCKS);
	const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
	const [dragOverNode, setDragOverNode] = useState<string | null>(null);

	const correctlyPlaced = blocks.filter(
		(b) => b.currentLocation === b.correctTarget,
	);

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		const unplacedBlocks = blocks.filter((b) => b.currentLocation === null);
		if (unplacedBlocks.length > 0) {
			errors.push(`${unplacedBlocks.length} block(s) still need to be placed`);
		}

		for (const block of blocks) {
			if (
				block.currentLocation &&
				block.currentLocation !== block.correctTarget
			) {
				const targetNode = ARCHITECTURE_NODES.find(
					(n) => n.id === block.currentLocation,
				);
				errors.push(
					`"${block.name}" doesn't belong in ${targetNode?.name || 'that location'}`,
				);
			}
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Architecture needs adjustment!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Clean architecture - each layer has a single responsibility!',
		};
	};

	const handleDragStart = (blockId: string) => setDraggedBlock(blockId);
	const handleDragEnd = () => {
		setDraggedBlock(null);
		setDragOverNode(null);
	};

	const handleDropOnNode = (nodeId: string) => {
		if (!draggedBlock) return;
		setBlocks((prev) =>
			prev.map((b) =>
				b.id === draggedBlock ? { ...b, currentLocation: nodeId } : b,
			),
		);
		setDraggedBlock(null);
		setDragOverNode(null);
	};

	const handleRemoveFromNode = (blockId: string) => {
		setBlocks((prev) =>
			prev.map((b) => (b.id === blockId ? { ...b, currentLocation: null } : b)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level11-separation-of-concerns', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getBlocksForNode = (nodeId: string) =>
		blocks.filter((b) => b.currentLocation === nodeId);
	const paletteBlocks = blocks.filter((b) => b.currentLocation === null);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Single Responsibility Principle - each layer should have one job."
					instructions={[
						'Drag code blocks to the correct layer',
						'Controller: HTTP concerns (params, responses)',
						'Model: Data concerns (validations, associations)',
						'Service: Business logic (payments, emails)',
					]}
					scenario="Your checkout controller is 500 lines of spaghetti. Payment logic, email sending, validations - all mixed together. Time to organize."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Code Blocks ({paletteBlocks.length} remaining)
						</div>
						<div className="space-y-2">
							{paletteBlocks.map((block) => (
								<div
									className="p-3 rounded-lg cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity border-2 border-transparent hover:border-foreground/20"
									draggable
									key={block.id}
									onDragEnd={handleDragEnd}
									onDragStart={() => handleDragStart(block.id)}
									style={{ backgroundColor: block.color }}
								>
									<div className="text-foreground text-sm font-medium">
										{block.name}
									</div>
									<div className="text-foreground/60 text-xs mt-1">
										{block.description}
									</div>
								</div>
							))}
							{paletteBlocks.length === 0 && (
								<div className="text-muted-foreground text-sm text-center py-4">
									All blocks placed!
								</div>
							)}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Progress
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Correctly Placed</span>
							<span
								className={
									correctlyPlaced.length === blocks.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{correctlyPlaced.length} / {blocks.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{
									width: `${(correctlyPlaced.length / blocks.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Separation of Concerns"
					levelNumber={11}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => setBlocks(CODE_BLOCKS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8">
					<div className="relative h-full flex items-center justify-center gap-8">
						{ARCHITECTURE_NODES.map((node) => {
							const nodeBlocks = getBlocksForNode(node.id);

							return (
								<div
									className={`w-64 transition-all ${dragOverNode === node.id ? 'scale-105' : ''}`}
									key={node.id}
									onDragLeave={() => setDragOverNode(null)}
									onDragOver={(e) => {
										e.preventDefault();
										setDragOverNode(node.id);
									}}
									onDrop={() => handleDropOnNode(node.id)}
								>
									<div
										className={`rounded-xl border-2 p-4 min-h-[300px] transition-all ${
											dragOverNode === node.id
												? 'border-foreground bg-foreground/10'
												: 'border-border bg-card/50'
										}`}
									>
										<div className="flex items-center gap-3 mb-4">
											<span
												className="w-10 h-10 rounded-lg flex items-center justify-center text-foreground font-bold text-lg"
												style={{ backgroundColor: node.color }}
											>
												{node.icon}
											</span>
											<div>
												<div className="text-foreground font-semibold">
													{node.name}
												</div>
												<div className="text-xs text-muted-foreground">
													{node.description}
												</div>
											</div>
										</div>

										<div className="space-y-2 min-h-[180px]">
											{nodeBlocks.length > 0 ? (
												nodeBlocks.map((block) => {
													const isCorrect = block.correctTarget === node.id;
													return (
														<div
															className={`p-3 rounded-lg relative group ${isCorrect ? 'ring-2 ring-success' : ''}`}
															key={block.id}
															style={{ backgroundColor: block.color }}
														>
															<div className="text-foreground text-sm font-medium">
																{block.name}
															</div>
															<div className="text-foreground/60 text-xs font-mono mt-1 truncate">
																{block.code.split('\n')[0]}
															</div>
															<Button
																className="absolute top-1 right-1 w-5 h-5 rounded bg-black/30 text-foreground/70 hover:text-foreground hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
																onClick={() => handleRemoveFromNode(block.id)}
																size="icon"
																variant="ghost"
															>
																×
															</Button>
														</div>
													);
												})
											) : (
												<div
													className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
														dragOverNode === node.id
															? 'border-foreground/50 text-foreground/70'
															: 'border-border text-muted-foreground'
													}`}
												>
													Drop code here
												</div>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/controllers/orders_controller.rb',
							language: 'ruby',
							code: `class OrdersController < ApplicationController
  def create
    ${getBlocksForNode('controller').find((b) => b.id === 'params')?.code || '# Handle params here'}

    result = CheckoutService.new(@order).call

    if result.success?
      ${getBlocksForNode('controller').find((b) => b.id === 'response')?.code || '# Render response here'}
    end
  end
end`,
							highlight: [3, 8],
						},
					]}
					learningGoal="Single Responsibility Principle: Controllers handle HTTP, Models handle data, Services handle business logic."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Why Separate Concerns?
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ Easier to test each layer independently</li>
							<li>+ Changes in one layer don't break others</li>
							<li>+ New team members understand faster</li>
							<li>+ Scales to larger teams and codebases</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level11SeparationOfConcerns;
