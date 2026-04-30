import type { Act } from '@/types';
import { level49Deployment } from '../components/level-49-deployment/data/content';
import { level50FeatureFlags } from '../components/level-50-feature-flags/data/content';
import { level41Middleware } from './level-41-middleware';
import { level42RateLimiting } from './level-42-rate-limiting';
import { level43SoftDeletes } from './level-43-soft-deletes';
import { level44SafeMigrations } from './level-44-safe-migrations';
import { level45RecurringJobs } from './level-45-recurring-jobs';
import { level46DataLifecycle } from './level-46-data-lifecycle';
import { level47ErrorMonitoring } from './level-47-error-monitoring';
import { level48Observability } from './level-48-observability';

export const actSix: Act = {
	id: 6,
	name: 'Operations',
	tagline: 'Ship it. Run it. Keep it alive.',
	description:
		'The app is feature-complete. Build the production concerns first, then put it in production: middleware, rate limiting, soft deletes, safe migrations, recurring jobs, data lifecycle, structured error monitoring, observability, deployment with Kamal, and feature flags for safe rollouts.',
	levels: [
		level41Middleware,
		level42RateLimiting,
		level43SoftDeletes,
		level44SafeMigrations,
		level45RecurringJobs,
		level46DataLifecycle,
		level47ErrorMonitoring,
		level48Observability,
		level49Deployment,
		level50FeatureFlags,
	],
	unlockedNodes: ['middleware', 'rate_limiter', 'audit_trail', 'recurring_job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
