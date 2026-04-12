import type { Act } from '@/types';
import { level23N1Problem } from './level-23-n1-problem';
import { level24EagerLoading } from './level-24-eager-loading';
import { level25NarrowFetching } from './level-25-narrow-fetching';
import { level26DatabaseIndexing } from './level-26-database-indexing';
import { level27CounterCaches } from './level-27-counter-caches';
import { level28Pagination } from './level-28-pagination';
import { level29Search } from './level-29-search';
import { level30Caching } from './level-30-caching';
import { level31HTTPCaching } from './level-31-http-caching';

export const actFour: Act = {
	id: 4,
	name: 'Performance',
	tagline: 'Traffic is growing. The API is slowing down.',
	description:
		'Users are multiplying and response times are climbing. Diagnose N+1 queries, add eager loading, narrow fetching, database indexes, counter caches, pagination, search, and caching layers to keep the API fast.',
	levels: [
		level23N1Problem,
		level24EagerLoading,
		level25NarrowFetching,
		level26DatabaseIndexing,
		level27CounterCaches,
		level28Pagination,
		level29Search,
		level30Caching,
		level31HTTPCaching,
	],
	unlockedNodes: ['eager_load', 'index', 'cache', 'pagination', 'search'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'queryCount', 'cacheHitRate'],
};
