import { Check, X } from 'lucide-react';
import { StepProgress } from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import type { UseDiscoveryGatingReturn } from '@/hooks/useDiscoveryGating';
import type { UseStepGatingReturn } from '@/hooks/useStepGating';
import type { Phase } from './types';

function ScenarioPanel() {
	return (
		<div className="p-4 border-b border-border space-y-3">
			<h3 className="text-sm font-semibold text-foreground mb-2">Scenario</h3>
			<p className="text-sm text-muted-foreground leading-relaxed">
				A new payment processor is half-built. Marketing wants the launch next
				Tuesday at 9am sharp; engineering needs to ship the code now and turn it
				on then. And the third-party integration occasionally goes flaky and
				needs a kill switch faster than a Kamal redeploy can ship.
			</p>
			<p className="text-sm text-muted-foreground leading-relaxed">
				Right now deploy and release are coupled: every time you change what
				users see, you ship code. Decouple them with a runtime toggle so you can
				flip features on and off without redeploying.
			</p>
		</div>
	);
}

function FlagLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">
						Path active for this flag state
					</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">
						Path bypassed (kill switch / off)
					</span>
				</div>
			</div>
		</div>
	);
}

function StressCounters({
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
					<div className="text-xs text-success/70">Routed</div>
				</div>
				<div className="bg-destructive/20 rounded-lg p-3 text-center">
					<div className="text-2xl font-bold text-destructive">
						{blockedCount}
					</div>
					<div className="text-xs text-destructive/70">Killed</div>
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
					<FlagLegend />
					<StressCounters
						allowedCount={stressAllowedCount}
						blockedCount={stressBlockedCount}
					/>
				</>
			)}
		</>
	);
}
