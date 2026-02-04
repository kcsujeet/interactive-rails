/**
 * Briefing Screen Component
 * Pre-game screen showing challenge info
 */

import type { LevelData, LevelChallenge } from './types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface BriefingScreenProps {
  level: LevelData;
  challenge: LevelChallenge | undefined;
  onStart: () => void;
  onExit: () => void;
}

/** @deprecated Use level prop instead */
interface LegacyBriefingScreenProps {
  dungeon: LevelData;
  challenge: LevelChallenge | undefined;
  onStart: () => void;
  onExit: () => void;
}

export function BriefingScreen(props: BriefingScreenProps | LegacyBriefingScreenProps) {
  // Support both 'level' and legacy 'dungeon' prop names
  const level = 'level' in props ? props.level : props.dungeon;
  const { challenge, onStart, onExit } = props;

  return (
    <div className="h-full overflow-auto flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Breadcrumb */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground mb-8 px-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Acts</span>
        </Button>

        {/* Title Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            {(challenge?.concepts || level.concepts)?.map((concept: string) => (
              <Badge key={concept} variant="default">
                {concept}
              </Badge>
            ))}
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">{challenge?.name || level.name}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{challenge?.description || level.description}</p>
        </div>

        {/* Content Grid */}
        <div className="space-y-3">
          {(challenge?.scenario || level.scenario) && (
            <div className="flex gap-4 items-start">
              <div className="w-20 shrink-0 pt-0.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Scenario</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed flex-1">{challenge?.scenario || level.scenario}</p>
            </div>
          )}

          {(challenge?.problem || level.problem) && (
            <div className="mt-4 bg-card rounded-lg overflow-hidden border border-border">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Problem</span>
              </div>
              <pre className="p-4 text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                {challenge?.problem || level.problem}
              </pre>
            </div>
          )}

          {(challenge?.goal || level.goal) && (
            <div className="mt-4 flex gap-4 items-start bg-success/10 rounded-lg p-4 border border-success/20">
              <div className="w-6 h-6 rounded bg-success/20 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-[11px] font-medium text-success uppercase tracking-wider">Goal</span>
                <p className="text-sm text-success-foreground leading-relaxed mt-1">{challenge?.goal || level.goal}</p>
              </div>
            </div>
          )}

          {challenge?.initialMetrics && (
            <div className="mt-4 flex gap-3">
              <div className="flex-1 bg-card rounded-lg p-3 text-center border border-border">
                <div className="text-2xl font-semibold text-destructive tabular-nums">{challenge.initialMetrics.queries}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">queries</div>
              </div>
              <div className="flex-1 bg-card rounded-lg p-3 text-center border border-border">
                <div className="text-2xl font-semibold text-warning tabular-nums">{challenge.initialMetrics.latency}ms</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">latency</div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8">
          <Button onClick={onStart} className="w-full">
            Start Challenge
          </Button>
        </div>
      </div>
    </div>
  );
}
