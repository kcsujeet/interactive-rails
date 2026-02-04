/**
 * Acts List App Component
 *
 * Displays the list of Acts with levels and completion status.
 */

import { useEffect, useState } from 'react';
import {
	ACTS,
	getAllLevels,
	getTotalLevelCount,
	isLevelUnlocked,
} from '../../content/acts';
import { getProgress } from '@/lib/progress';
import type { Level } from '../game/types';
import { Button } from '../ui/Button';
import { Check, ChevronRight, Lock, Star } from 'lucide-react';

interface LevelProgress {
	levelId: string;
	completed: boolean;
	stars: number;
	bestScore: number;
}

function LevelCard({
	level,
	isUnlocked,
	progress,
	onSelect,
}: {
	level: Level;
	isUnlocked: boolean;
	progress?: LevelProgress;
	onSelect: () => void;
}) {
	const isCompleted = progress?.completed || false;
	const stars = progress?.stars || 0;

	return (
		<Button
			variant="ghost"
			className={`
				w-full h-auto text-left p-4 justify-start rounded-lg border transition-all
				${isUnlocked
					? 'border-border hover:border-primary/50'
					: 'border-transparent opacity-50'
				}
			`}
			disabled={!isUnlocked}
			onClick={onSelect}
		>
			<div className="flex items-center justify-between w-full">
				<div className="flex items-center gap-3 min-w-0">
					<span className="text-xs text-muted-foreground font-mono w-5">
						{level.levelNumber}
					</span>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h4 className="text-sm font-medium text-foreground truncate">
								{level.name}
							</h4>
							{isCompleted && <Check className="w-4 h-4 text-success shrink-0" />}
						</div>
						<p className="text-xs text-muted-foreground truncate mt-0.5">
							{level.learningContent.title}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3 shrink-0">
					{isCompleted && stars > 0 && (
						<div className="flex items-center gap-0.5">
							{Array.from({ length: 3 }).map((_, i) => (
								<Star
									key={i}
									className={`w-3.5 h-3.5 ${i < stars ? 'text-warning fill-warning' : 'text-muted'}`}
								/>
							))}
						</div>
					)}
					{!isUnlocked && <Lock className="w-4 h-4 text-muted-foreground" />}
					{isUnlocked && !isCompleted && (
						<ChevronRight className="w-4 h-4 text-muted-foreground" />
					)}
				</div>
			</div>
		</Button>
	);
}

export function ActsListApp() {
	const [completedLevels, setCompletedLevels] = useState<string[]>([]);
	const [levelProgress, setLevelProgress] = useState<Map<string, LevelProgress>>(new Map());
	const [selectedActId, setSelectedActId] = useState<number>(1);
	const [isGuest, setIsGuest] = useState(true);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchProgress();
	}, []);

	async function fetchProgress() {
		try {
			const progress = await getProgress();
			setIsGuest(progress.isGuest);
			setCompletedLevels(progress.completedLevels);

			const progressMap = new Map<string, LevelProgress>();
			for (const [levelId, entry] of Object.entries(progress.levelProgress)) {
				progressMap.set(levelId, {
					levelId,
					completed: true,
					stars: entry.stars,
					bestScore: entry.bestScore,
				});
			}
			setLevelProgress(progressMap);

			// Auto-select the act with the first incomplete level
			const allLevels = getAllLevels();
			const currentLevel = allLevels.find((l) => !progress.completedLevels.includes(l.id));
			if (currentLevel) {
				setSelectedActId(currentLevel.actId);
			}
		} catch (err) {
			console.error('Fetch progress error:', err);
		} finally {
			setLoading(false);
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-sm text-muted-foreground">Loading...</div>
			</div>
		);
	}

	const totalLevels = getTotalLevelCount();
	const totalCompleted = completedLevels.length;
	const selectedAct = ACTS.find((a) => a.id === selectedActId) || ACTS[0];

	return (
		<div className="max-w-3xl mx-auto">
			{/* Progress bar */}
			<div className="mb-8">
				<div className="flex items-center justify-between mb-2">
					<span className="text-sm text-muted-foreground">Overall Progress</span>
					<span className="text-sm font-medium text-foreground tabular-nums">
						{totalCompleted} / {totalLevels}
					</span>
				</div>
				<div className="h-2 bg-secondary rounded-full overflow-hidden">
					<div
						className="h-full bg-primary transition-all"
						style={{ width: `${Math.round((totalCompleted / totalLevels) * 100)}%` }}
					/>
				</div>
			</div>

			{isGuest && (
				<div className="mb-6 flex items-center justify-between gap-4 py-3 px-4 bg-warning/10 border border-warning/20 rounded-lg">
					<span className="text-sm text-foreground">
						Playing as guest — progress won't sync
					</span>
					<Button variant="link" size="sm" asChild className="px-0">
						<a href="/signup">Create account</a>
					</Button>
				</div>
			)}

			{/* Act tabs */}
			<div className="flex gap-2 mb-6 overflow-x-auto pb-2">
				{ACTS.map((act) => {
					const actCompleted = act.levels.every((l) => completedLevels.includes(l.id));
					const actUnlocked = act.levels.some((l) => isLevelUnlocked(l.id, completedLevels));
					const isSelected = selectedActId === act.id;
					const completedCount = act.levels.filter((l) => completedLevels.includes(l.id)).length;

					return (
						<Button
							key={act.id}
							variant="ghost"
							onClick={() => setSelectedActId(act.id)}
							disabled={!actUnlocked}
							className={`
								flex-shrink-0 h-auto px-4 py-3 rounded-lg border-2 transition-all text-left justify-start
								${isSelected
									? 'border-primary bg-primary/10'
									: actUnlocked
										? 'border-border hover:border-primary/50'
										: 'border-transparent opacity-50'
								}
							`}
						>
							<div className="flex items-center gap-3">
								<div
									className={`
										w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold
										${actCompleted
											? 'bg-success/15 text-success'
											: isSelected
												? 'bg-primary/15 text-primary'
												: 'bg-secondary text-muted-foreground'
										}
									`}
								>
									{actCompleted ? <Check className="w-4 h-4" /> : act.id}
								</div>
								<div>
									<div className="text-sm font-medium text-foreground whitespace-nowrap">
										{act.name}
									</div>
									<div className="text-xs text-muted-foreground">
										{completedCount}/{act.levels.length} levels
									</div>
								</div>
							</div>
						</Button>
					);
				})}
			</div>

			{/* Selected act content */}
			<div className="bg-card border border-border rounded-xl p-6">
				<div className="mb-6">
					<h2 className="text-lg font-semibold text-foreground">{selectedAct.name}</h2>
					<p className="text-sm text-muted-foreground mt-1">{selectedAct.tagline}</p>
				</div>

				<div className="space-y-2">
					{selectedAct.levels.map((level) => (
						<LevelCard
							key={level.id}
							level={level}
							isUnlocked={isLevelUnlocked(level.id, completedLevels)}
							progress={levelProgress.get(level.id)}
							onSelect={() => {
								if (isLevelUnlocked(level.id, completedLevels)) {
									window.location.href = `/acts/${level.id}`;
								}
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export default ActsListApp;
