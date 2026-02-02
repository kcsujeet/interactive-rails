/**
 * Connection Line Component
 *
 * SVG bezier curve connection between nodes.
 */

interface ConnectionLineProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  animated?: boolean;
  dashed?: boolean;
  invalid?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function ConnectionLine({
  startX,
  startY,
  endX,
  endY,
  color = '#6b7280',
  animated = false,
  dashed = false,
  invalid = false,
  selected = false,
  onClick,
}: ConnectionLineProps) {
  // Calculate control points for bezier curve
  const midX = (startX + endX) / 2;
  const dx = Math.abs(endX - startX);
  const controlOffset = Math.min(dx * 0.5, 100);

  const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

  const strokeColor = invalid ? '#ef4444' : selected ? '#22d3ee' : color;
  const strokeWidth = selected ? 3 : 2;

  return (
    <g onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>
      {/* Invisible wider path for easier clicking */}
      {onClick && (
        <path d={path} fill="none" stroke="transparent" strokeWidth={20} />
      )}

      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? '5,5' : undefined}
        className={animated ? 'animate-pulse' : ''}
      />

      {/* Animated flow dots */}
      {animated && !invalid && (
        <>
          <circle r="3" fill={strokeColor}>
            <animateMotion dur="2s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="3" fill={strokeColor}>
            <animateMotion dur="2s" repeatCount="indefinite" path={path} begin="0.5s" />
          </circle>
          <circle r="3" fill={strokeColor}>
            <animateMotion dur="2s" repeatCount="indefinite" path={path} begin="1s" />
          </circle>
        </>
      )}

      {/* Arrow at end */}
      <ArrowHead x={endX} y={endY} angle={getAngle(endX - controlOffset, endY, endX, endY)} color={strokeColor} />
    </g>
  );
}

// Helper to calculate angle for arrow head
function getAngle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
}

// Arrow head component
function ArrowHead({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const size = 8;
  return (
    <polygon
      points={`0,-${size / 2} ${size},0 0,${size / 2}`}
      fill={color}
      transform={`translate(${x - size}, ${y}) rotate(${angle}, ${size / 2}, 0)`}
    />
  );
}

// Connection layer that renders all connections
interface ConnectionLayerProps {
  connections: Array<{
    id: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color?: string;
    animated?: boolean;
    invalid?: boolean;
  }>;
  selectedConnectionId?: string | null;
  onConnectionClick?: (id: string) => void;
  pendingConnection?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null;
}

export function ConnectionLayer({
  connections,
  selectedConnectionId,
  onConnectionClick,
  pendingConnection,
}: ConnectionLayerProps) {
  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="pointer-events-auto">
        {connections.map((conn) => (
          <ConnectionLine
            key={conn.id}
            startX={conn.startX}
            startY={conn.startY}
            endX={conn.endX}
            endY={conn.endY}
            color={conn.color}
            animated={conn.animated}
            invalid={conn.invalid}
            selected={selectedConnectionId === conn.id}
            onClick={onConnectionClick ? () => onConnectionClick(conn.id) : undefined}
          />
        ))}

        {pendingConnection && (
          <ConnectionLine
            startX={pendingConnection.startX}
            startY={pendingConnection.startY}
            endX={pendingConnection.endX}
            endY={pendingConnection.endY}
            color="#22d3ee"
            dashed
          />
        )}
      </g>
    </svg>
  );
}

export default ConnectionLine;
