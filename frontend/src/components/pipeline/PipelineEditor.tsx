/**
 * PipelineEditor Component
 *
 * Main container component that combines the pipeline canvas with the node palette.
 * Wraps everything in ReactFlowProvider for proper context.
 */

import { ReactFlowProvider } from '@xyflow/react';
import PipelineCanvas from './PipelineCanvas';
import NodePalette from './NodePalette';
import clsx from 'clsx';

interface PipelineEditorProps {
  className?: string;
  isReadOnly?: boolean;
  showPalette?: boolean;
}

export default function PipelineEditor({
  className,
  isReadOnly = false,
  showPalette = true,
}: PipelineEditorProps) {
  return (
    <ReactFlowProvider>
      <div className={clsx('flex h-full w-full', className)}>
        {/* Node Palette (left sidebar) */}
        {showPalette && !isReadOnly && (
          <NodePalette className="w-72 flex-shrink-0" />
        )}

        {/* Pipeline Canvas (main area) */}
        <div className="flex-1 relative">
          <PipelineCanvas isReadOnly={isReadOnly} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
