/**
 * Draggable Node Component
 *
 * Palette item that can be dragged to the canvas.
 * Wraps OptionCard with DotIcon for consistent styling.
 */

import { DotIcon, OptionCard, resolveColor } from './OptionCard';

interface DraggableNodeProps {
	type: string;
	name: string;
	description: string;
	icon: string;
	color: string;
	disabled?: boolean;
	isDragging?: boolean;
	warning?: string;
	benefit?: string;
	onDragStart: (e: React.DragEvent, type: string) => void;
	onDragEnd?: (e: React.DragEvent) => void;
}

export function DraggableNode({
	type,
	name,
	color,
	disabled = false,
	isDragging = false,
	onDragStart,
	onDragEnd,
}: DraggableNodeProps) {
	return (
		<OptionCard
			color={resolveColor(color)}
			disabled={disabled}
			dragData={type}
			dragType="nodeType"
			draggable
			icon={DotIcon}
			isDragging={isDragging}
			name={name}
			onDragEnd={onDragEnd}
			onDragStart={(e) => onDragStart(e, type)}
		/>
	);
}

// Node Palette wrapper for grouping nodes
interface NodePaletteGroupProps {
	title: string;
	children: React.ReactNode;
}

export function NodePaletteGroup({ title, children }: NodePaletteGroupProps) {
	return (
		<div className="mb-4">
			<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
				{title}
			</h4>
			<div className="space-y-2">{children}</div>
		</div>
	);
}

// Full palette container
interface NodePaletteProps {
	title?: string;
	children: React.ReactNode;
}

export function NodePalette({
	title = 'Pipeline Nodes',
	children,
}: NodePaletteProps) {
	return (
		<div className="p-4">
			<h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
			<p className="text-xs text-muted-foreground mb-3">
				Drag components onto the canvas
			</p>
			{children}
		</div>
	);
}

export default DraggableNode;
