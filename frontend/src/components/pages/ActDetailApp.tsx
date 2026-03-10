/**
 * Act Detail App Component
 *
 * Displays levels for a specific act.
 */

import { Check, ChevronRight, Lock, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ACTS, isLevelUnlocked } from '@/features/acts-registry';
import { getProgress } from '@/lib/progress';
import type { Level } from '@/types/game';
import { Button } from '../ui/Button';

interface ActDetailAppProps {
	actId: number;
}

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
	href,
}: {
	level: Level;
	isUnlocked: boolean;
	progress?: LevelProgress;
	href: string;
}) {
	const isCompleted = progress?.completed || false;
	const stars = progress?.stars || 0;

	const content = (
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
								className={`w-3.5 h-3.5 ${i < stars ? 'text-warning fill-warning' : 'text-muted'}`}
								key={i}
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
	);

	return (
		<Button
			className={`
				w-full h-auto text-left p-4 justify-start rounded-lg border transition-all
				${
					isUnlocked
						? 'border-border hover:border-primary/50'
						: 'border-transparent opacity-50'
				}
			`}
			disabled={!isUnlocked}
			variant="ghost"
		>
			{isUnlocked ? (
				<a className="flex w-full no-underline" href={href}>
					{content}
				</a>
			) : (
				content
			)}
		</Button>
	);
}

export function ActDetailApp({ actId }: ActDetailAppProps) {
	const [completedLevels, setCompletedLevels] = useState<string[]>([]);
	const [levelProgress, setLevelProgress] = useState<
		Map<string, LevelProgress>
	>(new Map());
	const [loading, setLoading] = useState(true);

	const act = ACTS.find((a) => a.id === actId);

	useEffect(() => {
		fetchProgress();
	}, []);

	async function fetchProgress() {
		try {
			const progress = await getProgress();
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

	if (!act) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-sm text-muted-foreground">Act not found</div>
			</div>
		);
	}

	const completedCount = act.levels.filter((l) =>
		completedLevels.includes(l.id),
	).length;

	return (
		<div className="max-w-2xl mx-auto">
			{/* Breadcrumb */}
			<nav className="flex items-center gap-1.5 text-sm mb-6">
				<a
					className="text-muted-foreground hover:text-foreground transition-colors"
					href="/acts"
				>
					Acts
				</a>
				<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
				<span className="text-foreground font-medium">{act.name}</span>
			</nav>

			{/* Header */}
			<div className="mb-8">
				<div className="flex items-center gap-3 mb-2">
					<div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
						<span className="text-lg font-bold text-primary">{act.id}</span>
					</div>
					<div>
						<h1 className="text-2xl font-semibold text-foreground">
							{act.name}
						</h1>
						<p className="text-sm text-muted-foreground">{act.tagline}</p>
					</div>
				</div>
				<div className="flex items-center gap-2 mt-4">
					<div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
						<div
							className="h-full bg-primary transition-all"
							style={{
								width: `${Math.round((completedCount / act.levels.length) * 100)}%`,
							}}
						/>
					</div>
					<span className="text-xs text-muted-foreground tabular-nums">
						{completedCount}/{act.levels.length}
					</span>
				</div>
			</div>

			{/* Levels */}
			<div className="space-y-2">
				{act.levels.map((level) => (
					<LevelCard
						href={`/acts/${actId}/${level.id}`}
						isUnlocked={isLevelUnlocked(level.id, completedLevels)}
						key={level.id}
						level={level}
						progress={levelProgress.get(level.id)}
					/>
				))}
			</div>
		</div>
	);
}

export default ActDetailApp;
