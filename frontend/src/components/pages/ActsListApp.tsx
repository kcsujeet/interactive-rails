/**
 * Acts List App Component
 *
 * Displays the list of Acts as cards linking to act detail pages.
 */

import { useEffect, useState } from 'react';
import {
	ACTS,
	getTotalLevelCount,
	isLevelUnlocked,
} from '@/features/acts-registry';
import { getProgress } from '@/lib/progress';
import { Button } from '../ui/Button';
import { ActCard } from './ActCard';

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
						<ActCard
							act={act}
							completedCount={completedCount}
							isCompleted={actCompleted}
							isUnlocked={actUnlocked}
							key={act.id}
						/>
					);
				})}
			</div>
		</div>
	);
}

export default ActsListApp;
