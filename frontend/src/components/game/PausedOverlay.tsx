/**
 * Paused Overlay Component
 */

import { Button } from '../ui/Button';

interface PausedOverlayProps {
	onResume: () => void;
	onExit: () => void;
}

export function PausedOverlay({ onResume, onExit }: PausedOverlayProps) {
	return (
		<div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
			<div className="bg-card rounded-xl border border-border p-8 text-center shadow-2xl">
				<div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-background border border-border mb-4">
					<svg
						className="w-6 h-6 text-muted-foreground"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
				</div>
				<h2 className="text-xl font-semibold text-foreground mb-5">
					Game Paused
				</h2>
				<div className="flex gap-3">
					<Button
						className="bg-success text-success-foreground hover:bg-success/90"
						onClick={onResume}
					>
						Resume
					</Button>
					<Button onClick={onExit} variant="outline">
						Exit
					</Button>
				</div>
			</div>
		</div>
	);
}
