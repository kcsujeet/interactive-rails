/**
 * Custom sandbox edge with flowing dots.
 * Dot count and color scale with traffic volume.
 */

import {
	BaseEdge,
	type EdgeProps,
	getSmoothStepPath,
	useInternalNode,
} from '@xyflow/react';
import { useMemo } from 'react';

interface SandboxEdgeData {
	traffic?: number;
	[key: string]: unknown;
}

export function SandboxEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
}: EdgeProps) {
	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		borderRadius: 16,
	});

	const traffic = (data as SandboxEdgeData)?.traffic ?? 0;

	// Dot count scales: 0=none, 100=2, 500=5, 2000=10
	const dotCount =
		traffic <= 0
			? 0
			: Math.min(12, Math.max(1, Math.round(Math.log2(traffic))));

	// Faster dots at higher traffic
	const duration = traffic > 500 ? 0.8 : traffic > 100 ? 1.2 : 2;

	// Color: green -> amber -> red based on traffic
	const dotColor =
		traffic > 1000 ? '#ef4444' : traffic > 500 ? '#f59e0b' : '#22c55e';
	const dotSize = traffic > 500 ? 4 : traffic > 100 ? 3 : 2.5;

	const strokeColor =
		traffic > 1000
			? '#ef4444'
			: traffic > 500
				? '#f59e0b'
				: traffic > 0
					? '#22c55e'
					: '#71717a';

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					stroke: strokeColor,
					strokeWidth: traffic > 500 ? 2.5 : 1.5,
					strokeDasharray: undefined,
				}}
			/>
			{dotCount > 0 && (
				<g>
					{Array.from({ length: dotCount }, (_, i) => (
						<circle fill={dotColor} key={`${id}-dot-${i}`} r={dotSize}>
							<animateMotion
								begin={`${-(i / dotCount) * duration}s`}
								dur={`${duration}s`}
								path={edgePath}
								repeatCount="indefinite"
							/>
						</circle>
					))}
				</g>
			)}
		</>
	);
}
