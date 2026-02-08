/**
 * Draggable Node Component
 *
 * Palette item that can be dragged to the canvas.
 */

import { GripVertical } from 'lucide-react';

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
	description,
	icon,
	color,
	disabled = false,
	isDragging = false,
	warning,
	benefit,
	onDragStart,
	onDragEnd,
}: DraggableNodeProps) {
	return (
		<div
			className={`
        flex items-center gap-2.5 w-full px-4 py-2.5 rounded-lg border transition-all text-sm
        ${
					disabled
						? 'bg-card/50 border-border opacity-50 cursor-not-allowed'
						: isDragging
							? 'opacity-50 border-dashed cursor-grabbing'
							: 'bg-card border-border hover:border-primary cursor-grab active:cursor-grabbing'
				}
      `}
			draggable={!disabled}
			onDragEnd={onDragEnd}
			onDragStart={(e) => {
				e.dataTransfer.setData('nodeType', type);
				onDragStart(e, type);
			}}
		>
			<span
				className="w-3 h-3 rounded-full shrink-0"
				style={{ backgroundColor: color }}
			/>
			<span className="font-medium text-foreground flex-1">{name}</span>
			<GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
		</div>
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
			<h3 className="text-sm font-semibold text-foreground mb-1">
				{title}
			</h3>
			<p className="text-xs text-muted-foreground mb-3">
				Drag components onto the canvas
			</p>
			{children}
		</div>
	);
}

export default DraggableNode;
