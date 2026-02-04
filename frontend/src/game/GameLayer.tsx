/**
 * Game Layer React Component
 *
 * Renders the Phaser game canvas as an overlay on top of the pipeline editor.
 * Syncs game state with the simulation store.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
	selectActiveDefenses,
	selectActiveEnemies,
	useSimulationStore,
} from "@/stores";
import { PhaserGameManager } from './PhaserGame';

interface GameLayerProps {
	className?: string;
	enabled?: boolean;
}

export function GameLayer({ className = '', enabled = true }: GameLayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const gameManagerRef = useRef<PhaserGameManager | null>(null);
	const lastSyncRef = useRef<number>(0);

	// Get state from store
	const enemies = useSimulationStore(selectActiveEnemies);
	const defenses = useSimulationStore(selectActiveDefenses);
	const status = useSimulationStore((state) => state.status);

	// Initialize Phaser game
	useEffect(() => {
		if (!enabled || !containerRef.current) return;

		// Create game manager
		const manager = new PhaserGameManager();
		const success = manager.init('phaser-game-layer');

		if (success) {
			gameManagerRef.current = manager;
		}

		return () => {
			manager.destroy();
			gameManagerRef.current = null;
		};
	}, [enabled]);

	// Sync enemies with game
	useEffect(() => {
		if (!gameManagerRef.current?.isReady()) return;

		// Throttle updates to 30fps
		const now = performance.now();
		if (now - lastSyncRef.current < 33) return;
		lastSyncRef.current = now;

		gameManagerRef.current.syncEnemies(enemies);
	}, [enemies]);

	// Sync defenses with game
	useEffect(() => {
		if (!gameManagerRef.current?.isReady()) return;
		gameManagerRef.current.syncDefenses(defenses);
	}, [defenses]);

	// Handle defense attacks (visual effects)
	const handleDefenseAttack = useCallback(
		(defenseId: string, enemyId: string, damage: number) => {
			if (!gameManagerRef.current?.isReady()) return;

			const defense = defenses.find((d) => d.id === defenseId);
			const enemy = enemies.find((e) => e.id === enemyId);

			if (defense && enemy) {
				gameManagerRef.current.fireProjectile(
					defense.position,
					enemy.position,
					0x22c55e,
				);
				gameManagerRef.current.showDamage(
					enemy.position.x,
					enemy.position.y,
					damage,
				);

				// Show kill effect if enemy died
				if (enemy.hp - damage <= 0) {
					setTimeout(() => {
						gameManagerRef.current?.showKill(
							enemy.position.x,
							enemy.position.y,
						);
					}, 200);
				}
			}
		},
		[defenses, enemies],
	);

	// Subscribe to defense attack events (would be triggered by simulation)
	useEffect(() => {
		// This would connect to simulation events
		// For now, we just have the callback ready
	}, [handleDefenseAttack]);

	if (!enabled) return null;

	return (
		<div
			className={`absolute inset-0 pointer-events-none ${className}`}
			id="phaser-game-layer"
			ref={containerRef}
			style={{ zIndex: 10 }}
		>
			{/* Game canvas will be inserted here by Phaser */}
		</div>
	);
}

/**
 * Hook for controlling the game layer from parent components
 */
export function useGameLayer() {
	const gameManager = useRef<PhaserGameManager | null>(null);

	const fireProjectile = useCallback(
		(
			from: { x: number; y: number },
			to: { x: number; y: number },
			color?: number,
		) => {
			gameManager.current?.fireProjectile(from, to, color);
		},
		[],
	);

	const showDamage = useCallback((x: number, y: number, damage: number) => {
		gameManager.current?.showDamage(x, y, damage);
	}, []);

	const showKill = useCallback((x: number, y: number) => {
		gameManager.current?.showKill(x, y);
	}, []);

	return {
		fireProjectile,
		showDamage,
		showKill,
		setGameManager: (manager: PhaserGameManager) => {
			gameManager.current = manager;
		},
	};
}

export default GameLayer;
