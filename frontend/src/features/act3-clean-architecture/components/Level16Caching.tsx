/**
 * Level 16: Caching
 *
 * Add caching layer to reduce database load.
 * Shows cache hit (green) vs miss (red) visualization.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
} from '@/components/levels';

interface Query {
	id: number;
	type: string;
	status: 'pending' | 'cache_hit' | 'cache_miss';
	latency: number;
}

export function Level16Caching({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [cacheEnabled, setCacheEnabled] = useState(false);
	const [queries, setQueries] = useState<Query[]>([]);
	const [cacheHits, setCacheHits] = useState(0);
	const [cacheMisses, setCacheMisses] = useState(0);
	const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());
	const [dbLoad, setDbLoad] = useState(0);

	const hitRate =
		cacheHits + cacheMisses > 0
			? Math.round((cacheHits / (cacheHits + cacheMisses)) * 100)
			: 0;

	const isComplete = cacheEnabled && hitRate >= 70;

	// Simulate queries
	useEffect(() => {
		const queryTypes = [
			'users/1',
			'posts/hot',
			'users/1',
			'posts/hot',
			'users/2',
			'users/1',
		];
		let queryIndex = 0;

		const interval = setInterval(() => {
			const queryType = queryTypes[queryIndex % queryTypes.length];
			const id = Date.now();

			const query: Query = {
				id,
				type: queryType,
				status: 'pending',
				latency: 0,
			};

			setQueries((prev) => [...prev.slice(-10), query]);

			// Process query
			setTimeout(() => {
				const isCacheHit = cacheEnabled && cachedKeys.has(queryType);
				const latency = isCacheHit
					? 2 + Math.random() * 3
					: 50 + Math.random() * 100;

				if (isCacheHit) {
					setCacheHits((c) => c + 1);
				} else {
					setCacheMisses((c) => c + 1);
					setDbLoad((l) => Math.min(100, l + 15));
					// Add to cache
					if (cacheEnabled) {
						setCachedKeys((prev) => new Set([...prev, queryType]));
					}
				}

				setQueries((prev) =>
					prev.map((q) =>
						q.id === id
							? {
									...q,
									status: isCacheHit ? 'cache_hit' : 'cache_miss',
									latency,
								}
							: q,
					),
				);
			}, 200);

			queryIndex++;
		}, 800);

		// Reduce DB load over time
		const loadInterval = setInterval(() => {
			setDbLoad((l) => Math.max(0, l - 5));
		}, 500);

		return () => {
			clearInterval(interval);
			clearInterval(loadInterval);
		};
	}, [cacheEnabled, cachedKeys]);

	const handleComplete = async () => {
		const success = await completeLevel('act3-level16-caching', { stars: 3 });
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn to use Redis caching to reduce database load and improve response times."
					instructions={[
						'Watch all queries go to the database (red lines)',
						'Enable Redis caching',
						'See repeated queries hit the cache (green lines)',
					]}
					scenario="The database is at 100% CPU! Every request hits the database, even for data that rarely changes. Users are seeing slow load times."
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${cacheEnabled ? 'bg-success text-success-foreground cursor-default' : ''}`}
							disabled={cacheEnabled}
							onClick={() => setCacheEnabled(true)}
							variant={cacheEnabled ? 'secondary' : 'default'}
						>
							{cacheEnabled ? 'Cache Enabled' : 'Enable Redis Cache'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Cache Stats
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-success/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-success">
									{cacheHits}
								</div>
								<div className="text-xs text-success/70">Cache Hits</div>
							</div>
							<div className="bg-destructive/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-destructive">
									{cacheMisses}
								</div>
								<div className="text-xs text-destructive/70">Cache Misses</div>
							</div>
						</div>
						<div className="mt-3">
							<div className="flex justify-between text-xs text-muted-foreground mb-1">
								<span>Hit Rate</span>
								<span>{hitRate}%</span>
							</div>
							<div className="bg-secondary rounded-full h-2 overflow-hidden">
								<div
									className={`h-full transition-all ${hitRate >= 70 ? 'bg-success' : 'bg-warning'}`}
									style={{ width: `${hitRate}%` }}
								/>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Caching"
					levelNumber={16}
					onExit={onExit}
					onReset={() => {
						setCacheEnabled(false);
						setQueries([]);
						setCacheHits(0);
						setCacheMisses(0);
						setCachedKeys(new Set());
						setDbLoad(0);
					}}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture */}
					<div className="flex items-center justify-center gap-6 mb-8">
						{/* App */}
						<div className="bg-card border border-border rounded-xl p-4 w-32 text-center">
							<div className="text-2xl mb-2">A</div>
							<div className="text-muted-foreground text-sm">App</div>
						</div>

						<svg
							className="w-8 h-8 text-muted-foreground"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M14 5l7 7m0 0l-7 7m7-7H3"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
							/>
						</svg>

						{/* Redis Cache */}
						{cacheEnabled && (
							<>
								<div className="bg-destructive/20 border border-destructive rounded-xl p-4 w-40 text-center">
									<div className="text-2xl mb-2">R</div>
									<div className="text-destructive text-sm">Redis Cache</div>
									<div className="text-destructive/80 text-xs mt-1">
										{cachedKeys.size} keys cached
									</div>
								</div>

								<svg
									className="w-8 h-8 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M14 5l7 7m0 0l-7 7m7-7H3"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>
							</>
						)}

						{/* Database */}
						<div
							className={`border rounded-xl p-4 w-40 text-center transition-colors ${
								dbLoad > 80
									? 'bg-destructive/20 border-destructive'
									: dbLoad > 50
										? 'bg-warning/20 border-warning'
										: 'bg-card border-border'
							}`}
						>
							<div className="text-2xl mb-2">DB</div>
							<div
								className={`text-sm ${
									dbLoad > 80
										? 'text-destructive'
										: dbLoad > 50
											? 'text-warning'
											: 'text-muted-foreground'
								}`}
							>
								PostgreSQL
							</div>
							<div className="mt-2">
								<div className="text-xs text-muted-foreground mb-1">
									CPU: {dbLoad}%
								</div>
								<div className="bg-secondary rounded-full h-2 overflow-hidden">
									<div
										className={`h-full transition-all ${
											dbLoad > 80
												? 'bg-destructive'
												: dbLoad > 50
													? 'bg-warning'
													: 'bg-success'
										}`}
										style={{ width: `${dbLoad}%` }}
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Query Log */}
					<div className="bg-card rounded-xl p-4 max-w-2xl mx-auto">
						<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
							Query Log
						</div>
						<div className="space-y-2 max-h-48 overflow-y-auto">
							{queries.map((q) => (
								<div
									className={`flex items-center justify-between p-2 rounded-lg ${
										q.status === 'pending'
											? 'bg-secondary'
											: q.status === 'cache_hit'
												? 'bg-success/20'
												: 'bg-destructive/20'
									}`}
									key={q.id}
								>
									<div className="flex items-center gap-3">
										<div
											className={`w-2 h-2 rounded-full ${
												q.status === 'pending'
													? 'bg-muted-foreground animate-pulse'
													: q.status === 'cache_hit'
														? 'bg-success'
														: 'bg-destructive'
											}`}
										/>
										<span className="text-muted-foreground font-mono text-sm">
											GET /{q.type}
										</span>
									</div>
									<div className="text-sm">
										{q.status === 'pending' && (
											<span className="text-muted-foreground">...</span>
										)}
										{q.status === 'cache_hit' && (
											<span className="text-success">
												{q.latency.toFixed(1)}ms (cache)
											</span>
										)}
										{q.status === 'cache_miss' && (
											<span className="text-destructive">
												{q.latency.toFixed(1)}ms (db)
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Completion button */}
					{isComplete && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
							<Button
								className="bg-linear-to-r from-success to-success/80 text-success-foreground font-bold shadow-lg"
								onClick={handleComplete}
								size="lg"
							>
								Complete Level
							</Button>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/user.rb',
							language: 'ruby',
							code: `class User < ApplicationRecord
  def self.find_cached(id)
    Rails.cache.fetch("users/#{id}", expires_in: 1.hour) do
      find(id)
    end
  end

  # Invalidate on update
  after_commit :invalidate_cache

  private

  def invalidate_cache
    Rails.cache.delete("users/#{id}")
  end
end

# config/environments/production.rb
config.cache_store = :redis_cache_store, {
  url: ENV['REDIS_URL'],
  expires_in: 1.hour
}`,
							highlight: [3, 4, 5, 9, 14, 18, 19, 20, 21],
						},
					]}
					learningGoal="Caching reduces database load by storing frequently accessed data in memory. Always remember to invalidate cache when data changes!"
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level16Caching;
