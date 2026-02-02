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
  warning,
  benefit,
  onDragStart,
  onDragEnd,
}: DraggableNodeProps) {
  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData('nodeType', type);
        onDragStart(e, type);
      }}
      onDragEnd={onDragEnd}
      className={`
        p-3 rounded-lg border transition-all
        ${
          disabled
            ? 'bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed'
            : 'bg-gray-800 border-gray-700 hover:border-cyan-600 cursor-grab active:cursor-grabbing'
        }
      `}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-medium text-white text-sm">{name}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-1">{description}</p>
      {warning && <p className="text-xs text-yellow-500">! {warning}</p>}
      {benefit && <p className="text-xs text-green-500">* {benefit}</p>}
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
      <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// Full palette container
interface NodePaletteProps {
  title?: string;
  children: React.ReactNode;
}

export function NodePalette({ title = 'Component Palette', children }: NodePaletteProps) {
  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default DraggableNode;
