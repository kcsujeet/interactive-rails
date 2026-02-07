// Enemy sprite rendering with animations

import { useMemo } from 'react';
import type { Enemy, EnemyType } from "@/stores/simulation";
import { ENEMY_DEFINITIONS } from "@/types/level";

interface EnemySpriteProps {
	enemy: Enemy;
	scale?: number;
	showHealthBar?: boolean;
	showLabel?: boolean;
	onClick?: () => void;
	className?: string;
}

// Simple SVG-based enemy sprites
function getEnemySprite(type: EnemyType): React.ReactNode {
	switch (type) {
		case 'query_swarm':
			// Small flying database icons
			return (
				<g>
					<circle cx="12" cy="12" fill="currentColor" opacity="0.8" r="8" />
					<circle cx="8" cy="8" fill="currentColor" r="4" />
					<circle cx="16" cy="8" fill="currentColor" r="4" />
					<circle cx="12" cy="16" fill="currentColor" r="4" />
					<text
						fill="white"
						fontSize="8"
						fontWeight="bold"
						textAnchor="middle"
						x="12"
						y="14"
					>
						N+1
					</text>
				</g>
			);

		case 'memory_blob':
			// Amorphous blob shape
			return (
				<g>
					<ellipse
						cx="12"
						cy="14"
						fill="currentColor"
						opacity="0.6"
						rx="10"
						ry="8"
					>
						<animate
							attributeName="rx"
							dur="2s"
							repeatCount="indefinite"
							values="10;12;10"
						/>
						<animate
							attributeName="ry"
							dur="2s"
							repeatCount="indefinite"
							values="8;10;8"
						/>
					</ellipse>
					<ellipse
						cx="14"
						cy="10"
						fill="currentColor"
						opacity="0.8"
						rx="6"
						ry="5"
					/>
					<ellipse cx="8" cy="12" fill="currentColor" rx="4" ry="3" />
				</g>
			);

		case 'callback_chain':
			// Chain links
			return (
				<g>
					<circle
						cx="6"
						cy="12"
						fill="none"
						r="4"
						stroke="currentColor"
						strokeWidth="2"
					/>
					<circle
						cx="12"
						cy="12"
						fill="none"
						r="4"
						stroke="currentColor"
						strokeWidth="2"
					/>
					<circle
						cx="18"
						cy="12"
						fill="none"
						r="4"
						stroke="currentColor"
						strokeWidth="2"
					/>
					<line
						stroke="currentColor"
						strokeWidth="2"
						x1="10"
						x2="8"
						y1="12"
						y2="12"
					/>
					<line
						stroke="currentColor"
						strokeWidth="2"
						x1="16"
						x2="14"
						y1="12"
						y2="12"
					/>
				</g>
			);

		case 'timeout_wraith':
			// Ghost-like figure
			return (
				<g>
					<path
						d="M12 2 C6 2 4 8 4 14 L4 22 L7 19 L10 22 L12 19 L14 22 L17 19 L20 22 L20 14 C20 8 18 2 12 2"
						fill="currentColor"
						opacity="0.7"
					>
						<animate
							attributeName="opacity"
							dur="1.5s"
							repeatCount="indefinite"
							values="0.7;0.4;0.7"
						/>
					</path>
					<circle cx="9" cy="10" fill="white" r="2" />
					<circle cx="15" cy="10" fill="white" r="2" />
				</g>
			);

		case 'error_spike':
			// Spiky shape
			return (
				<g>
					<polygon
						fill="currentColor"
						points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10"
					>
						<animateTransform
							attributeName="transform"
							dur="4s"
							from="0 12 12"
							repeatCount="indefinite"
							to="360 12 12"
							type="rotate"
						/>
					</polygon>
					<text
						fill="white"
						fontSize="6"
						fontWeight="bold"
						textAnchor="middle"
						x="12"
						y="14"
					>
						ERR
					</text>
				</g>
			);

		case 'cache_phantom':
			// Transparent/dotted outline
			return (
				<g>
					<circle
						cx="12"
						cy="12"
						fill="currentColor"
						opacity="0.3"
						r="10"
						stroke="currentColor"
						strokeDasharray="2 2"
						strokeWidth="1"
					>
						<animate
							attributeName="opacity"
							dur="1s"
							repeatCount="indefinite"
							values="0.3;0.1;0.3"
						/>
					</circle>
					<text
						fill="currentColor"
						fontSize="8"
						textAnchor="middle"
						x="12"
						y="14"
					>
						MISS
					</text>
				</g>
			);

		default:
			// Generic enemy
			return <circle cx="12" cy="12" fill="currentColor" r="10" />;
	}
}

export function EnemySprite({
	enemy,
	scale = 1,
	showHealthBar = true,
	showLabel = false,
	onClick,
	className = '',
}: EnemySpriteProps) {
	const definition = ENEMY_DEFINITIONS[enemy.type];
	const hpPercent = (enemy.hp / enemy.maxHp) * 100;

	const sizeMultiplier = useMemo(() => {
		switch (definition.size) {
			case 'small':
				return 0.75;
			case 'medium':
				return 1;
			case 'large':
				return 1.5;
			case 'boss':
				return 2;
			default:
				return 1;
		}
	}, [definition.size]);

	const finalScale = scale * sizeMultiplier;
	const size = 24 * finalScale;

	// Animation based on behavior
	const animationClass = useMemo(() => {
		switch (definition.behavior) {
			case 'swarm':
				return 'animate-bounce';
			case 'grow':
				return 'animate-pulse';
			case 'phase':
				return enemy.isActive ? '' : 'opacity-30';
			case 'spike':
				return 'animate-ping';
			default:
				return '';
		}
	}, [definition.behavior, enemy.isActive]);

	return (
		<div
			className={`relative inline-flex flex-col items-center ${className}`}
			onClick={onClick}
			style={{
				transform: `translate(${enemy.position.x}px, ${enemy.position.y}px)`,
			}}
		>
			{/* Enemy sprite */}
			<svg
				className={`${animationClass} ${onClick ? 'cursor-pointer' : ''}`}
				height={size}
				style={{ color: definition.color }}
				viewBox="0 0 24 24"
				width={size}
			>
				{getEnemySprite(enemy.type)}
			</svg>

			{/* Health bar */}
			{showHealthBar && (
				<div
					className="w-full h-1 bg-secondary rounded-full overflow-hidden mt-1"
					style={{ width: size }}
				>
					<div
						className="h-full transition-all duration-200"
						style={{
							width: `${hpPercent}%`,
							backgroundColor:
								hpPercent > 60
									? '#22c55e'
									: hpPercent > 30
										? '#f59e0b'
										: '#ef4444',
						}}
					/>
				</div>
			)}

			{/* Label */}
			{showLabel && (
				<div className="text-xs text-foreground mt-1 whitespace-nowrap">
					{definition.name}
				</div>
			)}
		</div>
	);
}

// Compact enemy indicator for UI lists
export function EnemyIndicator({
	type,
	count,
}: {
	type: EnemyType;
	count: number;
}) {
	const definition = ENEMY_DEFINITIONS[type];

	return (
		<div className="flex items-center gap-2 p-2 bg-secondary rounded">
			<svg
				height={20}
				style={{ color: definition.color }}
				viewBox="0 0 24 24"
				width={20}
			>
				{getEnemySprite(type)}
			</svg>
			<div className="flex-1">
				<div className="text-xs font-medium text-foreground">
					{definition.name}
				</div>
				<div className="text-xs text-muted-foreground">{count} active</div>
			</div>
		</div>
	);
}
