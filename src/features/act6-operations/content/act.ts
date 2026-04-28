import type { Act } from '@/types';
import { level42Deployment } from '../components/level-42-deployment/data/content';
import { level49FeatureFlags } from '../components/level-49-feature-flags/data/content';
import { level41Middleware } from './level-41-middleware';
import { level43RateLimiting } from './level-43-rate-limiting';
import { level44SoftDeletes } from './level-44-soft-deletes';
import { level45SafeMigrations } from './level-45-safe-migrations';
import { level46RecurringJobs } from './level-46-recurring-jobs';
import { level47DataLifecycle } from './level-47-data-lifecycle';
import { level48ErrorMonitoring } from './level-48-error-monitoring';

export const actSix: Act = {
	id: 6,
	name: 'Operations',
	tagline: 'Ship it. Run it. Keep it alive.',
	description:
		'The app is feature-complete. Now put it in production and keep it there: middleware, deployment with Kamal, rate limiting, soft deletes, safe migrations, recurring jobs, data lifecycle, and structured error monitoring.',
	levels: [
		level41Middleware,
		level42Deployment,
		level43RateLimiting,
		level44SoftDeletes,
		level45SafeMigrations,
		level46RecurringJobs,
		level47DataLifecycle,
		level48ErrorMonitoring,
		level49FeatureFlags,
	],
	unlockedNodes: ['middleware', 'rate_limiter', 'audit_trail', 'recurring_job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
