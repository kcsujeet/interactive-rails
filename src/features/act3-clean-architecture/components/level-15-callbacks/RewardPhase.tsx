import { useEffect, useState } from 'react';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Card } from '@/components/ui/Card';
import type { RequestResult, StressScenario } from '@/hooks/useStressTest';
import { CustomerDashboard } from './CustomerDashboard';

interface RewardPhaseProps {
	scenarios: StressScenario[];
	results: RequestResult[];
	allowedCount: number;
	blockedCount: number;
	canAutoFire: boolean;
	isAutoFiring: boolean;
	onFire: (scenarioId: string) => void;
	onToggleAutoFire: (onFire: (scenarioId: string) => void) => void;
}

interface RegressionToastProps {
	message: string;
}

function RegressionToast({ message }: RegressionToastProps) {
	return (
		<div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-2 duration-300">
			<Card className="px-4 py-3 border-success/50 bg-success/10 max-w-xl">
				<div className="text-sm text-success font-medium">{message}</div>
			</Card>
		</div>
	);
}

function toastFor(scenarioId: string | undefined): string | null {
	switch (scenarioId) {
		case 'buyer-search-misses':
			return 'normalizes :name cleaned the row AND the query. Buyer found the listing.';
		case 'duplicate-signup':
			return 'send_welcome_email(@user) fired from the controller. Customer got the email. No duplicate account.';
		case 'update-no-welcome':
			return 'Profile saved. Welcome email did NOT fire (it lives in #create, not #update).';
		default:
			return null;
	}
}

export function RewardPhase({
	scenarios,
	results,
	allowedCount,
	blockedCount,
	canAutoFire,
	isAutoFiring,
	onFire,
	onToggleAutoFire,
}: RewardPhaseProps) {
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const lastResult = results[results.length - 1];

	useEffect(() => {
		if (!lastResult) return;
		const message = toastFor(lastResult.scenarioId);
		if (!message) return;
		setToastMessage(message);
		const timeout = setTimeout(() => setToastMessage(null), 4000);
		return () => clearTimeout(timeout);
	}, [lastResult]);

	return (
		<div className="flex-1 flex flex-col overflow-hidden relative">
			{toastMessage && <RegressionToast message={toastMessage} />}

			{/* Same dashboard. With the fix, the customer-facing surfaces stay
			    clean across every scenario. The toast above narrates each catch. */}
			<CustomerDashboard damage={null} />

			{/* Stress test controls docked at the bottom. */}
			<div className="shrink-0 px-6 pb-4">
				<StressTestPanel
					allowedCount={allowedCount}
					blockedCount={blockedCount}
					canAutoFire={canAutoFire}
					isAutoFiring={isAutoFiring}
					onFire={onFire}
					onToggleAutoFire={onToggleAutoFire}
					results={results}
					scenarios={scenarios}
				/>
			</div>
		</div>
	);
}
