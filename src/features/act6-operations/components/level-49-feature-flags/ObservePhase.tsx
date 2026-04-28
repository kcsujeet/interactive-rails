import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import {
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { Button } from '@/components/ui/Button';
import { PROBE_OBSERVE_OVERRIDES } from './data/pipeline-stages';

interface ObservePhaseProps {
	baseStages: PipelineStage[];
	connections: PipelineConnection[];
	probes: ProbeConfig[];
	inspectorData: StageInspectorData | null;
	inspectedStages: Set<string>;
	canStartBuild: boolean;
	/** The id of the most recently fired probe, or null if none yet. */
	lastProbeId: string | null;
	/**
	 * Bumped on every probe fire so PipelineFlow re-keys its dot circles
	 * and restarts the SVG single-pass animation when the same probe is
	 * fired twice. See `.agents/rules/pedagogy.md` (re-fire restart).
	 */
	animationTick: number;
	onStageClick: (stageId: string) => void;
	onProbe: (probeId: string) => void;
	onCloseInspector: () => void;
	onStartBuild: () => void;
}

export function ObservePhase({
	baseStages,
	connections,
	probes,
	inspectorData,
	inspectedStages,
	canStartBuild,
	lastProbeId,
	animationTick,
	onStageClick,
	onProbe,
	onCloseInspector,
	onStartBuild,
}: ObservePhaseProps) {
	// Merge per-probe overrides into the base stages so firing a probe
	// visibly mutates the pipeline. See .agents/rules/pedagogy.md.
	// Also clear the pulsing "?" indicator on stages the player has clicked.
	const stages = useMemo<PipelineStage[]>(() => {
		const override = lastProbeId ? PROBE_OBSERVE_OVERRIDES[lastProbeId] : null;
		return baseStages.map((s) => {
			const inspected = inspectedStages.has(s.id);
			const stageOverride = override?.stages[s.id];
			const merged = stageOverride ? { ...s, ...stageOverride } : s;
			return inspected ? { ...merged, inspected: true } : merged;
		});
	}, [baseStages, inspectedStages, lastProbeId]);

	// Default to dormant ([]). Edges only animate after a probe fires.
	// `undefined` would put PipelineFlow into continuous "idle" mode and
	// imply data is flowing before the player has done anything.
	const activeConnections = useMemo<string[]>(() => {
		if (!lastProbeId) return [];
		return PROBE_OBSERVE_OVERRIDES[lastProbeId]?.activeConnections ?? [];
	}, [lastProbeId]);

	return (
		<div className="flex-1 flex flex-col">
			<div className="flex-1 relative px-6 py-4">
				<PipelineFlow
					activeConnections={activeConnections}
					animationTick={animationTick}
					connections={connections}
					onNodeClick={onStageClick}
					stages={stages}
				/>
				{inspectorData && (
					<StageInspector data={inspectorData} onClose={onCloseInspector} />
				)}
			</div>

			<div className="px-6 pb-2">
				<ProbeTerminal
					onProbe={onProbe}
					probes={probes}
					title="Production Incident Probe"
				/>
			</div>

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
