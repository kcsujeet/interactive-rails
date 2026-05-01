import { ArrowRight } from 'lucide-react';
import { FlowConnector } from '@/components/levels/FlowConnector';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { Button } from '@/components/ui/Button';
import { PROBE_DATA_CARD } from './data/probes';

interface ProbeDisplay {
	normalizesSublabel: string;
	callbacksBadge: string;
}

interface ObservePhaseProps {
	probes: ProbeConfig[];
	inspectorData: StageInspectorData | null;
	inspectedStages: Set<string>;
	lastProbeId: string | null;
	probeDisplay: ProbeDisplay | null;
	flowPhase: number;
	flowMessages: string[];
	canStartBuild: boolean;
	onStageClick: (stageId: string) => void;
	onProbe: (probeId: string) => void;
	onCloseInspector: () => void;
	onStartBuild: () => void;
}

export function ObservePhase({
	probes,
	inspectorData,
	inspectedStages,
	lastProbeId,
	probeDisplay,
	flowPhase,
	flowMessages,
	canStartBuild,
	onStageClick,
	onProbe,
	onCloseInspector,
	onStartBuild,
}: ObservePhaseProps) {
	return (
		<div className="flex-1 flex flex-col">
			{/* Data Transform Lane: vertical zones with arrows */}
			<div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-6 relative">
				{/* Input Zone */}
				<button
					className={`w-full max-w-sm border rounded-lg p-3 bg-card text-left transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
						flowPhase === 0
							? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
							: !inspectedStages.has('input')
								? 'ring-1 ring-primary/20'
								: ''
					}`}
					onClick={() => onStageClick('input')}
					type="button"
				>
					<div className="flex items-center justify-between mb-1.5">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Raw User Data
						</span>
						{!inspectedStages.has('input') && flowPhase !== 0 && (
							<span className="text-primary text-sm animate-pulse font-bold">
								?
							</span>
						)}
					</div>
					<pre className="text-xs font-mono text-foreground leading-relaxed">
						{lastProbeId ? PROBE_DATA_CARD[lastProbeId] : '"  JOE@GMAIL.COM  "'}
					</pre>
					{flowMessages[0] && (flowPhase >= 0 || flowPhase === -1) && (
						<div
							className={`text-xs text-primary font-medium mt-1.5 ${flowPhase === 0 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
						>
							{flowMessages[0]}
						</div>
					)}
				</button>

				<FlowConnector
					active={flowPhase === 1}
					dotColor={probeDisplay ? 'bg-destructive' : 'bg-primary'}
				/>

				{/* Normalizes Zone */}
				<button
					className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
						flowPhase === 2
							? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
							: probeDisplay
								? 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
								: 'border-dashed border-muted-foreground/30 bg-muted/30 dark:bg-muted/10'
					} ${
						flowPhase !== 2 && !inspectedStages.has('normalizes')
							? 'ring-1 ring-primary/20'
							: ''
					}`}
					onClick={() => onStageClick('normalizes')}
					type="button"
				>
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Normalizes
					</div>
					<div
						className={`text-sm font-mono mt-1 ${
							probeDisplay ? 'text-destructive' : 'text-muted-foreground/50'
						}`}
					>
						{probeDisplay ? probeDisplay.normalizesSublabel : '(no normalizes)'}
					</div>
					{flowMessages[1] && (flowPhase >= 2 || flowPhase === -1) && (
						<div
							className={`text-xs text-destructive font-medium mt-1 ${flowPhase === 2 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
						>
							{flowMessages[1]}
						</div>
					)}
					{!inspectedStages.has('normalizes') && flowPhase !== 2 && (
						<div className="text-primary text-sm animate-pulse font-bold mt-1">
							?
						</div>
					)}
				</button>

				<FlowConnector active={flowPhase === 3} />

				{/* Model Zone */}
				<button
					className={`w-full max-w-sm border rounded-lg p-3 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
						flowPhase === 4
							? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10'
							: !inspectedStages.has('model')
								? 'ring-1 ring-primary/20'
								: ''
					}`}
					onClick={() => onStageClick('model')}
					type="button"
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
					{!inspectedStages.has('model') && flowPhase !== 4 && (
						<div className="text-primary text-sm animate-pulse font-bold mt-1">
							?
						</div>
					)}
				</button>

				<FlowConnector
					active={flowPhase === 5}
					dotColor={probeDisplay ? 'bg-destructive' : 'bg-primary'}
				/>

				{/* Callbacks Zone */}
				<button
					className={`w-full max-w-sm border-2 rounded-lg p-3 text-center transition-all duration-300 hover:ring-2 hover:ring-ring/30 cursor-pointer ${
						flowPhase === 6
							? 'ring-2 ring-destructive/60 shadow-lg shadow-destructive/10 border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
							: probeDisplay
								? 'border-destructive/50 bg-destructive/5 dark:bg-destructive/10'
								: 'border-dashed border-muted-foreground/30 bg-muted/30 dark:bg-muted/10'
					} ${
						flowPhase !== 6 && !inspectedStages.has('callbacks')
							? 'ring-1 ring-primary/20'
							: ''
					}`}
					onClick={() => onStageClick('callbacks')}
					type="button"
				>
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Callbacks
					</div>
					<div
						className={`text-sm font-mono mt-1 ${
							probeDisplay ? 'text-destructive' : 'text-muted-foreground/50'
						}`}
					>
						{probeDisplay ? probeDisplay.callbacksBadge : '(no callbacks)'}
					</div>
					{flowMessages[3] && (flowPhase >= 6 || flowPhase === -1) && (
						<div
							className={`text-xs text-destructive font-medium mt-1 ${flowPhase === 6 ? 'animate-in fade-in duration-300' : 'opacity-70'}`}
						>
							{flowMessages[3]}
						</div>
					)}
					{!inspectedStages.has('callbacks') && flowPhase !== 6 && (
						<div className="text-primary text-sm animate-pulse font-bold mt-1">
							?
						</div>
					)}
				</button>

				{inspectorData && (
					<StageInspector data={inspectorData} onClose={onCloseInspector} />
				)}
			</div>

			{/* Probe terminal */}
			<div className="px-6 pb-2">
				<ProbeTerminal
					disabled={flowPhase !== -1}
					onProbe={onProbe}
					probes={probes}
					title="Data Probe"
				/>
			</div>

			{/* Build the Fix button (discovery gated) */}
			{canStartBuild && (
				<div className="p-4 flex justify-center animate-in fade-in duration-500">
					<Button className="gap-2" onClick={onStartBuild} size="lg">
						Build the Fix
						<ArrowRight className="w-4 h-4" />
					</Button>
				</div>
			)}
		</div>
	);
}
