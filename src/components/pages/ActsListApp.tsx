/**
 * Acts List App Component
 *
 * Displays all acts with collapsible level lists inline.
 */

import { Check, ChevronDown, ChevronRight, Lock, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
	ACTS,
	getTotalLevelCount,
	isLevelUnlocked,
} from '@/features/acts-registry';
import { CodebaseViewerDialog } from '@/features/codebase-viewer/components/CodebaseViewerDialog';
import { buildUnifiedProject } from '@/features/codebase-viewer/utils/codebase-registry';
import type { LevelProgressEntry } from '@/lib/progress';
import { getProgress } from '@/lib/progress';
import type { Level } from '@/types/game';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '../ui/collapsible';

function LevelCard({
	level,
	actId,
	isUnlocked,
	isCompleted,
	stars,
}: {
	level: Level;
	actId: number;
	isUnlocked: boolean;
	isCompleted: boolean;
	stars: number;
}) {
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
						{[1, 2, 3].map((n) => (
							<Star
								className={`w-3.5 h-3.5 ${n <= stars ? 'text-warning fill-warning' : 'text-muted'}`}
								key={n}
							/>
						))}
					</div>
				)}
				{!isUnlocked && <Lock className="w-4 h-4 text-muted-foreground" />}
			</div>
		</div>
	);

	return (
		<Button
			className={`w-full h-auto text-left p-3 justify-start rounded-lg border transition-all ${
				isUnlocked
					? 'border-border hover:border-primary/50'
					: 'border-transparent opacity-50'
			}`}
			disabled={!isUnlocked}
			variant="ghost"
		>
			{isUnlocked ? (
				<a
					className="flex w-full no-underline"
					href={`/acts/${actId}/${level.id}`}
				>
					{content}
				</a>
			) : (
				content
			)}
		</Button>
	);
}

