import { ArrowRight } from 'lucide-react';
import { ErrorFeedback, OptionCard } from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { StepOption } from './types';

interface OptionConfig {
	title: string;
	description: string;
	options: StepOption[];
}

interface BuildPhaseProps {
	currentOptionConfig: OptionConfig | undefined;
	shuffledOptions: StepOption[];
	isViewingCompletedStep: boolean;
	hasNextStep: boolean;
	lastFeedback: string | null;
	onOptionClick: (option: StepOption) => void;
	onClearFeedback: () => void;
	onNextStep: () => void;
	onTransitionToReward: () => void;
}

export function BuildPhase({
	currentOptionConfig,
	shuffledOptions,
	isViewingCompletedStep,
	hasNextStep,
	lastFeedback,
	onOptionClick,
	onClearFeedback,
	onNextStep,
	onTransitionToReward,
}: BuildPhaseProps) {
	if (!currentOptionConfig) return null;

	return (
		<div className="flex-1 overflow-auto p-6">
			<div className="max-w-2xl mx-auto space-y-4">
				<h3 className="text-lg font-semibold text-foreground">
					{currentOptionConfig.title}
				</h3>
				<p className="text-sm text-muted-foreground">
					{currentOptionConfig.description}
				</p>

				{isViewingCompletedStep ? (
					<div className="space-y-2">
						{shuffledOptions.map((opt) => (
							<OptionCard
								color="violet"
								disabled={!opt.correct}
								key={opt.id}
								mono
								name={opt.label}
								selected={opt.correct}
								size="lg"
							/>
						))}
					</div>
				) : (
					<>
						<div className="space-y-2">
							{shuffledOptions.map((opt) => (
								<OptionCard
									color="violet"
									key={opt.id}
									mono
									name={opt.label}
									onClick={() => onOptionClick(opt)}
									size="lg"
								/>
							))}
						</div>

						<ErrorFeedback message={lastFeedback} onDismiss={onClearFeedback} />
					</>
				)}

				{isViewingCompletedStep && hasNextStep && (
					<div className="flex justify-end">
						<Button className="gap-2" onClick={onNextStep} size="sm">
							Next Step
							<ArrowRight className="w-4 h-4" />
						</Button>
					</div>
				)}
				{isViewingCompletedStep && !hasNextStep && (
					<div className="flex justify-end">
						<Button className="gap-2" onClick={onTransitionToReward} size="sm">
							Next Step
							<ArrowRight className="w-4 h-4" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
