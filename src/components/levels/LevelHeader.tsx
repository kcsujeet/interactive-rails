/**
 * Level Header Component
 *
 * Top bar with level info, navigation, reset, and submit button.
 * Looks up level data directly from the registry for Help and Learning Goal dialogs.
 */

import {
	AlertCircle,
	CheckCircle,
	ChevronLeft,
	Code2,
	RefreshCw,
	X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CodebaseViewerDialog } from '@/features/codebase-viewer/components/CodebaseViewerDialog';
import { getLevelByNumber } from '@/lib/acts-registry';
import type { CodeFile } from '@/utils/codeGeneration';
import { HelpDialog } from './HelpDialog';
import { LearningGoalDialog } from './LearningGoalDialog';
import type { ValidateFn, ValidationResult } from './SubmitButton';

interface LevelHeaderProps {
	levelNumber: number;
	levelName: string;
	actNumber?: number;
	subtitle?: string;
	onReset?: () => void;
	onValidate: ValidateFn;
	onComplete: () => void;
	/** Current code files for the codebase viewer (from the level's getCodeFiles) */
	currentCodeFiles?: CodeFile[];
}

export function LevelHeader({
	levelNumber,
	levelName,
	actNumber = 1,
	subtitle,
	onReset,
	onValidate,
	onComplete,
	currentCodeFiles,
}: LevelHeaderProps) {
	const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
	const [isCompleting, setIsCompleting] = useState(false);
	const [showFeedback, setShowFeedback] = useState(false);

	// Look up level data directly from the registry
	const level = getLevelByNumber(actNumber, levelNumber);
	const scenario = level?.problem?.observation;
	const learningGoal = level?.learningContent?.goal;

	const handleSubmit = async () => {
		// Second click after a successful validation: actually complete the level.
		if (lastResult?.valid) {
			setIsCompleting(true);
			await onComplete();
			setIsCompleting(false);
			return;
		}

		// First click (or retry after a failed validation): just validate.
		const result = onValidate();
		setLastResult(result);
		setShowFeedback(true);

		if (!result.valid) {
			setTimeout(() => setShowFeedback(false), 5000);
		}
	};

	return (
		<div className="relative">
			<div className="min-h-14 py-2 border-b border-border grid grid-cols-[1fr_auto_1fr] items-center px-6 bg-card/50">
				<div className="justify-self-start">
					<Button
						className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2 px-0"
						size="sm"
						variant="link"
					>
						<a className="flex items-center" href="/acts">
							<ChevronLeft className="w-4 h-4" />
							Levels
						</a>
					</Button>
				</div>

				<div className="text-center">
					<div className="text-xs text-primary font-medium tracking-wider">
						ACT {actNumber} · LEVEL {levelNumber}
					</div>
					<div className="text-lg font-bold text-foreground leading-tight">
						{levelName}
					</div>
					{subtitle && (
						<div className="text-xs text-muted-foreground">{subtitle}</div>
					)}
				</div>

				<div className="justify-self-end flex items-center gap-1">
					{currentCodeFiles && currentCodeFiles.length > 0 && (
						<CodebaseViewerDialog
							files={currentCodeFiles}
							trigger={
								<Button
									className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2"
									size="sm"
									variant="ghost"
								>
									<Code2 className="w-4 h-4" />
									Codebase
								</Button>
							}
						/>
					)}
					<LearningGoalDialog learningGoal={learningGoal} />
					<HelpDialog scenario={scenario} />

					{onReset && (
						<Button
							className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2"
							onClick={onReset}
							size="sm"
							variant="ghost"
						>
							<RefreshCw className="w-4 h-4" />
							Reset
						</Button>
					)}

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
				</div>
			</div>

			{/* Feedback dropdown */}
			{showFeedback && lastResult && !lastResult.valid && (
				<div className="absolute top-full right-6 z-50 w-80 animate-slideDown">
					<div className="bg-card border border-destructive/50 rounded-lg shadow-xl p-4 mt-2">
						<div className="text-destructive text-sm font-medium flex items-center gap-2">
							<AlertCircle className="w-4 h-4 shrink-0" />
							{lastResult.message}
						</div>
						{lastResult.details && lastResult.details.length > 0 && (
							<ul className="mt-2 text-destructive/80 text-xs space-y-1">
								{lastResult.details.map((detail) => (
									<li className="flex items-start gap-1" key={detail}>
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
							<X className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}

			{/* Success feedback */}
			{showFeedback && lastResult?.valid && (
				<div className="absolute top-full right-6 z-50 w-72 animate-slideDown">
					<div className="bg-card border border-success/50 rounded-lg shadow-xl p-4 mt-2">
						<div className="text-success text-sm font-medium flex items-center gap-2">
							<CheckCircle className="w-4 h-4 shrink-0" />
							{lastResult.message}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default LevelHeader;
