/**
 * Level Header Component
 *
 * Top bar with level info, navigation, reset, and submit button.
 * Submit button is always visible for easy access.
 */

import { useState } from 'react';
import { Button } from '../../../ui/Button';
import type { ValidateFn, ValidationResult } from './SubmitButton';

interface LevelHeaderProps {
	levelNumber: number;
	levelName: string;
	actNumber?: number;
	onExit: () => void;
	onReset?: () => void;
	onValidate?: ValidateFn;
	onComplete?: () => void;
}

export function LevelHeader({
	levelNumber,
	levelName,
	actNumber = 1,
	onExit,
	onReset,
	onValidate,
	onComplete,
}: LevelHeaderProps) {
	const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
	const [isCompleting, setIsCompleting] = useState(false);
	const [showFeedback, setShowFeedback] = useState(false);

	const handleSubmit = async () => {
		if (!onValidate || !onComplete) return;

		const result = onValidate();
		setLastResult(result);
		setShowFeedback(true);

		if (result.valid) {
			setIsCompleting(true);
			await onComplete();
			setIsCompleting(false);
		} else {
			// Hide feedback after 5 seconds
			setTimeout(() => setShowFeedback(false), 5000);
		}
	};

	return (
		<div className="relative">
			<div className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50">
				<Button
					className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2"
					onClick={onExit}
					size="sm"
					variant="ghost"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M15 19l-7-7 7-7"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
					Levels
				</Button>

				<div className="text-center">
					<div className="text-xs text-primary font-medium tracking-wider">
						ACT {actNumber} - LEVEL {levelNumber}
					</div>
					<div className="text-lg font-bold text-foreground">{levelName}</div>
				</div>

				<div className="flex items-center gap-3">
					{onReset && (
						<Button
							className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2"
							onClick={onReset}
							size="sm"
							variant="ghost"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
								/>
							</svg>
							Reset
						</Button>
					)}

					{onValidate && onComplete && (
						<Button
							className={`px-5 font-semibold shadow-md ${
								isCompleting
									? 'bg-secondary text-muted-foreground cursor-not-allowed'
									: lastResult?.valid
										? 'bg-success hover:bg-success/90 text-foreground shadow-success/30'
										: 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/30'
							}`}
							disabled={isCompleting}
							onClick={handleSubmit}
							size="sm"
							variant={lastResult?.valid ? 'default' : 'default'}
						>
							{isCompleting
								? 'Completing...'
								: lastResult?.valid
									? 'Complete Level'
									: 'Submit'}
						</Button>
					)}

					{!onValidate && !onReset && <div className="w-16" />}
				</div>
			</div>

			{/* Feedback dropdown */}
			{showFeedback && lastResult && !lastResult.valid && (
				<div className="absolute top-14 right-6 z-50 w-80 animate-slideDown">
					<div className="bg-card border border-destructive/50 rounded-lg shadow-xl p-4 mt-2">
						<div className="text-destructive text-sm font-medium flex items-center gap-2">
							<svg
								className="w-4 h-4 shrink-0"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									clipRule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
									fillRule="evenodd"
								/>
							</svg>
							{lastResult.message}
						</div>
						{lastResult.details && lastResult.details.length > 0 && (
							<ul className="mt-2 text-destructive/80 text-xs space-y-1">
								{lastResult.details.map((detail, i) => (
									<li className="flex items-start gap-1" key={i}>
										<span className="text-destructive">•</span>
										{detail}
									</li>
								))}
							</ul>
						)}
						<Button
							className="absolute top-2 right-2 text-muted-foreground hover:text-foreground h-6 w-6"
							onClick={() => setShowFeedback(false)}
							size="icon"
							variant="ghost"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M6 18L18 6M6 6l12 12"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
								/>
							</svg>
						</Button>
					</div>
				</div>
			)}

			{/* Success feedback */}
			{showFeedback && lastResult?.valid && (
				<div className="absolute top-14 right-6 z-50 w-72 animate-slideDown">
					<div className="bg-card border border-success/50 rounded-lg shadow-xl p-4 mt-2">
						<div className="text-success text-sm font-medium flex items-center gap-2">
							<svg
								className="w-4 h-4 shrink-0"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									clipRule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									fillRule="evenodd"
								/>
							</svg>
							{lastResult.message}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default LevelHeader;
