/**
 * Draggable Node Component
 *
 * Palette item that can be dragged to the canvas.
 */

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
        p-3 rounded-lg border transition-all
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
			style={{ borderLeftColor: color, borderLeftWidth: 4 }}
		>
			<div className="flex items-start justify-between mb-1">
				<div className="flex items-center gap-2">
					<span className="text-lg">{icon}</span>
					<span className="font-medium text-foreground text-sm">{name}</span>
				</div>
			</div>
			<p className="text-xs text-muted-foreground mb-1">{description}</p>
			{warning && <p className="text-xs text-warning">! {warning}</p>}
			{benefit && <p className="text-xs text-success">* {benefit}</p>}
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
