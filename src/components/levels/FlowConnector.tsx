/**
 * FlowConnector - Animated dot connector between pipeline zones.
 *
 * Renders a thin gray line with animated dots traveling along it,
 * matching PipelineFlow's visual style. Replaces static ArrowDown icons
 * and dashed border edges between zones in custom visualizations.
 *
 * Dots animate using percentage-based top/left in CSS keyframes
 * (relative to the track container height/width).
 */

interface FlowConnectorProps {
	/** Direction of the connector line and dot travel */
	direction?: 'vertical' | 'horizontal';
	/** When true, dots animate along the line */
	active?: boolean;
	/** Tailwind bg class for dots (e.g. 'bg-primary', 'bg-destructive') */
	dotColor?: string;
	/** Number of animated dots (default 3) */
	dotCount?: number;
	/** Optional className override for custom sizing (must include `relative`) */
	className?: string;
}

export function FlowConnector({
	direction = 'vertical',
	active = false,
	dotColor = 'bg-primary',
	dotCount = 3,
	className,
}: FlowConnectorProps) {
	const isVertical = direction === 'vertical';

	return (
		<div
			className={className ?? `relative ${isVertical ? 'h-8 w-4' : 'w-16 h-4'}`}
		>
			{/* Static gray line */}
			<div
				className={`absolute ${
					isVertical
						? 'w-0.5 h-full left-1/2 -translate-x-1/2 top-0'
						: 'h-0.5 w-full top-1/2 -translate-y-1/2 left-0'
				} bg-muted-foreground/20 rounded-full`}
			/>

			{/* Track container for dots (clips overflow at edges) */}
			{active && (
				<div
					className={`absolute overflow-hidden ${
						isVertical
							? 'left-1/2 -translate-x-1/2 top-0 w-2 h-full'
							: 'top-1/2 -translate-y-1/2 left-0 h-2 w-full'
					}`}
				>
					{Array.from({ length: dotCount }, (_, i) => (
						<div
							className={`absolute w-2 h-2 rounded-full ${dotColor} ${
								isVertical ? 'animate-flow-dot-down' : 'animate-flow-dot-right'
							}`}
							// biome-ignore lint/suspicious/noArrayIndexKey: dots are fixed-position decorative elements; index is identity
							key={i}
							style={{
								animationDelay: `${(i * 1.5) / dotCount}s`,
							}}
						/>
					))}
				</div>
			)}
		</div>
	);
}
