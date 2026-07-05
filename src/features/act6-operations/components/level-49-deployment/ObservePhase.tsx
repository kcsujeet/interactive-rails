import {
	CenterPanel,
	CodePreviewPanel,
	LeftPanel,
	LevelHeader,
	RightPanel,
	type ValidateFn,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { PipelineFlow } from '@/components/levels/PipelineFlow';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { Button } from '@/components/ui/Button';
import type { UseDiscoveryGatingReturn } from '@/hooks/useDiscoveryGating';
import {
	observeConnections,
	observeIdleStages,
	PROBE_FRAMES,
} from './data/pipeline-stages';
import { PROBE_DISCOVERY_MAP, PROBES } from './data/probes';
import { usePipelineFrames } from './usePipelineFrames';

interface CodeFile {
	filename: string;
	language: string;
	code: string;
}

interface ObservePhaseProps {
	discoveryGating: UseDiscoveryGatingReturn;
	codeFiles: CodeFile[];
	onAdvance: () => void;
	onValidate: ValidateFn;
	onComplete: () => void;
}

export function ObservePhase({
	discoveryGating,
	codeFiles,
	onAdvance,
	onValidate,
	onComplete,
}: ObservePhaseProps) {
	const { currentFrame, isPlaying, play } = usePipelineFrames();
	const stages = currentFrame?.stages ?? observeIdleStages;

	const handleProbe = (probeId: string) => {
		const frames = PROBE_FRAMES[probeId];
		if (frames) play(frames);
		const ids = PROBE_DISCOVERY_MAP[probeId] ?? [];
		for (const id of ids) discoveryGating.discover(id);
	};

	return (
		<>
			<LeftPanel>
				<div className="p-4 border-b border-border">
					<h3 className="text-sm font-semibold text-foreground mb-2">
						Scenario
					</h3>
					<p className="text-sm text-muted-foreground leading-relaxed">
						Your app is feature-complete but still lives on your laptop. The
						current "deploy process" is a few lines of shell. Fire the probes
						below and see what breaks.
					</p>
				</div>
				<div className="p-4">
					<DiscoveryChecklist
						discoveredCount={discoveryGating.discoveredCount}
						discoveries={discoveryGating.discoveries}
						minRequired={discoveryGating.discoveries.length}
					/>
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Deployment"
					levelNumber={42}
					onComplete={onComplete}
					onReset={() => window.location.reload()}
					onValidate={onValidate}
				/>
				<div className="flex-1 flex flex-col bg-background overflow-auto">
					<div className="flex-1 p-6 min-h-[280px]">
						<PipelineFlow
							activeConnections={[]}
							connections={observeConnections}
							stages={stages}
						/>
					</div>
					<div className="border-t border-border p-4">
						<ProbeTerminal
							disabled={isPlaying}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
					{discoveryGating.isUnlocked && (
						<div className="border-t border-border p-4 flex justify-end animate-in fade-in duration-500">
							<Button
								className="bg-primary hover:bg-primary/90"
								onClick={onAdvance}
							>
								Build the Fix
							</Button>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={codeFiles} />
			</RightPanel>
		</>
	);
}
