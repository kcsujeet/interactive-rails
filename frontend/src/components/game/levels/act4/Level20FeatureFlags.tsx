/**
 * Level 20: Feature Flags
 *
 * Gradual rollout with traffic percentage control.
 * Shows A/B testing and kill switch patterns.
 */

import { useEffect, useState } from 'react';
import { Button } from '../../../ui/Button';
import type { LevelComponentProps } from '../index';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
} from '../shared';

interface Request {
	id: number;
	version: 'old' | 'new';
	status: 'success' | 'error';
}

export function Level20FeatureFlags({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [flagEnabled, setFlagEnabled] = useState(false);
	const [rolloutPercentage, setRolloutPercentage] = useState(10);
	const [requests, setRequests] = useState<Request[]>([]);
	const [oldErrors, setOldErrors] = useState(0);
	const [newErrors, setNewErrors] = useState(0);
	const [oldSuccesses, setOldSuccesses] = useState(0);
	const [newSuccesses, setNewSuccesses] = useState(0);

	const isComplete =
		flagEnabled && rolloutPercentage === 100 && newSuccesses >= 5;

	// Simulate traffic
	useEffect(() => {
		const interval = setInterval(() => {
			const id = Date.now();
			const goesToNew = flagEnabled && Math.random() * 100 < rolloutPercentage;
			const version = goesToNew ? 'new' : 'old';
			// Old version has 20% error rate, new has 5%
			const hasError =
				version === 'old' ? Math.random() < 0.2 : Math.random() < 0.05;
			const status = hasError ? 'error' : 'success';

			if (status === 'error') {
				if (version === 'old') setOldErrors((e) => e + 1);
				else setNewErrors((e) => e + 1);
			} else {
				if (version === 'old') setOldSuccesses((s) => s + 1);
				else setNewSuccesses((s) => s + 1);
			}

			setRequests((prev) => [...prev.slice(-20), { id, version, status }]);
		}, 300);

		return () => clearInterval(interval);
	}, [flagEnabled, rolloutPercentage]);

	const handleComplete = async () => {
		const success = await completeLevel('act4-level20-feature-flags', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const oldTotal = oldSuccesses + oldErrors;
	const newTotal = newSuccesses + newErrors;
	const oldErrorRate =
		oldTotal > 0 ? Math.round((oldErrors / oldTotal) * 100) : 0;
	const newErrorRate =
		newTotal > 0 ? Math.round((newErrors / newTotal) * 100) : 0;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn to use feature flags for gradual rollouts and safe deployments."
					instructions={[
						'Watch the error rate on the old version',
						'Enable feature flag with small rollout',
						'Gradually increase to 100% as errors stay low',
					]}
					scenario="We need to deploy a new checkout flow, but we're afraid it might have bugs. How do we test in production without affecting all users?"
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								flagEnabled
									? 'bg-success text-success-foreground cursor-default'
									: ''
							}`}
							disabled={flagEnabled}
							onClick={() => setFlagEnabled(true)}
						>
							{flagEnabled ? 'Feature Flag Enabled' : 'Enable Feature Flag'}
						</Button>
					</div>

					{flagEnabled && (
						<div className="p-4 border-t border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Rollout Percentage
							</div>
							<input
								className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
								max="100"
								min="0"
								onChange={(e) => setRolloutPercentage(Number(e.target.value))}
								step="10"
								type="range"
								value={rolloutPercentage}
							/>
							<div className="flex justify-between text-sm mt-2">
								<span className="text-muted-foreground">0%</span>
								<span className="text-primary font-bold">
									{rolloutPercentage}%
								</span>
								<span className="text-muted-foreground">100%</span>
							</div>
						</div>
					)}

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Error Rates
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Old Checkout:</span>
								<span
									className={`font-bold ${oldErrorRate > 10 ? 'text-destructive' : 'text-success'}`}
								>
									{oldErrorRate}% errors
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">New Checkout:</span>
								<span
									className={`font-bold ${newErrorRate > 10 ? 'text-destructive' : 'text-success'}`}
								>
									{newTotal > 0 ? `${newErrorRate}% errors` : 'No data'}
								</span>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Feature Flags"
					levelNumber={20}
					onExit={onExit}
					onReset={() => {
						setFlagEnabled(false);
						setRolloutPercentage(10);
						setRequests([]);
						setOldErrors(0);
						setNewErrors(0);
						setOldSuccesses(0);
						setNewSuccesses(0);
					}}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Traffic Split Visualization */}
					<div className="flex justify-center gap-8 mb-8">
						{/* Old Version */}
						<div
							className={`border rounded-xl p-4 w-48 text-center transition-colors ${
								!flagEnabled || rolloutPercentage < 100
									? 'bg-card border-border'
									: 'bg-secondary border-border opacity-50'
							}`}
						>
							<div className="text-muted-foreground font-medium">
								Old Checkout
							</div>
							<div className="text-3xl font-bold text-foreground mt-2">
								{flagEnabled ? 100 - rolloutPercentage : 100}%
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								of traffic
							</div>
							<div
								className={`mt-3 text-sm ${oldErrorRate > 10 ? 'text-destructive' : 'text-success'}`}
							>
								{oldErrorRate}% error rate
							</div>
						</div>

						{/* New Version */}
						<div
							className={`border rounded-xl p-4 w-48 text-center transition-colors ${
								flagEnabled
									? 'bg-primary/20 border-primary'
									: 'bg-secondary border-border opacity-50'
							}`}
						>
							<div className="text-primary font-medium">New Checkout</div>
							<div className="text-3xl font-bold text-primary mt-2">
								{flagEnabled ? rolloutPercentage : 0}%
							</div>
							<div className="text-xs text-primary/70 mt-1">of traffic</div>
							{flagEnabled && newTotal > 0 && (
								<div
									className={`mt-3 text-sm ${newErrorRate > 10 ? 'text-destructive' : 'text-success'}`}
								>
									{newErrorRate}% error rate
								</div>
							)}
						</div>
					</div>

					{/* Live Traffic */}
					<div className="bg-card rounded-xl p-4 max-w-2xl mx-auto">
						<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
							Live Traffic
						</div>
						<div className="flex flex-wrap gap-2 h-32 overflow-hidden">
							{requests.map((r) => (
								<div
									className={`w-4 h-4 rounded-sm ${
										r.version === 'old'
											? r.status === 'success'
												? 'bg-muted-foreground'
												: 'bg-destructive'
											: r.status === 'success'
												? 'bg-primary'
												: 'bg-destructive'
									}`}
									key={r.id}
									title={`${r.version} - ${r.status}`}
								/>
							))}
						</div>
						<div className="flex gap-4 mt-3 text-xs">
							<div className="flex items-center gap-1">
								<div className="w-3 h-3 bg-muted-foreground rounded-sm" />
								<span className="text-muted-foreground">Old OK</span>
							</div>
							<div className="flex items-center gap-1">
								<div className="w-3 h-3 bg-primary rounded-sm" />
								<span className="text-muted-foreground">New OK</span>
							</div>
							<div className="flex items-center gap-1">
								<div className="w-3 h-3 bg-destructive rounded-sm" />
								<span className="text-muted-foreground">Error</span>
							</div>
						</div>
					</div>

					{/* Completion button */}
					{isComplete && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
							<Button
								className="px-8 py-3 bg-gradient-to-r from-success to-success/80 text-success-foreground font-bold shadow-lg"
								onClick={handleComplete}
							>
								Complete Level
							</Button>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/controllers/checkouts_controller.rb',
							language: 'ruby',
							code: `class CheckoutsController < ApplicationController
  def create
    if Flipper.enabled?(:new_checkout, current_user)
      # New checkout flow
      NewCheckoutService.new(current_user, cart).call
    else
      # Old checkout flow
      LegacyCheckoutService.new(current_user, cart).call
    end
  end
end

# config/initializers/flipper.rb
Flipper.configure do |config|
  config.default do
    adapter = Flipper::Adapters::Redis.new(Redis.current)
    Flipper.new(adapter)
  end
end

# Gradual rollout
Flipper.enable_percentage_of_actors(:new_checkout, 10)

# Instant kill switch if something goes wrong
Flipper.disable(:new_checkout)`,
							highlight: [3, 5, 8, 21, 24],
						},
					]}
					learningGoal="Feature flags enable gradual rollouts and instant kill switches. Always have a way to quickly disable new features in production."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level20FeatureFlags;
