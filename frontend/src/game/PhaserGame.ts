/**
 * Phaser Game Layer
 *
 * Renders enemies, defenses, and visual effects overlaid on the pipeline canvas.
 * Uses Phaser 3 for smooth animations and particle effects.
 */

import Phaser from 'phaser';
import type {
	Defense,
	DefenseType,
	Enemy,
	EnemyType,
} from "@/stores/simulation";

// ============================================
// Configuration
// ============================================

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
	type: Phaser.AUTO,
	transparent: true,
	parent: 'game-layer',
	width: 800,
	height: 600,
	physics: {
		default: 'arcade',
		arcade: {
			debug: false,
			gravity: { x: 0, y: 0 },
		},
	},
	scene: [],
};

// Enemy visual configurations
const ENEMY_VISUALS: Record<
	EnemyType,
	{ color: number; scale: number; shape: 'circle' | 'triangle' | 'diamond' }
> = {
	query_swarm: { color: 0xef4444, scale: 0.6, shape: 'circle' },
	memory_blob: { color: 0x8b5cf6, scale: 1.2, shape: 'circle' },
	callback_chain: { color: 0xf59e0b, scale: 0.8, shape: 'diamond' },
	timeout_wraith: { color: 0x6b7280, scale: 1.0, shape: 'circle' },
	error_spike: { color: 0xdc2626, scale: 0.5, shape: 'triangle' },
	cache_phantom: { color: 0x06b6d4, scale: 0.9, shape: 'circle' },
};

// Defense visual configurations
const DEFENSE_VISUALS: Record<DefenseType, { color: number; range: number }> = {
	index_turret: { color: 0x22c55e, range: 150 },
	cache_shield: { color: 0x06b6d4, range: 200 },
	eager_loader: { color: 0xf59e0b, range: 100 },
	rate_limiter: { color: 0xa855f7, range: 300 },
	worker_drone: { color: 0x3b82f6, range: 250 },
	validator_wall: { color: 0xec4899, range: 100 },
};

// ============================================
// Main Game Scene
// ============================================

class GameScene extends Phaser.Scene {
	private enemySprites: Map<string, Phaser.GameObjects.Container> = new Map();
	private defenseSprites: Map<string, Phaser.GameObjects.Container> = new Map();
	private projectiles: Phaser.GameObjects.Group | null = null;
	private damageTexts: Phaser.GameObjects.Group | null = null;
	private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

	constructor() {
		super({ key: 'GameScene' });
	}

	preload() {
		// Create simple shapes as textures (no external assets needed)
		this.createTextures();
	}

	create() {
		// Initialize groups
		this.projectiles = this.add.group();
		this.damageTexts = this.add.group();

		// Create particle emitter for effects
		const particleTexture = this.createParticleTexture();
		this.particles = this.add.particles(0, 0, particleTexture, {
			lifespan: 500,
			speed: { min: 50, max: 150 },
			scale: { start: 0.5, end: 0 },
			alpha: { start: 1, end: 0 },
			emitting: false,
		});

		// Set up world bounds
		this.physics.world.setBounds(0, 0, 800, 600);
	}

	update() {
		// Update enemy sprites based on their positions
		this.updateEnemyMovement();
	}

	private createTextures() {
		// Create circle texture
		const circleGraphics = this.make.graphics({ x: 0, y: 0 });
		circleGraphics.fillStyle(0xffffff);
		circleGraphics.fillCircle(16, 16, 16);
		circleGraphics.generateTexture('circle', 32, 32);
		circleGraphics.destroy();

		// Create triangle texture
		const triangleGraphics = this.make.graphics({ x: 0, y: 0 });
		triangleGraphics.fillStyle(0xffffff);
		triangleGraphics.fillTriangle(16, 0, 32, 32, 0, 32);
		triangleGraphics.generateTexture('triangle', 32, 32);
		triangleGraphics.destroy();

		// Create diamond texture
		const diamondGraphics = this.make.graphics({ x: 0, y: 0 });
		diamondGraphics.fillStyle(0xffffff);
		diamondGraphics.fillPoints(
			[
				new Phaser.Geom.Point(16, 0),
				new Phaser.Geom.Point(32, 16),
				new Phaser.Geom.Point(16, 32),
				new Phaser.Geom.Point(0, 16),
			],
			true,
		);
		diamondGraphics.generateTexture('diamond', 32, 32);
		diamondGraphics.destroy();

		// Create defense base texture
		const defenseGraphics = this.make.graphics({ x: 0, y: 0 });
		defenseGraphics.fillStyle(0xffffff);
		defenseGraphics.fillRect(0, 0, 40, 40);
		defenseGraphics.generateTexture('defense', 40, 40);
		defenseGraphics.destroy();

		// Create projectile texture
		const projectileGraphics = this.make.graphics({ x: 0, y: 0 });
		projectileGraphics.fillStyle(0xffffff);
		projectileGraphics.fillCircle(4, 4, 4);
		projectileGraphics.generateTexture('projectile', 8, 8);
		projectileGraphics.destroy();
	}

