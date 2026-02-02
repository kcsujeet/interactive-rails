/**
 * Canvas Node Component
 *
 * A node placed on the canvas that can be selected, connected, and dragged.
 */

import { useState, useRef, useEffect } from 'react';

interface CanvasNodeProps {
  id: string;
  type: string;
  name: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  selected?: boolean;
  locked?: boolean;
  glowColor?: string; // For transient/persisted states
  label?: string; // Additional label (e.g., "Post", "Comment")
  badge?: string; // Corner badge (e.g., "85" for complexity)
  badgeColor?: string;
  showConnectionPoints?: boolean;
  onSelect?: (id: string) => void;
  onStartConnection?: (id: string, point: 'input' | 'output') => void;
  onCompleteConnection?: (id: string, point: 'input' | 'output') => void;
  onDrag?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string) => void;
}

export function CanvasNode({
  id,
  type,
  name,
  icon,
  color,
  x,
  y,
  selected = false,
  locked = false,
  glowColor,
  label,
  badge,
  badgeColor = '#6b7280',
  showConnectionPoints = true,
  onSelect,
  onStartConnection,
  onCompleteConnection,
  onDrag,
  onDragEnd,
}: CanvasNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (locked) return;

    // Prevent default to avoid text selection
    e.preventDefault();
    e.stopPropagation();

    // Don't start a new drag if already dragging
    if (isDraggingRef.current) return;

    onSelect?.(id);

    if (onDrag) {
      // Clean up any existing drag session
      if (cleanupRef.current) {
        cleanupRef.current();
      }

      isDraggingRef.current = true;
      setIsDragging(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startNodeX = x;
      const startNodeY = y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Check if mouse button is still pressed (buttons === 1 means left button)
        // If not pressed, end the drag (handles missed mouseup events)
        if (moveEvent.buttons !== 1) {
          handleMouseUp();
          return;
        }
        if (!isDraggingRef.current) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        onDrag(id, startNodeX + dx, startNodeY + dy);
      };

      const handleMouseUp = () => {
        if (!isDraggingRef.current) return; // Prevent double cleanup
        isDraggingRef.current = false;
        setIsDragging(false);
        onDragEnd?.(id);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('blur', handleMouseUp);
        window.removeEventListener('contextmenu', handleMouseUp);
        cleanupRef.current = null;
      };

      // Store cleanup function
      cleanupRef.current = handleMouseUp;

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Also listen for blur (window loses focus) and contextmenu (right-click)
      window.addEventListener('blur', handleMouseUp);
      window.addEventListener('contextmenu', handleMouseUp);
    }
  };

  // Handle mouseup on the node body - complete connection to input
  const handleNodeMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    // When dropping on a node, complete connection to its input
    onCompleteConnection?.(id, 'input');
  };

  // Handle double-click - cleanup any stuck drag state
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cleanupRef.current) {
      cleanupRef.current();
    }
  };

  return (
    <div
      className={`
        absolute transform -translate-x-1/2 -translate-y-1/2
        ${isDragging ? 'z-50' : 'z-10'}
        ${locked ? 'cursor-default' : 'cursor-pointer'}
      `}
      style={{ left: x, top: y }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleNodeMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Glow effect */}
      {glowColor && (
        <div
          className="absolute inset-0 rounded-lg blur-md animate-pulse"
          style={{ backgroundColor: glowColor, transform: 'scale(1.2)' }}
        />
      )}

      {/* Main node */}
      <div
        className={`
          relative rounded-lg border-2 transition-all
          ${selected ? 'border-cyan-400 shadow-lg shadow-cyan-900/50' : 'border-gray-600'}
          ${locked ? 'opacity-75' : 'hover:border-gray-500'}
        `}
        style={{ backgroundColor: `${color}20`, borderColor: selected ? undefined : color }}
      >
        <div className="px-4 py-3 min-w-[100px]">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <div className="text-sm font-semibold text-white">{name}</div>
              {label && <div className="text-xs text-gray-400">{label}</div>}
            </div>
          </div>
        </div>

        {/* Lock icon */}
        {locked && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {/* Badge */}
        {badge && (
          <div
            className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded text-xs font-bold text-white"
            style={{ backgroundColor: badgeColor }}
          >
            {badge}
          </div>
        )}

        {/* Connection points - show even for locked nodes */}
        {showConnectionPoints && (
          <>
            {/* Input point (left) */}
            <div
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-600 border-2 border-cyan-500 hover:bg-cyan-800 hover:scale-125 transition-all cursor-crosshair z-20 flex items-center justify-center"
              onMouseUp={(e) => {
                e.stopPropagation();
                onCompleteConnection?.(id, 'input');
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartConnection?.(id, 'input');
              }}
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>

            {/* Output point (right) */}
            <div
              className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-600 border-2 border-cyan-500 hover:bg-cyan-800 hover:scale-125 transition-all cursor-crosshair z-20 flex items-center justify-center"
              onMouseUp={(e) => {
                e.stopPropagation();
                onCompleteConnection?.(id, 'output');
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartConnection?.(id, 'output');
              }}
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper to get node center position for connections
export function getNodeConnectionPoint(
  x: number,
  y: number,
  point: 'input' | 'output',
  nodeWidth: number = 120
): { x: number; y: number } {
  const halfWidth = nodeWidth / 2;
  return {
    x: point === 'input' ? x - halfWidth : x + halfWidth,
    y,
  };
}

export default CanvasNode;
