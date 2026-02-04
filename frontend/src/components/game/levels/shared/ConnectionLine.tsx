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
		<g className={onClick ? 'cursor-pointer' : ''} onClick={onClick}>
			{/* Invisible wider path for easier clicking */}
			{onClick && (
				<path d={path} fill="none" stroke="transparent" strokeWidth={20} />
			)}

			{/* Main line */}
			<path
				className={animated ? 'animate-pulse' : ''}
				d={path}
				fill="none"
				stroke={strokeColor}
				strokeDasharray={dashed ? '5,5' : undefined}
				strokeWidth={strokeWidth}
			/>

			{/* Animated flow dots */}
			{animated && !invalid && (
				<>
					<circle fill={strokeColor} r="3">
						<animateMotion dur="2s" path={path} repeatCount="indefinite" />
					</circle>
					<circle fill={strokeColor} r="3">
						<animateMotion
							begin="0.5s"
							dur="2s"
							path={path}
							repeatCount="indefinite"
						/>
					</circle>
					<circle fill={strokeColor} r="3">
						<animateMotion
							begin="1s"
							dur="2s"
							path={path}
							repeatCount="indefinite"
						/>
					</circle>
				</>
			)}

			{/* Arrow at end */}
			<ArrowHead
				angle={getAngle(endX - controlOffset, endY, endX, endY)}
				color={strokeColor}
				x={endX}
				y={endY}
			/>
		</g>
	);
}

// Helper to calculate angle for arrow head
function getAngle(x1: number, y1: number, x2: number, y2: number): number {
	return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
}

// Arrow head component
function ArrowHead({
	x,
	y,
	angle,
	color,
}: {
	x: number;
	y: number;
	angle: number;
	color: string;
}) {
	const size = 8;
	return (
		<polygon
			fill={color}
			points={`0,-${size / 2} ${size},0 0,${size / 2}`}
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
					<feGaussianBlur result="coloredBlur" stdDeviation="2" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			<g className="pointer-events-auto">
				{connections.map((conn) => (
					<ConnectionLine
						animated={conn.animated}
						color={conn.color}
						endX={conn.endX}
						endY={conn.endY}
						invalid={conn.invalid}
						key={conn.id}
						onClick={
							onConnectionClick ? () => onConnectionClick(conn.id) : undefined
						}
						selected={selectedConnectionId === conn.id}
						startX={conn.startX}
						startY={conn.startY}
					/>
				))}

				{pendingConnection && (
					<ConnectionLine
						color="#22d3ee"
						dashed
						endX={pendingConnection.endX}
						endY={pendingConnection.endY}
						startX={pendingConnection.startX}
						startY={pendingConnection.startY}
					/>
				)}
			</g>
		</svg>
	);
}

export default ConnectionLine;