export function ActsListApp() {
	const [completedLevels, setCompletedLevels] = useState<string[]>([]);
	const [levelProgress, setLevelProgress] = useState<
		Record<string, LevelProgressEntry>
	>({});
	const [isGuest, setIsGuest] = useState(true);
	const [loading, setLoading] = useState(true);
	const [openActs, setOpenActs] = useState<Set<number>>(() => {
		if (typeof window === 'undefined') return new Set();
		try {
			const saved = localStorage.getItem('interactive_rails_open_acts');
			if (saved) return new Set(JSON.parse(saved) as number[]);
		} catch {}
		return new Set();
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount
	useEffect(() => {
		fetchProgress();
	}, []);

	async function fetchProgress() {
		try {
			const progress = await getProgress();
			setIsGuest(progress.isGuest);
			setCompletedLevels(progress.completedLevels);
			setLevelProgress(progress.levelProgress);

			// Auto-open the first incomplete act only if no saved state
			const saved = localStorage.getItem('interactive_rails_open_acts');
			if (!saved) {
				for (const act of ACTS) {
					const allComplete = act.levels.every((l) =>
						progress.completedLevels.includes(l.id),
					);
					if (!allComplete) {
						updateOpenActs(new Set([act.id]));
						break;
					}
				}
			}
		} catch (err) {
			console.error('Fetch progress error:', err);
		} finally {
			setLoading(false);
		}
	}

	function updateOpenActs(next: Set<number>) {
		setOpenActs(next);
		try {
			localStorage.setItem(
				'interactive_rails_open_acts',
				JSON.stringify([...next]),
			);
		} catch {}
	}

	function toggleAct(actId: number) {
		setOpenActs((prev) => {
			const next = new Set(prev);
			if (next.has(actId)) {
				next.delete(actId);
			} else {
				next.add(actId);
			}
			updateOpenActs(next);
			return next;
		});
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

	const projectFiles = useMemo(
		() => buildUnifiedProject(completedLevels),
		[completedLevels],
	);

	return (
		<div className="max-w-2xl mx-auto">
			<div className="mb-8 flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold text-foreground mb-2">
						Acts
					</h1>
					<p className="text-muted-foreground text-sm">
						Progress through Rails concepts from fundamentals to production.
					</p>
				</div>
				{totalCompleted > 0 && (
					<CodebaseViewerDialog
						files={projectFiles}
						levelCount={totalCompleted}
					/>
				)}
			</div>

			<div className="mb-8">
				<div className="flex items-center justify-between mb-2">
					<span className="text-sm text-muted-foreground">
						Overall Progress
					</span>
					<span className="text-sm font-medium text-foreground tabular-nums">
						{totalCompleted} / {totalLevels}
					</span>
				</div>
				<div className="h-2 bg-secondary rounded-full overflow-hidden">
					<div
						className="h-full bg-linear-to-r from-primary to-amber-400 transition-all duration-500"
						style={{
							width: `${Math.round((totalCompleted / totalLevels) * 100)}%`,
						}}
					/>
				</div>
			</div>

			{isGuest && (
				<div className="mb-6 flex items-center justify-between gap-4 py-3 px-4 bg-warning/10 border border-warning/20 rounded-lg">
					<span className="text-sm text-foreground">
						Playing as guest - progress won't sync
					</span>
					<Button className="px-0" size="sm" variant="link">
						<a href="/signup">Create account</a>
					</Button>
				</div>
			)}

			<div className="space-y-3">
				{ACTS.map((act) => {
					const actCompleted = act.levels.every((l) =>
						completedLevels.includes(l.id),
					);
					const actUnlocked = act.levels.some((l) =>
						isLevelUnlocked(l.id, completedLevels),
					);
					const completedCount = act.levels.filter((l) =>
						completedLevels.includes(l.id),
					).length;
					const isOpen = openActs.has(act.id);

					return (
						<Collapsible
							disabled={!actUnlocked}
							key={act.id}
							onOpenChange={() => actUnlocked && toggleAct(act.id)}
							open={isOpen}
						>
							<Card
								className={`p-0 gap-0 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both ${
									actUnlocked
										? 'transition-all duration-200 hover:border-primary/40'
										: 'border-transparent opacity-50'
								}`}
							>
								<CollapsibleTrigger
									className={`flex items-center justify-between w-full p-5 text-left ${actUnlocked ? 'cursor-pointer' : 'cursor-default'}`}
								>
									<div className="flex items-center gap-4">
										<div
											className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold ${
												actCompleted
													? 'bg-success/15 text-success'
													: actUnlocked
														? 'bg-primary/10 text-primary border border-primary/20'
														: 'bg-secondary text-muted-foreground'
											}`}
										>
											{actCompleted ? <Check className="w-5 h-5" /> : act.id}
										</div>
										<div>
											<h3 className="text-base font-medium text-foreground">
												{act.name}
											</h3>
											<p className="text-sm text-muted-foreground mt-0.5">
												{act.tagline}
											</p>
											<div className="flex items-center gap-2 mt-2">
												<div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
													<div
														className="h-full bg-linear-to-r from-primary to-amber-400 transition-all"
														style={{
															width: `${Math.round((completedCount / act.levels.length) * 100)}%`,
														}}
													/>
												</div>
												<span className="text-xs text-muted-foreground tabular-nums">
													{completedCount}/{act.levels.length}
												</span>
												<Badge size="sm" variant="secondary">
													L{act.levels[0].levelNumber}
													&ndash;
													{act.levels[act.levels.length - 1].levelNumber}
												</Badge>
											</div>
										</div>
									</div>
									<div className="shrink-0">
										{!actUnlocked ? (
											<Lock className="w-5 h-5 text-muted-foreground" />
										) : isOpen ? (
											<ChevronDown className="w-5 h-5 text-muted-foreground transition-transform" />
										) : (
											<ChevronRight className="w-5 h-5 text-muted-foreground transition-transform" />
										)}
									</div>
								</CollapsibleTrigger>

								<CollapsibleContent>
									<div className="border-t border-border px-4 pb-4 pt-2 space-y-1">
										{act.levels.map((level) => {
											const progress = levelProgress[level.id];
											return (
												<LevelCard
													actId={act.id}
													isCompleted={completedLevels.includes(level.id)}
													isUnlocked={isLevelUnlocked(
														level.id,
														completedLevels,
													)}
													key={level.id}
													level={level}
													stars={progress?.stars ?? 0}
												/>
											);
										})}
									</div>
								</CollapsibleContent>
							</Card>
						</Collapsible>
					);
				})}
			</div>
		</div>
	);
}

export default ActsListApp;
