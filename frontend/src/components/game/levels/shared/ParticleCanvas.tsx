/**
 * Particle Canvas Component
 *
 * Renders animated particles with different visual types.
 * Supports: ghost, transient, persisted, dirty, clean, hacker, read, write, cache_hit, cache_miss
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type ParticleType =
	| 'request'
	| 'ghost'
	| 'transient'
	| 'persisted'
	| 'dirty'
	| 'clean'
	| 'hacker'
	| 'read'
	| 'write'
	| 'cache_hit'
	| 'cache_miss';

export interface Particle {
	id: string;
	type: ParticleType;
	x: number;
	y: number;
	targetX: number;
	targetY: number;
	progress: number;
	speed: number;
	opacity: number;
	state: 'moving' | 'poof' | 'done';
}

interface ParticleCanvasProps {
	particles: Particle[];
	onParticleComplete?: (particleId: string) => void;
	onParticlePoof?: (particleId: string, x: number, y: number) => void;
	className?: string;
}

// Particle type to visual config mapping
const PARTICLE_VISUALS: Record<
	ParticleType,
	{
		color: string;
		glowColor: string;
		size: number;
		shape: 'circle' | 'diamond' | 'jagged';
		pulse: boolean;
		trail: boolean;
	}
> = {
	request: {
		color: '#ffffff',
		glowColor: 'rgba(255, 255, 255, 0.3)',
		size: 8,
		shape: 'circle',
		pulse: false,
		trail: false,
	},
	ghost: {
		color: '#9ca3af',
		glowColor: 'rgba(156, 163, 175, 0.2)',
		size: 8,
		shape: 'circle',
		pulse: true,
		trail: false,
	},
	transient: {
		color: '#3b82f6',
		glowColor: 'rgba(59, 130, 246, 0.4)',
		size: 8,
		shape: 'circle',
		pulse: true,
		trail: true,
	},
	persisted: {
		color: '#22c55e',
		glowColor: 'rgba(34, 197, 94, 0.4)',
		size: 8,
		shape: 'circle',
		pulse: false,
		trail: true,
	},
	dirty: {
		color: '#f97316',
		glowColor: 'rgba(249, 115, 22, 0.4)',
		size: 10,
		shape: 'jagged',
		pulse: true,
		trail: false,
	},
	clean: {
		color: '#22c55e',
		glowColor: 'rgba(34, 197, 94, 0.4)',
		size: 8,
		shape: 'diamond',
		pulse: false,
		trail: true,
	},
	hacker: {
		color: '#ef4444',
		glowColor: 'rgba(239, 68, 68, 0.5)',
		size: 10,
		shape: 'diamond',
		pulse: true,
		trail: false,
	},
	read: {
		color: '#3b82f6',
		glowColor: 'rgba(59, 130, 246, 0.4)',
		size: 6,
		shape: 'circle',
		pulse: false,
		trail: true,
	},
	write: {
		color: '#f97316',
		glowColor: 'rgba(249, 115, 22, 0.4)',
		size: 6,
		shape: 'circle',
		pulse: false,
		trail: true,
	},
	cache_hit: {
		color: '#22c55e',
		glowColor: 'rgba(34, 197, 94, 0.5)',
		size: 8,
		shape: 'circle',
		pulse: false,
		trail: true,
	},
	cache_miss: {
		color: '#ef4444',
		glowColor: 'rgba(239, 68, 68, 0.4)',
		size: 8,
		shape: 'circle',
		pulse: true,
		trail: false,
	},
};

export function ParticleCanvas({
	particles,
	onParticleComplete,
	onParticlePoof,
	className = '',
}: ParticleCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animationRef = useRef<number>();
	const poofEffects = useRef<
		Map<string, { x: number; y: number; progress: number }>
	>(new Map());

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Draw particles
		for (const particle of particles) {
			if (particle.state === 'done') continue;

			const visual = PARTICLE_VISUALS[particle.type];
			const currentX =
				particle.x + (particle.targetX - particle.x) * particle.progress;
			const currentY =
				particle.y + (particle.targetY - particle.y) * particle.progress;

			// Draw trail if enabled
			if (visual.trail && particle.progress > 0.1) {
				const trailLength = 20;
				const trailStartX =
					particle.x +
					(particle.targetX - particle.x) *
						Math.max(0, particle.progress - 0.1);
				const trailStartY =
					particle.y +
					(particle.targetY - particle.y) *
						Math.max(0, particle.progress - 0.1);

				const gradient = ctx.createLinearGradient(
					trailStartX,
					trailStartY,
					currentX,
					currentY,
				);
				gradient.addColorStop(0, 'transparent');
				gradient.addColorStop(1, visual.color);

				ctx.beginPath();
				ctx.moveTo(trailStartX, trailStartY);
				ctx.lineTo(currentX, currentY);
				ctx.strokeStyle = gradient;
				ctx.lineWidth = visual.size / 2;
				ctx.stroke();
			}

			// Draw glow
			const glowSize = visual.size * 2;
			ctx.beginPath();
			ctx.arc(currentX, currentY, glowSize, 0, Math.PI * 2);
			ctx.fillStyle = visual.glowColor;
			ctx.fill();

			// Draw particle shape
			ctx.fillStyle = visual.color;
			ctx.globalAlpha = particle.opacity;

			if (visual.shape === 'circle') {
				ctx.beginPath();
				ctx.arc(currentX, currentY, visual.size / 2, 0, Math.PI * 2);
				ctx.fill();
			} else if (visual.shape === 'diamond') {
				ctx.beginPath();
				ctx.moveTo(currentX, currentY - visual.size / 2);
				ctx.lineTo(currentX + visual.size / 2, currentY);
				ctx.lineTo(currentX, currentY + visual.size / 2);
				ctx.lineTo(currentX - visual.size / 2, currentY);
				ctx.closePath();
				ctx.fill();
			} else if (visual.shape === 'jagged') {
				// Draw jagged/spiky particle
				ctx.beginPath();
				const spikes = 6;
				for (let i = 0; i < spikes * 2; i++) {
					const angle = (i * Math.PI) / spikes;
					const radius = i % 2 === 0 ? visual.size / 2 : visual.size / 4;
					const x = currentX + Math.cos(angle) * radius;
					const y = currentY + Math.sin(angle) * radius;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				ctx.fill();
			}

			// Pulsing effect
			if (visual.pulse) {
				const pulsePhase = (Date.now() / 300) % 1;
				const pulseSize =
					visual.size * (1 + 0.3 * Math.sin(pulsePhase * Math.PI * 2));
				ctx.globalAlpha = 0.3 * particle.opacity;
				ctx.beginPath();
				ctx.arc(currentX, currentY, pulseSize, 0, Math.PI * 2);
				ctx.fill();
			}

			ctx.globalAlpha = 1;
		}

		// Draw poof effects
		for (const [id, poof] of poofEffects.current) {
			const opacity = 1 - poof.progress;
			const size = 20 + poof.progress * 30;

			ctx.globalAlpha = opacity * 0.6;

			// Draw expanding circles
			for (let i = 0; i < 5; i++) {
				const angle = (i / 5) * Math.PI * 2 + poof.progress * 2;
				const distance = poof.progress * 25;
				const px = poof.x + Math.cos(angle) * distance;
				const py = poof.y + Math.sin(angle) * distance;

				ctx.fillStyle = '#ef4444';
				ctx.beginPath();
				ctx.arc(px, py, 4 * (1 - poof.progress), 0, Math.PI * 2);
				ctx.fill();
			}

			// Update poof progress
			poof.progress += 0.05;
			if (poof.progress >= 1) {
				poofEffects.current.delete(id);
			}
		}

		ctx.globalAlpha = 1;

		animationRef.current = requestAnimationFrame(draw);
	}, [particles]);

	// Handle poof effect
	const triggerPoof = useCallback(
		(id: string, x: number, y: number) => {
			poofEffects.current.set(id, { x, y, progress: 0 });
			onParticlePoof?.(id, x, y);
		},
		[onParticlePoof],
	);

	// Resize canvas to match container
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				canvas.width = entry.contentRect.width;
				canvas.height = entry.contentRect.height;
			}
		});

		resizeObserver.observe(canvas.parentElement!);
		return () => resizeObserver.disconnect();
	}, []);

	// Start animation loop
	useEffect(() => {
		animationRef.current = requestAnimationFrame(draw);
		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [draw]);

	return (
		<canvas
			className={`absolute inset-0 pointer-events-none ${className}`}
			ref={canvasRef}
		/>
	);
}

// Hook to manage particle state
export function useParticles() {
	const [particles, setParticles] = useState<Particle[]>([]);
	const idCounter = useRef(0);

	const spawnParticle = useCallback(
		(
			type: ParticleType,
			startX: number,
			startY: number,
			endX: number,
			endY: number,
			speed = 0.02,
		) => {
			const id = `particle-${idCounter.current++}`;
			const newParticle: Particle = {
				id,
				type,
				x: startX,
				y: startY,
				targetX: endX,
				targetY: endY,
				progress: 0,
				speed,
				opacity: 1,
				state: 'moving',
			};
			setParticles((prev) => [...prev, newParticle]);
			return id;
		},
		[],
	);

	const updateParticles = useCallback(() => {
		setParticles((prev) =>
			prev
				.map((p) => {
					if (p.state === 'done') return p;
					const newProgress = p.progress + p.speed;
					if (newProgress >= 1) {
						return { ...p, progress: 1, state: 'done' as const };
					}
					return { ...p, progress: newProgress };
				})
				.filter((p) => p.state !== 'done' || p.progress < 1.1),
		);
	}, []);

	const clearParticles = useCallback(() => {
		setParticles([]);
	}, []);

	const poofParticle = useCallback((id: string) => {
		setParticles((prev) =>
			prev.map((p) => (p.id === id ? { ...p, state: 'poof' as const } : p)),
		);
	}, []);

	return {
		particles,
		spawnParticle,
		updateParticles,
		clearParticles,
		poofParticle,
	};
}

export default ParticleCanvas;
