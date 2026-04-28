/**
 * Level 49: Feature Flags & Staged Rollouts
 *
 * Batch A scaffolding: minimal stub that compiles and is wired into Act 6.
 * Real observe / build / reward content lands in Batch B with the per-level
 * structure split (data files, phase components, tests).
 *
 * Decouples deploy from release. A code change ships off, gets flipped on at
 * release time, can ramp from 5% to 100%, and stays behind a kill switch
 * during incidents.
 */

import { ArrowRight } from 'lucide-react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';

const PLACEHOLDER_CODE = `# app/controllers/payments_controller.rb
class PaymentsController < ApplicationController
  def create
    if Flipper.enabled?(:new_payment_processor, current_user)
      NewPaymentProcessor.charge(...)
    else
      LegacyPaymentProcessor.charge(...)
    end
  end
end

# Real implementation lands in the next batch.`;

registerLevelCode('act6-level49-feature-flags', () => [
	{
		filename: 'app/controllers/payments_controller.rb',
		language: 'ruby',
		code: PLACEHOLDER_CODE,
	},
]);

export function Level49FeatureFlags({ onComplete }: LevelComponentProps) {
	const validateSolution = (): ValidationResult => ({
		valid: true,
		message: 'Feature flags configured.',
	});

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							A new payment processor is half-built. Marketing wants the launch
							next Tuesday at 9am sharp; engineering needs to ship the code now
							and turn it on then. And a third-party integration occasionally
							goes flaky and needs a kill switch faster than a redeploy.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Decouple deploy from release: ship code in the off state, flip a
							runtime toggle when ready, ramp from 5% to 100%, and keep a kill
							switch you can hit in seconds during an incident.
						</p>
					</div>
					<div className="p-4 border-b border-border">
						<p className="text-xs text-muted-foreground italic">
							This level is currently a Batch A scaffold. The interactive
							observe / build / reward phases land in the next batch.
						</p>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Feature Flags & Staged Rollouts"
					levelNumber={49}
					onComplete={() => onComplete({ stars: 3 })}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>
				<div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 bg-background">
					<div className="max-w-xl text-center space-y-3">
						<h2 className="text-2xl font-bold text-foreground">
							Feature Flags & Staged Rollouts
						</h2>
						<p className="text-sm text-muted-foreground">
							Decouples deploy time from release time. Ship the code now, flip
							the switch later, ramp gradually, kill instantly.
						</p>
						<p className="text-xs text-muted-foreground italic">
							Full gameplay implementation comes in the next batch.
						</p>
					</div>
					<Button
						className="gap-2"
						onClick={() => onComplete({ stars: 3 })}
						size="lg"
					>
						Mark Complete (Scaffold)
						<ArrowRight className="w-4 h-4" />
					</Button>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/controllers/payments_controller.rb',
							language: 'ruby',
							code: PLACEHOLDER_CODE,
						},
					]}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level49FeatureFlags;
