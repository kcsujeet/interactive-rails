/**
 * Acts List App Component
 *
 * Displays the list of Acts as cards linking to act detail pages.
 */

import { Check, ChevronRight, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	ACTS,
	getTotalLevelCount,
	isLevelUnlocked,
} from '@/features/acts-registry';
import { getProgress } from '@/lib/progress';
import { Button } from '../ui/Button';

export function ActsListApp() {
	const [completedLevels, setCompletedLevels] = useState<string[]>([]);
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

	return (
		<div className="max-w-2xl mx-auto">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-2xl font-semibold text-foreground mb-2">Acts</h1>
				<p className="text-muted-foreground text-sm">
					Progress through Rails concepts from fundamentals to production.
				</p>
			</div>

			{/* Progress bar */}
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

			{/* Acts list */}
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

					return (
						<Button
							className={`
								w-full h-auto p-5 rounded-xl border text-left justify-start
								transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both
								${
									actUnlocked
										? 'border-border hover:border-primary/40 hover:shadow-[0_0_20px_oklch(0.75_0.16_55/0.08)] hover:-translate-y-0.5'
										: 'border-transparent opacity-50'
								}
							`}
							disabled={!actUnlocked}
							key={act.id}
							onClick={() => {
								if (actUnlocked) {
									window.location.href = `/acts/${act.id}`;
								}
							}}
							variant="ghost"
						>
							<div className="flex items-center justify-between w-full">
								<div className="flex items-center gap-4">
									<div
										className={`
											w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold
											${
												actCompleted
													? 'bg-success/15 text-success'
													: actUnlocked
														? 'bg-primary/10 text-primary border border-primary/20'
														: 'bg-secondary text-muted-foreground'
											}
										`}
									>
										{actCompleted ? <Check className="w-5 h-5" /> : act.id}
									</div>
									<div>
										<div className="flex items-baseline gap-2">
											<h3 className="text-base font-medium text-foreground">
												{act.name}
											</h3>
											<span className="text-xs text-muted-foreground">
												L{act.levels[0].levelNumber}–{act.levels[act.levels.length - 1].levelNumber}
											</span>
										</div>
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
										</div>
									</div>
								</div>
								<div className="shrink-0">
									{!actUnlocked && (
										<Lock className="w-5 h-5 text-muted-foreground" />
									)}
									{actUnlocked && (
										<ChevronRight className="w-5 h-5 text-muted-foreground" />
									)}
								</div>
							</div>
						</Button>
					);
				})}
			</div>
		</div>
	);
}

export default ActsListApp;
