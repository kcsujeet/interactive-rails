import { useMemo } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelHeader,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type ValidateFn,
} from '@/components/levels';
import { PipelineFlow } from '@/components/levels/PipelineFlow';
import { Button } from '@/components/ui/Button';
import type { UseStepGatingReturn } from '@/hooks/useStepGating';
import { shuffleOptions } from '@/lib/shuffleOptions';
import {
	DEPLOY_YML_OPTIONS,
	describeStep,
	SECRETS_OPTIONS,
	STEP_DEFS,
	TERMINAL_STEP_MAP,
} from './data/build-steps';
import { buildConnections, buildStagesFor } from './data/pipeline-stages';

interface CodeFile {
	filename: string;
	language: string;
	code: string;
}

interface BuildPhaseProps {
	stepper: UseStepGatingReturn;
	codeFiles: CodeFile[];
	wrongFeedback: string | null;
	setWrongFeedback: (msg: string | null) => void;
	onAdvance: () => void;
	onValidate: ValidateFn;
	onComplete: () => void;
}

interface OptionLike {
	id: string;
	label: string;
	code?: string;
	correct: boolean;
	feedback?: string;
}

export function BuildPhase({
	stepper,
	codeFiles,
	wrongFeedback,
	setWrongFeedback,
	onAdvance,
	onValidate,
	onComplete,
}: BuildPhaseProps) {
	const currentStepIndex = stepper.currentStep;
	const currentConfig = TERMINAL_STEP_MAP[currentStepIndex];
	const isTerminalStep = currentConfig !== null;

	const completedStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;
	const stages = useMemo(() => buildStagesFor(completedStep), [completedStep]);

	const handleOptionPick = (option: OptionLike) => {
		if (option.correct) {
			setWrongFeedback(null);
			stepper.completeStep();
		} else {
			setWrongFeedback(option.feedback ?? 'That is not the right choice.');
			stepper.recordWrongAttempt(option.feedback ?? '');
		}
	};

	const handleNext = () => {
		if (currentStepIndex === STEP_DEFS.length - 1) {
			onAdvance();
		} else {
			stepper.nextStep();
		}
	};

	return (
		<>
			<LeftPanel>
				<div className="p-4 border-b border-border">
					<h3 className="text-sm font-semibold text-foreground mb-2">
						Scenario
					</h3>
					<p className="text-sm text-muted-foreground leading-relaxed">
						Swap the shell playbook for a reproducible, health-gated deployment.
						Five steps: add the tool, scaffold config, fill in the deploy
						manifest, wire secrets, then run the first deploy.
					</p>
				</div>
				<div className="p-4">
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
						Steps
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						onStepClick={stepper.goToStep}
						steps={stepper.steps}
					/>
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Deployment"
					levelNumber={42}
					onComplete={onComplete}
					onReset={() => window.location.reload()}
					onValidate={onValidate}
				/>
				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto space-y-6">
						<div className="rounded-lg border border-border bg-card/50 p-4 min-h-52">
							<PipelineFlow
								activeConnections={[]}
								connections={buildConnections}
								stages={stages}
							/>
						</div>
					</div>
					<div className="max-w-2xl mx-auto space-y-6 mt-6">
						{isTerminalStep && currentConfig && (
							<TerminalChoiceStep
								commands={currentConfig.commands}
								completed={stepper.isCurrentStepCompleted}
								description={
									<p className="text-sm text-muted-foreground">
										{describeStep(currentStepIndex)}
									</p>
								}
								hasNext={currentStepIndex < STEP_DEFS.length - 1}
								initialHistory={buildTerminalHistory(
									TERMINAL_STEP_MAP,
									currentStepIndex,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={handleNext}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={currentConfig.outputLines}
								stepKey={currentStepIndex}
								title={STEP_DEFS[currentStepIndex].title}
							/>
						)}

						{!isTerminalStep && (
							<OptionStep
								currentStep={currentStepIndex}
								isCompleted={stepper.isCurrentStepCompleted}
								onNext={handleNext}
								onPick={handleOptionPick}
								wrongFeedback={wrongFeedback}
							/>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={codeFiles} />
			</RightPanel>
		</>
	);
}

interface OptionStepProps {
	currentStep: number;
	isCompleted: boolean;
	wrongFeedback: string | null;
	onPick: (option: OptionLike) => void;
	onNext: () => void;
}

function OptionStep({
	currentStep,
	isCompleted,
	wrongFeedback,
	onPick,
	onNext,
}: OptionStepProps) {
	const options =
		currentStep === 2
			? shuffleOptions(DEPLOY_YML_OPTIONS, 2)
			: shuffleOptions(SECRETS_OPTIONS, 3);

	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold text-foreground">
				{STEP_DEFS[currentStep].title}
			</h3>
			<p className="text-sm text-muted-foreground">
				{describeStep(currentStep)}
			</p>
			<div className="grid gap-3">
				{options.map((option) => (
					<OptionCard
						key={option.id}
						name={option.label}
						onClick={() => onPick(option)}
					>
						{option.code && (
							<pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">
								<code>{option.code}</code>
							</pre>
						)}
					</OptionCard>
				))}
			</div>
			{wrongFeedback && <ErrorFeedback message={wrongFeedback} />}
			{isCompleted && (
				<div className="flex justify-end">
					<Button onClick={onNext}>Next Step</Button>
				</div>
			)}
		</div>
	);
}
