/**
 * Slot Container Component
 *
 * A droppable slot for Level 1's technology choices.
 * Accepts specific node types (e.g., postgresql/sqlite for database slot).
 */

import { useState } from 'react';
import type { SlotConfig } from './types';
import { getNodeInfo } from './data';

interface SlotContainerProps {
  slot: SlotConfig;
  onFill: (nodeType: string) => void;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
}

export function SlotContainer({
  slot,
  onFill,
  isDragOver,
  onDragEnter,
  onDragLeave,
}: SlotContainerProps) {
  const filledNode = slot.filled ? getNodeInfo(slot.filled) : null;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (slot.acceptTypes.includes(nodeType)) {
      onFill(nodeType);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (slot.acceptTypes.includes(nodeType)) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  return (
    <div
      className="absolute"
      style={{ left: slot.position.x, top: slot.position.y }}
    >
      <div className="text-center mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wider">
          {slot.label}
        </span>
      </div>
      <div
        className={`
          w-32 h-32 rounded-lg border-2 border-dashed
          flex items-center justify-center
          transition-all duration-200
          ${slot.filled
            ? 'border-green-500 bg-green-500/10'
            : isDragOver
              ? 'border-blue-500 bg-blue-500/20 scale-105'
              : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
          }
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
      >
        {filledNode ? (
          <FilledSlot node={filledNode} />
        ) : (
          <EmptySlot acceptTypes={slot.acceptTypes} />
        )}
      </div>
    </div>
  );
}

interface FilledSlotProps {
  node: ReturnType<typeof getNodeInfo>;
}

function FilledSlot({ node }: FilledSlotProps) {
  return (
    <div className="text-center">
      <div
        className="w-12 h-12 rounded-lg mx-auto mb-2 flex items-center justify-center text-2xl"
        style={{ backgroundColor: node.color }}
      >
        {node.icon}
      </div>
      <div className="text-sm font-medium text-white">{node.name}</div>
      <div className="text-xs text-green-400 mt-1">Selected</div>
    </div>
  );
}

interface EmptySlotProps {
  acceptTypes: string[];
}

function EmptySlot({ acceptTypes }: EmptySlotProps) {
  return (
    <div className="text-center text-gray-500">
      <div className="text-2xl mb-1">+</div>
      <div className="text-xs">
        Drop {acceptTypes.map(t => getNodeInfo(t).name).join(' or ')}
      </div>
    </div>
  );
}

export default SlotContainer;
