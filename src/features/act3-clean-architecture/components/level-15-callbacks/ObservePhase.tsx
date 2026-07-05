import { ArrowRight } from 'lucide-react';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { Button } from '@/components/ui/Button';
import { CustomerDashboard } from './CustomerDashboard';
import type { DashboardDamage } from './data/probes';

interface ObservePhaseProps {
	probes: ProbeConfig[];
	damage: DashboardDamage | null;
	canStartBuild: boolean;
	onProbe: (probeId: string) => void;
	onStartBuild: () => void;
}

export function ObservePhase({
	probes,
	damage,
	canStartBuild,
	onProbe,
	onStartBuild,
}: ObservePhaseProps) {
	return (
		<div className="flex-1 flex flex-col overflow-hidden">
			{/* Customer Impact Dashboard: three customer-facing surfaces.
			    Each probe paints damage on the matching surface plus the
			    incident log below. */}
			<CustomerDashboard damage={damage} />

			{/* Probe terminal docked at the bottom. */}
			<div className="shrink-0 px-6 pb-4">
				<ProbeTerminal
					onProbe={onProbe}
					probes={probes}
					title="Customer Impact Probe"
				/>
			</div>

			{/* Build the Fix button (discovery gated) */}
			{canStartBuild && (
				<div className="shrink-0 px-4 pb-4 flex justify-center animate-in fade-in duration-500">
					<Button className="gap-2" onClick={onStartBuild} size="lg">
						Build the Fix
						<ArrowRight className="w-4 h-4" />
					</Button>
				</div>
			)}
		</div>
	);
}