	private createParticleTexture(): string {
		const graphics = this.make.graphics({ x: 0, y: 0 });
		graphics.fillStyle(0xffffff);
		graphics.fillCircle(4, 4, 4);
		graphics.generateTexture('particle', 8, 8);
		graphics.destroy();
		return 'particle';
	}

	private updateEnemyMovement() {
		// This would be called from external updates to sync positions
	}

	// ============================================
	// Public API
	// ============================================

	public syncEnemies(enemies: Enemy[]) {
		const activeIds = new Set(enemies.map((e) => e.id));

		// Remove sprites for enemies that no longer exist
		for (const [id, sprite] of this.enemySprites) {
			if (!activeIds.has(id)) {
				sprite.destroy();
				this.enemySprites.delete(id);
			}
		}

		// Add or update sprites
		for (const enemy of enemies) {
			if (!enemy.isActive) continue;

			let container = this.enemySprites.get(enemy.id);

			if (!container) {
				container = this.createEnemySprite(enemy);
				this.enemySprites.set(enemy.id, container);
			}

			// Update position
			container.setPosition(enemy.position.x, enemy.position.y);

			// Update health bar
			const healthBar = container.getByName(
				'healthBar',
			) as Phaser.GameObjects.Rectangle;
			if (healthBar) {
				const healthPercent = enemy.hp / enemy.maxHp;
				healthBar.setScale(healthPercent, 1);
			}
		}
	}

	public syncDefenses(defenses: Defense[]) {
		const activeIds = new Set(defenses.map((d) => d.id));

		// Remove sprites for defenses that no longer exist
		for (const [id, sprite] of this.defenseSprites) {
			if (!activeIds.has(id)) {
				sprite.destroy();
				this.defenseSprites.delete(id);
			}
		}

		// Add or update sprites
		for (const defense of defenses) {
			let container = this.defenseSprites.get(defense.id);

			if (!container) {
				container = this.createDefenseSprite(defense);
				this.defenseSprites.set(defense.id, container);
			}

			// Show firing animation when active
			const rangeCircle = container.getByName(
				'range',
			) as Phaser.GameObjects.Arc;
			if (rangeCircle) {
				rangeCircle.setAlpha(defense.isActive ? 0.3 : 0.1);
			}
		}
	}

	public fireProjectile(
		from: { x: number; y: number },
		to: { x: number; y: number },
		color: number,
	) {
		const projectile = this.add.sprite(from.x, from.y, 'projectile');
		projectile.setTint(color);

		this.tweens.add({
			targets: projectile,
			x: to.x,
			y: to.y,
			duration: 200,
			onComplete: () => {
				this.createHitEffect(to.x, to.y, color);
				projectile.destroy();
			},
		});
	}

	public createHitEffect(x: number, y: number, color: number) {
		if (this.particles) {
			this.particles.setParticleTint(color);
			this.particles.emitParticle(10, x, y);
		}
	}

	public showDamageText(x: number, y: number, damage: number) {
		const text = this.add.text(x, y, `-${damage}`, {
			fontSize: '14px',
			color: '#ff4444',
			fontStyle: 'bold',
		});

		this.tweens.add({
			targets: text,
			y: y - 30,
			alpha: 0,
			duration: 800,
			onComplete: () => text.destroy(),
		});
	}

	public showKillEffect(x: number, y: number) {
		// Explosion effect
		const explosion = this.add.circle(x, y, 10, 0xff4444);

		this.tweens.add({
			targets: explosion,
			scale: 3,
			alpha: 0,
			duration: 300,
			onComplete: () => explosion.destroy(),
		});

		// Particles
		if (this.particles) {
			this.particles.setParticleTint(0xff4444);
			this.particles.emitParticle(20, x, y);
		}
	}

