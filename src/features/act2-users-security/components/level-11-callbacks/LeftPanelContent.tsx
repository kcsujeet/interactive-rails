import { Check, X } from 'lucide-react';
import { StepProgress } from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import type {
	DiscoveryDef,
	UseDiscoveryGatingReturn,
} from '@/hooks/useDiscoveryGating';
import type { UseStepGatingReturn } from '@/hooks/useStepGating';
import type { Phase } from './types';

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Data processed correctly</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Side effect prevented (rollback)
					</span>
				</div>
			</div>
		</div>
	);
}

function ScenarioPanel() {
	return (
		<div className="p-4 border-b border-border space-y-3">
			<h3 className="text-sm font-semibold text-foreground mb-2">Scenario</h3>
			<p className="text-sm text-muted-foreground leading-relaxed">
				Your User model stores emails exactly as typed. Signups arrive as{' '}
				<span className="font-mono text-primary">
					&quot; JOE@GMAIL.COM &quot;
				</span>{' '}
				with extra whitespace and mixed case. Lookups by{' '}
				<span className="font-mono text-primary">joe@gmail.com</span> fail
				because the stored value does not match.
			</p>
			<p className="text-sm text-muted-foreground leading-relaxed">
				No welcome email fires on signup either. The model has no lifecycle
				hooks. Rails 8 introduces{' '}
				<span className="text-foreground font-medium">normalizes</span> for
				declarative data cleaning, and callbacks like{' '}
				<span className="text-foreground font-medium">after_create</span> for
				side effects.
			</p>
		</div>
	);
}

function StressTestCounters({
	allowedCount,
	blockedCount,
}: {
	allowedCount: number;
	blockedCount: number;
}) {
	return (
		<div className="p-4">
			<div className="grid grid-cols-2 gap-3">
				<div className="bg-success/20 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-success">{allowedCount}</div>
					<div className="text-xs text-success/70">Processed</div>
				</div>
				<div className="bg-destructive/20 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-destructive">
						{blockedCount}
					</div>
					<div className="text-xs text-destructive/70">Prevented</div>
				</div>
			</div>
		</div>
	);
}

interface LeftPanelContentProps {
	phase: Phase;
	discoveryGating: UseDiscoveryGatingReturn;
	stepper: UseStepGatingReturn;
	stressAllowedCount: number;
	stressBlockedCount: number;
}

export function LeftPanelContent({
	phase,
	discoveryGating,
	stepper,
	stressAllowedCount,
	stressBlockedCount,
}: LeftPanelContentProps) {
	return (
		<>
			<ScenarioPanel />

			{phase === 'observe' && (
				<div className="p-4 border-b border-border">
					<DiscoveryChecklist
						discoveredCount={discoveryGating.discoveredCount}
						discoveries={discoveryGating.discoveries}
						minRequired={discoveryGating.minRequired}
					/>
				</div>
			)}

			{phase === 'build' && (
				<div className="p-4 border-b border-border">
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
						Steps
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						onStepClick={stepper.goToStep}
						steps={stepper.steps}
					/>
				</div>
			)}

			{phase === 'reward' && (
				<>
					<PipelineLegend />
					<StressTestCounters
						allowedCount={stressAllowedCount}
						blockedCount={stressBlockedCount}
					/>
				</>
			)}
		</>
	);
}

// Allow downstream callers to pull this type in without referencing internal
// hook return types directly.
export type { DiscoveryDef };
