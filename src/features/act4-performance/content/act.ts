import type { Act } from '@/types';
import { level21N1Problem } from './level-21-n1-problem';
import { level22EagerLoading } from './level-22-eager-loading';
import { level23NarrowFetching } from './level-23-narrow-fetching';
import { level24Indexing } from './level-24-indexing';
import { level25CounterCaches } from './level-25-counter-caches';
import { level26Pagination } from './level-26-pagination';
import { level27Search } from './level-27-search';
import { level28Caching } from './level-28-caching';
import { level29HTTPCaching } from './level-29-http-caching';

export const actFour: Act = {
	id: 4,
	name: 'Performance',
	tagline: 'Traffic is growing. The API is slowing down.',
	description:
		'Users are multiplying and response times are climbing. Diagnose N+1 queries, add eager loading, narrow fetching, database indexes, counter caches, pagination, search, and caching layers to keep the API fast.',
	levels: [
		level21N1Problem,
		level22EagerLoading,
		level23NarrowFetching,
		level24Indexing,
		level25CounterCaches,
		level26Pagination,
		level27Search,
		level28Caching,
		level29HTTPCaching,
	],
	unlockedNodes: ['eager_load', 'index', 'cache', 'pagination', 'search'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'queryCount', 'cacheHitRate'],
};
