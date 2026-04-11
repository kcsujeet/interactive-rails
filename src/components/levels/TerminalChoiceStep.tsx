/**
 * TerminalChoiceStep Component
 *
 * Renders a single terminal-choice step: title, description, SimulatedTerminal
 * with accumulated history, and Next Step button.
 *
 * Use this inside any level that has "pick the right command" steps.
 * The level owns its own layout; this component only renders the center panel content.
 */

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
	SimulatedTerminal,
	type TerminalCommand,
	type TerminalHistoryEntry,
	type TerminalOutputLine,
} from './SimulatedTerminal';
import { Button } from '@/components/ui/Button';

/**
 * Step definition type for levels where every step is a terminal choice.
 * Levels with mixed interaction types (OptionCard, drag-drop) only use
 * TerminalStepData for the terminal steps.
 */
export interface TerminalStep {
	id: string;
	title: string;
	description: ReactNode;
	commands: TerminalCommand[];
	outputLines: TerminalOutputLine[];
}

/**
 * Minimal data needed per step for building terminal history.
 * Use null for non-terminal steps in mixed-interaction levels.
 */
export interface TerminalStepData {
	commands: TerminalCommand[];
	outputLines: TerminalOutputLine[];
}

export interface TerminalChoiceStepProps {
	title: string;
	description: ReactNode;
	commands: TerminalCommand[];
	outputLines: TerminalOutputLine[];
	/** History from prior completed steps */
	initialHistory: TerminalHistoryEntry[];
	/** Whether this step has already been completed */
	completed: boolean;
	/** Whether there's a next step to advance to */
	hasNext: boolean;
	onCorrect: () => void;
	onWrong: (feedback: string) => void;
	onNext: () => void;
	/** Terminal prompt (default: '$') */
	prompt?: string;
	/** Terminal header title (default: 'Terminal') */
	terminalTitle?: string;
	/** Unique key for resetting SimulatedTerminal state between steps */
	stepKey: number;
}

/**
 * Build terminal history from completed steps.
 * Pass null for non-terminal steps (OptionCard, drag-drop, etc.).
 */
export function buildTerminalHistory(
	steps: (TerminalStepData | null)[],
	currentStep: number,
): TerminalHistoryEntry[] {
	const history: TerminalHistoryEntry[] = [];
	for (let i = 0; i < currentStep && i < steps.length; i++) {
		const step = steps[i];
		if (!step) continue;
		const correctCmd = step.commands.find((c) => c.correct);
		if (correctCmd) {
			history.push({
				command: correctCmd.command,
				output: step.outputLines,
				isError: false,
			});
		}
	}
	return history;
}

export function TerminalChoiceStep({
	title,
	description,
	commands,
	outputLines,
	initialHistory,
	completed,
	hasNext,
	onCorrect,
	onWrong,
	onNext,
	prompt,
	terminalTitle,
	stepKey,
}: TerminalChoiceStepProps) {
	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold text-foreground">{title}</h3>
			{typeof description === 'string' ? (
				<p className="text-sm text-muted-foreground">{description}</p>
			) : (
				description
			)}
			<SimulatedTerminal
				key={stepKey}
				commands={commands}
				completed={completed}
				initialHistory={initialHistory}
				onCorrect={onCorrect}
				onWrong={onWrong}
				outputLines={outputLines}
				prompt={prompt}
				title={terminalTitle}
			/>

			{completed && hasNext && (
				<div className="flex justify-end">
					<Button className="gap-2" onClick={onNext} size="sm">
						Next Step
						<ArrowRight className="w-4 h-4" />
					</Button>
				</div>
			)}
		</div>
	);
}

export default TerminalChoiceStep;
