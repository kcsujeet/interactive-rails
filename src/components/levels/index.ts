/**
 * Shared Level Components Index
 */

export { CodePreviewPanel } from './CodePreviewPanel';
export { DraggableNode, NodePalette, NodePaletteGroup } from './DraggableNode';
export { ErrorFeedback } from './ErrorFeedback';
export { HelpDialog } from './HelpDialog';
export { InstructionPanel } from './InstructionPanel';
export { LearningGoalDialog } from './LearningGoalDialog';
export { LevelHeader } from './LevelHeader';
export type { OptionCardColor, OptionCardProps } from './OptionCard';
export { DotIcon, OptionCard, resolveColor } from './OptionCard';
export { CenterPanel, LeftPanel, LevelLayout, RightPanel } from './LevelLayout';
export { MetricsPanel } from './MetricsPanel';
export type { Particle, ParticleType } from './ParticleCanvas';
export { ParticleCanvas, useParticles } from './ParticleCanvas';
export type {
	TerminalCommand,
	TerminalHistoryEntry,
	TerminalOutputLine,
} from './SimulatedTerminal';
export { SimulatedTerminal } from './SimulatedTerminal';
export { StepProgress } from './StepProgress';
export type {
	TerminalChoiceStepProps,
	TerminalStep,
	TerminalStepData,
} from './TerminalChoiceStep';
export { buildTerminalHistory, TerminalChoiceStep } from './TerminalChoiceStep';
export type { ValidateFn, ValidationResult } from './SubmitButton';
export { SubmitButton } from './SubmitButton';
export {
	checkConstraint,
	getGameChoices,
	getLevelDecisions,
	useLevelCompletion,
} from './useLevelCompletion';
