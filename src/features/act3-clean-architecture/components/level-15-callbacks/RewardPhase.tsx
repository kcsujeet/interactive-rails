import { FlowConnector } from '@/components/levels/FlowConnector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import type { RequestResult, StressScenario } from '@/hooks/useStressTest';

interface RewardPhaseProps {
	scenarios: StressScenario[];
	results: RequestResult[];
	allowedCount: number;
	blockedCount: number;
	canAutoFire: boolean;
	isAutoFiring: boolean;
	lastResult: RequestResult | undefined;
	lastScenario: StressScenario | null;
	wasBlocked: boolean;
	flowPhase: number;
	flowMessages: string[];
	onFire: (scenarioId: string) => void;
	onToggleAutoFire: (onFire: (scenarioId: string) => void) => void;
}

export function RewardPhase({
	scenarios,
	results,
	allowedCount,
	blockedCount,
	canAutoFire,
	isAutoFiring,
	lastResult,
	lastScenario,
	wasBlocked,
	flowPhase,
	flowMessages,
	onFire,
	onToggleAutoFire,
}: RewardPhaseProps) {
	return (
		<div className="flex-1 flex flex-col">
			{/* Data Transform Lane: active normalizes + callbacks */}
			<div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-6">
				{/* Input Zone */}
				<div
					className={`w-full max-w-sm border rounded-lg p-3 bg-card text-center transition-all duration-300 ${
						flowPhase === 0
							? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
							: ''
					}`}
				>
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
						Raw User Data
					</div>
					<div className="text-xs font-mono text-foreground">
						{lastScenario ? lastScenario.actor : 'Fire a scenario below'}
					</div>
					{flowMessages[0] && (flowPhase >= 0 || flowPhase === -1) && (
						<div
							className={`text-xs text-primary font-medium mt-1.5 ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
						>
							{flowMessages[0]}
						</div>
					)}
				</div>

				<FlowConnector active={flowPhase === 1} />

				{/* Normalizes Zone (active) */}
				<div
					className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 ${
						flowPhase === 2
							? 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success bg-success/10 dark:bg-success/15'
							: lastScenario?.id === 'signup-messy'
								? 'border-success bg-success/10 dark:bg-success/15'
								: 'border-success/40 bg-success/5 dark:bg-success/10'
					}`}
				>
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Normalizes
					</div>
					<div className="font-mono text-xs text-success mt-1">
						{lastScenario?.id === 'signup-messy'
							? 'strip + downcase'
							: lastScenario?.id === 'lookup-clean'
								? 'query normalized'
								: 'e.strip.downcase'}
					</div>
					{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
						<div
							className={`text-xs text-success font-medium mt-1 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
						>
							{flowMessages[1]}
						</div>
					)}
				</div>

				<FlowConnector active={flowPhase === 3} />

				{/* Model Zone */}
				<div
					className={`w-full max-w-sm border rounded-lg p-3 text-center bg-card transition-all duration-300 ${
						flowPhase === 4
							? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
							: ''
					}`}
				>
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						User Model
					</div>
					<div className="text-xs font-mono text-muted-foreground mt-1">
						validates + saves
					</div>
					{flowMessages[2] && (flowPhase >= 4 || flowPhase === -1) && (
						<div
							className={`text-xs text-primary font-medium mt-1 ${flowPhase === 4 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
						>
							{flowMessages[2]}
						</div>
					)}
				</div>

				<FlowConnector
					active={flowPhase === 5}
					dotColor={
						wasBlocked
							? 'bg-destructive'
							: lastResult
								? 'bg-success'
								: 'bg-primary'
					}
				/>

				{/* Callbacks Zone (active) */}
				<div
					className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 ${
						flowPhase === 6
							? wasBlocked
								? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive bg-destructive/5 dark:bg-destructive/10'
								: 'ring-2 ring-success/60 shadow-lg shadow-success/10 border-success bg-success/10 dark:bg-success/15'
							: wasBlocked
								? 'border-destructive bg-destructive/5 dark:bg-destructive/10'
								: lastScenario?.id === 'check-mailer'
									? 'border-success bg-success/10 dark:bg-success/15'
									: 'border-success/40 bg-success/5 dark:bg-success/10'
					}`}
				>
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Callbacks
					</div>
					<div
						className={`font-mono text-xs mt-1 ${
							wasBlocked ? 'text-destructive font-bold' : 'text-success'
						}`}
					>
						{wasBlocked
							? 'no enqueue (rollback)'
							: lastScenario?.id === 'check-mailer'
								? 'controller queued mailer'
								: lastScenario?.id === 'update-no-welcome'
									? 'update path: no mailer'
									: 'save committed'}
					</div>
					{flowMessages[3] && (flowPhase >= 6 || flowPhase === -1) && (
						<div
							className={`text-xs font-medium mt-1 ${flowPhase === 6 ? 'animate-in fade-in duration-300' : 'opacity-70'} ${
								wasBlocked ? 'text-destructive' : 'text-success'
							}`}
						>
							{flowMessages[3]}
						</div>
					)}
					{wasBlocked && flowPhase !== 6 && (
						<div className="text-xs font-bold text-destructive mt-1">
							SAFE (rollback detected)
						</div>
					)}
				</div>
			</div>

			{/* Stress test controls */}
			<div className="px-6 pb-2">
				<StressTestPanel
					allowedCount={allowedCount}
					blockedCount={blockedCount}
					canAutoFire={canAutoFire}
					disabled={flowPhase !== -1}
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
