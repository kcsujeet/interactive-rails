/**
 * Level 20: Caching
 *
 * Implement caching strategies for Rails applications.
 * Player learns fragment, low-level, and HTTP caching.
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
	type ValidationResult,
} from '@/components/levels';

interface CacheLayer {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
	hitRate: number;
	latency: number;
	code: string;
}

interface Request {
	id: number;
	path: string;
	status: 'pending' | 'db' | 'cache' | 'done';
	latency: number;
	cacheHit: boolean;
}

const INITIAL_CACHE_LAYERS: CacheLayer[] = [
	{
		id: 'http',
		name: 'HTTP Caching',
		description: 'Browser/CDN caches entire responses',
		enabled: false,
		hitRate: 0,
		latency: 1,
		code: `# In controller
def show
  @post = Post.find(params[:id])

  # Browser caches for 5 minutes
  expires_in 5.minutes, public: true

  # Or use ETags
  fresh_when(@post)
end`,
	},
	{
		id: 'fragment',
		name: 'Fragment Caching',
		description: 'Cache rendered view partials',
		enabled: false,
		hitRate: 0,
		latency: 5,
		code: `<%# In view %>
<% cache @post do %>
  <article>
    <h1><%= @post.title %></h1>
    <%= render @post.comments %>
  </article>
<% end %>

<%# Auto-expires when post updates %>`,
	},
	{
		id: 'lowlevel',
		name: 'Low-Level Caching',
		description: 'Cache computed data in Rails.cache',
		enabled: false,
		hitRate: 0,
		latency: 10,
		code: `# Cache expensive calculations
def expensive_stats
  Rails.cache.fetch("user_#{id}/stats",
                    expires_in: 1.hour) do
    # This block only runs on cache miss
    {
      post_count: posts.count,
      comment_count: comments.count,
      karma: calculate_karma
    }
  end
end`,
	},
	{
		id: 'query',
		name: 'Query Caching',
		description: 'Cache database query results',
		enabled: false,
		hitRate: 0,
		latency: 15,
		code: `# Cache query results
def trending_posts
  Rails.cache.fetch("trending_posts",
                    expires_in: 10.minutes) do
    Post.trending.limit(10).to_a
  end
end

# Note: to_a forces query execution
# before caching`,
	},
];

export function Level20Caching({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [cacheLayers, setCacheLayers] =
		useState<CacheLayer[]>(INITIAL_CACHE_LAYERS);
	const [requests, setRequests] = useState<Request[]>([]);
	const [isSimulating, setIsSimulating] = useState(false);
	const [totalRequests, setTotalRequests] = useState(0);
	const [cacheHits, setCacheHits] = useState(0);
	const [avgLatency, setAvgLatency] = useState(100);

	const enabledLayers = cacheLayers.filter((l) => l.enabled);
	const dbLatency = 100; // Base DB latency in ms

	useEffect(() => {
		if (!isSimulating) return;

		const interval = setInterval(() => {
			const newRequest: Request = {
				id: Date.now(),
				path: `/posts/${Math.floor(Math.random() * 100)}`,
				status: 'pending',
				latency: 0,
				cacheHit: false,
			};

			// Simulate cache hit/miss based on enabled layers
			let hitAnyCache = false;
			let latency = dbLatency;

			for (const layer of enabledLayers) {
				// Higher hit rate for each enabled layer
				if (Math.random() < 0.7) {
					hitAnyCache = true;
					latency = layer.latency;
					break;
				}
			}

			newRequest.cacheHit = hitAnyCache;
			newRequest.latency = latency;
			newRequest.status = hitAnyCache ? 'cache' : 'db';

			setRequests((prev) => [
				...prev.slice(-19),
				{ ...newRequest, status: 'done' },
			]);
			setTotalRequests((prev) => prev + 1);
			if (hitAnyCache) setCacheHits((prev) => prev + 1);
		}, 200);

		return () => clearInterval(interval);
	}, [isSimulating, enabledLayers]);

	useEffect(() => {
		if (requests.length > 0) {
			const total = requests.reduce((sum, r) => sum + r.latency, 0);
			setAvgLatency(Math.round(total / requests.length));
		}
	}, [requests]);

	const toggleCacheLayer = (layerId: string) => {
		setCacheLayers((prev) =>
			prev.map((l) => (l.id === layerId ? { ...l, enabled: !l.enabled } : l)),
		);
	};

	const validateSolution = (): ValidationResult => {
		if (enabledLayers.length === 0) {
			return {
				valid: false,
				message: 'Enable at least one caching layer!',
				details: ['Click on cache layers to enable them'],
			};
		}
		if (enabledLayers.length < 2) {
			return {
				valid: false,
				message: 'A good caching strategy uses multiple layers!',
				details: ['Enable at least 2 cache layers for redundancy'],
			};
		}
		return {
			valid: true,
			message: 'Multi-layer caching strategy implemented!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level20-caching', { stars: 3 });
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const hitRate =
		totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Build a multi-layer caching strategy to dramatically reduce database load."
					instructions={[
						'HTTP: Cache entire responses at edge',
						'Fragment: Cache rendered HTML partials',
						'Low-level: Cache computed data',
						'Query: Cache database results',
					]}
					scenario="Your database is struggling. Every page load hits the DB. Users are seeing slow response times. Time to add caching layers!"
				>
					{/* Live Metrics */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Live Metrics
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-secondary p-3 rounded-lg">
								<div className="text-xs text-muted-foreground">
									Cache Hit Rate
								</div>
								<div
									className={`text-2xl font-bold ${hitRate > 60 ? 'text-success' : hitRate > 30 ? 'text-warning' : 'text-destructive'}`}
								>
									{hitRate}%
								</div>
							</div>
							<div className="bg-secondary p-3 rounded-lg">
								<div className="text-xs text-muted-foreground">Avg Latency</div>
								<div
									className={`text-2xl font-bold ${avgLatency < 20 ? 'text-success' : avgLatency < 50 ? 'text-warning' : 'text-destructive'}`}
								>
									{avgLatency}ms
								</div>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<Button
							className="w-full py-2"
							onClick={() => setIsSimulating(!isSimulating)}
							variant={isSimulating ? 'destructive' : 'default'}
						>
							{isSimulating ? 'Stop Simulation' : 'Start Traffic Simulation'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">
								Cache layers enabled
							</span>
							<span
								className={
									enabledLayers.length >= 2 ? 'text-success' : 'text-foreground'
								}
							>
								{enabledLayers.length} / {cacheLayers.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{
									width: `${(enabledLayers.length / cacheLayers.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Caching"
					levelNumber={20}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setCacheLayers(INITIAL_CACHE_LAYERS);
						setRequests([]);
						setTotalRequests(0);
						setCacheHits(0);
						setIsSimulating(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Cache Architecture Diagram */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Cache Architecture
								</div>
								<div className="text-xs text-muted-foreground">
									Click layers to enable/disable
								</div>
							</div>

							<div className="p-6">
								{/* Request Flow */}
								<div className="flex items-center justify-between mb-8">
									<div className="text-center">
										<div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-2">
											<span className="text-2xl">👤</span>
										</div>
										<div className="text-xs text-muted-foreground">User</div>
									</div>

									<div className="flex-1 flex items-center justify-center gap-2">
										{cacheLayers.map((layer, i) => (
											<div className="flex items-center" key={layer.id}>
												{i > 0 && (
													<div
														className={`w-8 h-0.5 ${layer.enabled ? 'bg-success' : 'bg-muted-foreground'}`}
													/>
												)}
												<Button
													className={`w-16 h-16 p-0 rounded-lg flex flex-col items-center justify-center border-2 ${
														layer.enabled
															? 'bg-success/20 border-success text-success'
															: 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground'
													}`}
													onClick={() => toggleCacheLayer(layer.id)}
													variant={layer.enabled ? 'default' : 'outline'}
												>
													<span className="text-lg">
														{layer.id === 'http'
															? '🌐'
															: layer.id === 'fragment'
																? '📄'
																: layer.id === 'lowlevel'
																	? '💾'
																	: '🗄️'}
													</span>
													<span className="text-[10px] mt-1">
														{layer.latency}ms
													</span>
												</Button>
												<div
													className={`w-8 h-0.5 ${layer.enabled ? 'bg-success' : 'bg-muted-foreground'}`}
												/>
											</div>
										))}
									</div>

									<div className="text-center">
										<div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-2">
											<span className="text-2xl">🗃️</span>
										</div>
										<div className="text-xs text-muted-foreground">
											Database
										</div>
										<div className="text-xs text-destructive">
											{dbLatency}ms
										</div>
									</div>
								</div>

								{/* Layer Details */}
								<div className="grid grid-cols-4 gap-3">
									{cacheLayers.map((layer) => (
										<div
											className={`p-3 rounded-lg border ${
												layer.enabled
													? 'border-success bg-success/10'
													: 'border-border bg-secondary/50'
											}`}
											key={layer.id}
										>
											<div
												className={`text-sm font-semibold mb-1 ${layer.enabled ? 'text-success' : 'text-muted-foreground'}`}
											>
												{layer.name}
											</div>
											<div className="text-xs text-muted-foreground">
												{layer.description}
											</div>
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Live Request Log */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex justify-between items-center">
								<div className="text-foreground font-semibold">Request Log</div>
								<div className="text-xs text-muted-foreground">
									{totalRequests} requests | {cacheHits} cache hits
								</div>
							</div>

							<div className="p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
								{requests.length === 0 ? (
									<div className="text-muted-foreground text-center py-8">
										Start simulation to see requests...
									</div>
								) : (
									requests.map((req) => (
										<div className="flex items-center gap-3" key={req.id}>
											<span
												className={`w-2 h-2 rounded-full ${req.cacheHit ? 'bg-success' : 'bg-destructive'}`}
											/>
											<span className="text-muted-foreground">{req.path}</span>
											<span
												className={
													req.cacheHit ? 'text-success' : 'text-destructive'
												}
											>
												{req.cacheHit ? 'CACHE HIT' : 'DB QUERY'}
											</span>
											<span className="text-muted-foreground">
												{req.latency}ms
											</span>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={cacheLayers
						.filter((l) => l.enabled)
						.map((l) => ({
							filename: `${l.id}_cache.rb`,
							language: 'ruby',
							code: l.code,
							highlight: [],
						}))}
					learningGoal="Cache at multiple layers. Closest to user = fastest. Balance freshness vs performance."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Cache Invalidation
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Touch parent when child changes
class Comment < AR::Base
  belongs_to :post, touch: true
end

# Manual invalidation
Rails.cache.delete("key")

# Pattern invalidation
Rails.cache.delete_matched("posts/*")`}
						</pre>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Cache Stores
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• memory_store - Dev only</li>
							<li>• redis_cache_store - Production</li>
							<li>• memcache_store - Alternative</li>
							<li>• solid_cache - Rails 8 default</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level20Caching;
