import type { Act } from '@/types';
import { level37Middleware } from './level-41-middleware';
import { level38RateLimiting } from './level-42-rate-limiting';
import { level39SoftDeletes } from './level-43-soft-deletes';
import { level40SafeMigrations } from './level-44-safe-migrations';
import { level41RecurringJobs } from './level-45-recurring-jobs';
import { levelDataLifecycle } from './level-46-data-lifecycle';
import { level42ErrorMonitoring } from './level-47-error-monitoring';

export const actSix: Act = {
	id: 6,
	name: 'Reliability',
	tagline: 'Users depend on you. Downtime is not an option.',
	description:
		'Thousands of users rely on your API daily. Add custom middleware, rate limiting, soft deletes, safe migrations, recurring jobs, data lifecycle management, and error monitoring to keep it running.',
	levels: [
		level37Middleware,
		level38RateLimiting,
		level39SoftDeletes,
		level40SafeMigrations,
		level41RecurringJobs,
		levelDataLifecycle,
		level42ErrorMonitoring,
	],
	unlockedNodes: ['middleware', 'rate_limiter', 'audit_trail', 'recurring_job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
