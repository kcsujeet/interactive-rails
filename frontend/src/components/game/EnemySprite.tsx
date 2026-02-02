// Enemy sprite rendering with animations

import { useMemo } from 'react';
import type { Enemy, EnemyType } from '../../stores/simulation';
import { ENEMY_DEFINITIONS } from '../../types/level';

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
          <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.8" />
          <circle cx="8" cy="8" r="4" fill="currentColor" />
          <circle cx="16" cy="8" r="4" fill="currentColor" />
          <circle cx="12" cy="16" r="4" fill="currentColor" />
          <text x="12" y="14" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
            N+1
          </text>
        </g>
      );

    case 'memory_blob':
      // Amorphous blob shape
      return (
        <g>
          <ellipse cx="12" cy="14" rx="10" ry="8" fill="currentColor" opacity="0.6">
            <animate
              attributeName="rx"
              values="10;12;10"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="ry"
              values="8;10;8"
              dur="2s"
              repeatCount="indefinite"
            />
          </ellipse>
          <ellipse cx="14" cy="10" rx="6" ry="5" fill="currentColor" opacity="0.8" />
          <ellipse cx="8" cy="12" rx="4" ry="3" fill="currentColor" />
        </g>
      );

    case 'callback_chain':
      // Chain links
      return (
        <g>
          <circle cx="6" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="10" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="2" />
          <line x1="16" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="2" />
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
              values="0.7;0.4;0.7"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>
          <circle cx="9" cy="10" r="2" fill="white" />
          <circle cx="15" cy="10" r="2" fill="white" />
        </g>
      );

    case 'error_spike':
      // Spiky shape
      return (
        <g>
          <polygon
            points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10"
            fill="currentColor"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="4s"
              repeatCount="indefinite"
            />
          </polygon>
          <text x="12" y="14" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">
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
            r="10"
            fill="currentColor"
            opacity="0.3"
            strokeDasharray="2 2"
            stroke="currentColor"
            strokeWidth="1"
          >
            <animate
              attributeName="opacity"
              values="0.3;0.1;0.3"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
          <text x="12" y="14" textAnchor="middle" fill="currentColor" fontSize="8">
            MISS
          </text>
        </g>
      );

    default:
      // Generic enemy
      return (
        <circle cx="12" cy="12" r="10" fill="currentColor" />
      );
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
      style={{
        transform: `translate(${enemy.position.x}px, ${enemy.position.y}px)`,
      }}
      onClick={onClick}
    >
      {/* Enemy sprite */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={`${animationClass} ${onClick ? 'cursor-pointer' : ''}`}
        style={{ color: definition.color }}
      >
        {getEnemySprite(enemy.type)}
      </svg>

      {/* Health bar */}
      {showHealthBar && (
        <div
          className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-1"
          style={{ width: size }}
        >
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${hpPercent}%`,
              backgroundColor:
                hpPercent > 60 ? '#22c55e' : hpPercent > 30 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      )}

      {/* Label */}
      {showLabel && (
        <div className="text-xs text-white mt-1 whitespace-nowrap">
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
    <div className="flex items-center gap-2 p-2 bg-gray-700 rounded">
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        style={{ color: definition.color }}
      >
        {getEnemySprite(type)}
      </svg>
      <div className="flex-1">
        <div className="text-xs font-medium text-white">{definition.name}</div>
        <div className="text-xs text-gray-400">{count} active</div>
      </div>
    </div>
  );
}