	private createEnemySprite(enemy: Enemy): Phaser.GameObjects.Container {
		const visual = ENEMY_VISUALS[enemy.type];
		const container = this.add.container(enemy.position.x, enemy.position.y);

		// Main body
		const body = this.add.sprite(0, 0, visual.shape);
		body.setTint(visual.color);
		body.setScale(visual.scale);
		container.add(body);

		// Health bar background
		const healthBarBg = this.add.rectangle(0, -25, 30, 4, 0x333333);
		container.add(healthBarBg);

		// Health bar
		const healthBar = this.add.rectangle(-15, -25, 30, 4, 0x22c55e);
		healthBar.setOrigin(0, 0.5);
		healthBar.setName('healthBar');
		container.add(healthBar);

		// Add pulsing animation for certain enemy types
		if (enemy.type === 'memory_blob') {
			this.tweens.add({
				targets: body,
				scale: visual.scale * 1.2,
				duration: 1000,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		}

		// Add rotation for error_spike
		if (enemy.type === 'error_spike') {
			this.tweens.add({
				targets: body,
				rotation: Math.PI * 2,
				duration: 2000,
				repeat: -1,
				ease: 'Linear',
			});
		}

		// Add fade effect for timeout_wraith
		if (enemy.type === 'timeout_wraith') {
			this.tweens.add({
				targets: body,
				alpha: 0.3,
				duration: 1500,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		}

		return container;
	}

	private createDefenseSprite(defense: Defense): Phaser.GameObjects.Container {
		const visual = DEFENSE_VISUALS[defense.type];
		const container = this.add.container(
			defense.position.x,
			defense.position.y,
		);

		// Range indicator
		const rangeCircle = this.add.circle(0, 0, defense.range, visual.color, 0.1);
		rangeCircle.setName('range');
		rangeCircle.setStrokeStyle(1, visual.color, 0.3);
		container.add(rangeCircle);

		// Defense base
		const base = this.add.sprite(0, 0, 'defense');
		base.setTint(visual.color);
		base.setScale(0.8);
		container.add(base);

		// Add turret rotation animation
		this.tweens.add({
			targets: base,
			rotation: Math.PI * 2,
			duration: 5000,
			repeat: -1,
			ease: 'Linear',
		});

		return container;
	}

	public resize(width: number, height: number) {
		this.scale.resize(width, height);
		this.physics.world.setBounds(0, 0, width, height);
	}
}

// ============================================
// Game Manager
// ============================================

export class PhaserGameManager {
	private game: Phaser.Game | null = null;
	private scene: GameScene | null = null;
	private container: HTMLElement | null = null;

	constructor() {
		// Bind methods
		this.init = this.init.bind(this);
		this.destroy = this.destroy.bind(this);
		this.syncEnemies = this.syncEnemies.bind(this);
		this.syncDefenses = this.syncDefenses.bind(this);
	}

	init(containerId: string): boolean {
		this.container = document.getElementById(containerId);
		if (!this.container) {
			console.error(`Container #${containerId} not found`);
			return false;
		}

		const config: Phaser.Types.Core.GameConfig = {
			...GAME_CONFIG,
			parent: containerId,
			width: this.container.clientWidth,
			height: this.container.clientHeight,
			scene: GameScene,
		};

		this.game = new Phaser.Game(config);

		// Get scene reference once it's ready
		this.game.events.once('ready', () => {
			this.scene = this.game?.scene.getScene('GameScene') as GameScene;
		});

		// Handle resize
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				this.game?.scale.resize(width, height);
				this.scene?.resize(width, height);
			}
		});
		resizeObserver.observe(this.container);

		return true;
	}

	destroy() {
		if (this.game) {
			this.game.destroy(true);
			this.game = null;
			this.scene = null;
		}
	}

	syncEnemies(enemies: Enemy[]) {
		this.scene?.syncEnemies(enemies);
	}

	syncDefenses(defenses: Defense[]) {
		this.scene?.syncDefenses(defenses);
	}

	fireProjectile(
		from: { x: number; y: number },
		to: { x: number; y: number },
		color = 0x22c55e,
	) {
		this.scene?.fireProjectile(from, to, color);
	}

	showDamage(x: number, y: number, damage: number) {
		this.scene?.showDamageText(x, y, damage);
	}

	showKill(x: number, y: number) {
		this.scene?.showKillEffect(x, y);
	}

	isReady(): boolean {
		return this.scene !== null;
	}
}

// Export singleton instance
export const gameManager = new PhaserGameManager();
