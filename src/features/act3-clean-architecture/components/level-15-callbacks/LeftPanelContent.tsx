import { StepProgress } from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import type {
	DiscoveryDef,
	UseDiscoveryGatingReturn,
} from '@/hooks/useDiscoveryGating';
import type { UseStepGatingReturn } from '@/hooks/useStepGating';
import type { Phase } from './types';

function ScenarioPanel() {
	return (
		<div className="p-4 border-b border-border space-y-3">
			<h3 className="text-sm font-semibold text-foreground mb-2">Scenario</h3>
			<p className="text-sm text-muted-foreground leading-relaxed">
				Your Product model stores names exactly as the seller typed them.
				Listings come in as{' '}
				<span className="font-mono text-primary">
					&quot; Ceramic Mug &quot;
				</span>{' '}
				with extra whitespace, so when buyers search the storefront for{' '}
				<span className="font-mono text-primary">Ceramic Mug</span> the dirty
				stored row does not match. Sales walk out the door.
			</p>
			<p className="text-sm text-muted-foreground leading-relaxed">
				New users sign up but never receive a welcome email, so they assume the
				form was broken and create a duplicate account. And Product has no
				lifecycle field, so a seller has nowhere to mark a listing as no longer
				available. Three customer-facing failures, three different fixes.
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
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Customer impact
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="bg-success/20 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-success">{allowedCount}</div>
					<div className="text-xs text-success/70">
						Customers see clean data
					</div>
				</div>
				<div className="bg-destructive/20 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-destructive">
						{blockedCount}
					</div>
					<div className="text-xs text-destructive/70">
						Side effect prevented
					</div>
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
				<StressTestCounters
					allowedCount={stressAllowedCount}
					blockedCount={stressBlockedCount}
				/>
			)}
		</>
	);
}

// Allow downstream callers to pull this type in without referencing internal
// hook return types directly.
export type { DiscoveryDef };
