import { ArrowRight } from 'lucide-react';
import {
	buildTerminalHistory,
	ErrorFeedback,
	OptionCard,
	TerminalChoiceStep,
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import {
	INSTALL_FLIPPER_COMMANDS,
	INSTALL_FLIPPER_OUTPUT,
	OPTION_STEP_CONFIG,
	RUN_INSTALLER_COMMANDS,
	RUN_INSTALLER_OUTPUT,
	STEP_DEFS,
	STEP_TYPES,
} from './data/build-steps';
import type { StepOption } from './types';

const TERMINAL_STEPS_FOR_HISTORY: (TerminalStepData | null)[] = [
	{ commands: INSTALL_FLIPPER_COMMANDS, outputLines: INSTALL_FLIPPER_OUTPUT },
	{ commands: RUN_INSTALLER_COMMANDS, outputLines: RUN_INSTALLER_OUTPUT },
	null, // step 2: option
	null, // step 3: option
	null, // step 4: option
];

interface BuildPhaseProps {
	currentStep: number;
	isViewingCompletedStep: boolean;
	hasNextStep: boolean;
	lastFeedback: string | null;
	shuffledOptions: StepOption[];
	onCorrectTerminal: () => void;
	onWrongTerminal: (feedback: string) => void;
	onOptionClick: (option: StepOption) => void;
	onClearFeedback: () => void;
	onNextStep: () => void;
	onTransitionToReward: () => void;
}

const TERMINAL_TITLES: Record<number, string> = {
	0: 'Install Flipper',
	1: 'Run the Installer',
};

const TERMINAL_DESCRIPTIONS: Record<number, string> = {
	0: 'Add the Flipper gem to the Gemfile so the runtime toggle library is available in development, test, and production. Pick the command that adds it as a project dependency, not just to the local machine, and that includes the admin UI sub-gem.',
	1: 'The gem ships a generator that creates a migration for the Flipper-specific tables (`flipper_features`, `flipper_gates`). Generate the migration AND run it so the schema is in place.',
};

const TERMINAL_COMMANDS_BY_STEP: Record<number, TerminalCommand[]> = {
	0: INSTALL_FLIPPER_COMMANDS,
	1: RUN_INSTALLER_COMMANDS,
};

const TERMINAL_OUTPUT_BY_STEP: Record<number, TerminalOutputLine[]> = {
	0: INSTALL_FLIPPER_OUTPUT,
	1: RUN_INSTALLER_OUTPUT,
};

export function BuildPhase({
	currentStep,
	isViewingCompletedStep,
	hasNextStep,
	lastFeedback,
	shuffledOptions,
	onCorrectTerminal,
	onWrongTerminal,
	onOptionClick,
	onClearFeedback,
	onNextStep,
	onTransitionToReward,
}: BuildPhaseProps) {
	const stepType = STEP_TYPES[currentStep];

	if (stepType === 'terminal') {
		return (
			<div className="flex-1 overflow-auto p-6">
				<div className="max-w-2xl mx-auto">
					<TerminalChoiceStep
						commands={TERMINAL_COMMANDS_BY_STEP[currentStep]}
						completed={isViewingCompletedStep}
						description={
							<p className="text-sm text-muted-foreground">
								{TERMINAL_DESCRIPTIONS[currentStep]}
							</p>
						}
						hasNext={hasNextStep}
						initialHistory={buildTerminalHistory(
							TERMINAL_STEPS_FOR_HISTORY,
							currentStep,
						)}
						onCorrect={onCorrectTerminal}
						onNext={
							currentStep === STEP_DEFS.length - 1
								? onTransitionToReward
								: onNextStep
						}
						onWrong={onWrongTerminal}
						outputLines={TERMINAL_OUTPUT_BY_STEP[currentStep]}
						stepKey={currentStep}
						terminalTitle="Terminal"
						title={TERMINAL_TITLES[currentStep]}
					/>
				</div>
			</div>
		);
	}

	const currentOptionConfig = OPTION_STEP_CONFIG[currentStep];
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
