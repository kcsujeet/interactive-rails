/**
 * Completion Screen Component
 * Post-game screen showing results
 */

import { ArrowRight } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface CompletionScreenProps {
	levelName: string;
	stars: number;
	onExit: () => void;
	learningContent?: {
		title: string;
		conceptExplanation: string;
		railsCodeExample: string;
		commonMistakes: string[];
	};
	nextLevelId?: string;
	nextLevelActId?: number;
	isCapstone?: boolean;
}

/** @deprecated Use levelName prop instead */
interface LegacyCompletionScreenProps {
	dungeonName: string;
	stars: number;
	onExit: () => void;
}

export function CompletionScreen(
	props: CompletionScreenProps | LegacyCompletionScreenProps,
) {
	// Support both 'levelName' and legacy 'dungeonName' prop names
	const levelName = 'levelName' in props ? props.levelName : props.dungeonName;
	const { stars, onExit } = props;
	const learningContent =
		'learningContent' in props ? props.learningContent : undefined;
	const nextLevelId = 'nextLevelId' in props ? props.nextLevelId : undefined;
	const nextLevelActId = 'nextLevelActId' in props ? props.nextLevelActId : undefined;
	const isCapstone = 'isCapstone' in props ? props.isCapstone : false;

	return (
		<div className="h-full overflow-auto flex items-center justify-center p-6">
			<div className="w-full max-w-2xl">
				{/* Breadcrumb */}
				<Button
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground mb-8 px-0"
					onClick={onExit}
					size="sm"
					variant="ghost"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						viewBox="0 0 24 24"
					>
						<path
							d="M15 19l-7-7 7-7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<span>Acts</span>
				</Button>

				{/* Success Header */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success/15 mb-4 animate-in zoom-in-95 fade-in duration-300">
						<svg
							className="w-7 h-7 text-success"
							fill="none"
							stroke="currentColor"
							strokeWidth={2.5}
							viewBox="0 0 24 24"
						>
							<path
								d="M5 13l4 4L19 7"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<h1 className="text-2xl font-semibold text-foreground mb-1">
						{isCapstone ? 'Capstone Complete!' : 'Level Complete!'}
					</h1>
					<p className="text-muted-foreground">{levelName}</p>

					{/* Stars */}
					<div className="relative flex justify-center gap-1 mt-5">
						{stars === 3 && (
							<div className="absolute -inset-4 bg-[radial-gradient(ellipse,oklch(0.75_0.15_70/0.15)_0%,transparent_70%)] animate-in fade-in duration-500" aria-hidden="true"></div>
						)}
						{[1, 2, 3].map((i) => (
							<svg
								aria-label={i <= stars ? 'Earned star' : 'Empty star'}
								className={`relative w-7 h-7 animate-in zoom-in-95 fade-in duration-300 fill-mode-both ${i === 1 ? 'delay-[450ms]' : i === 2 ? 'delay-[600ms]' : 'delay-[750ms]'} ${i <= stars ? 'text-warning' : 'text-muted'}`}
								fill="currentColor"
								key={`star-${i}`}
								viewBox="0 0 20 20"
							>
								<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
							</svg>
						))}
					</div>
				</div>

				{/* Learning Content */}
				{learningContent && (
					<div className="space-y-4">
						<div>
							<div className="flex items-center gap-2 mb-3">
								<Badge variant="default">Concept</Badge>
								<span className="text-sm font-medium text-foreground">
									{learningContent.title}
								</span>
							</div>
							<p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
								{learningContent.conceptExplanation}
							</p>
						</div>

						<div className="bg-card rounded-xl overflow-hidden border border-success/20 shadow-[0_0_20px_oklch(0.65_0.17_160/0.08)]">
							<div className="px-4 py-2 border-b border-border flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-success" />
								<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
									Rails Example
								</span>
							</div>
							<pre className="p-4 text-sm text-success font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
								{learningContent.railsCodeExample}
							</pre>
						</div>

						<div>
							<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
								Common Mistakes
							</span>
							<ul className="mt-2 text-sm text-muted-foreground space-y-1.5">
								{learningContent.commonMistakes.map((mistake) => (
									<li className="flex items-start gap-2" key={mistake}>
										<span className="text-destructive">×</span>
										<span>{mistake}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				)}

				{/* Actions */}
				{nextLevelId && (
					<div className="mt-8">
						<Button
							className="w-full group"
							onClick={() => {
								window.location.href = `/acts/${nextLevelActId}/${nextLevelId}`;
							}}
						>
							Next Level
							<ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
