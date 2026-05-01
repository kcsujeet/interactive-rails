import type { Act } from '@/types';
import { level49Deployment } from '../components/level-49-deployment/data/content';
import { level50FeatureFlags } from '../components/level-50-feature-flags/data/content';
import { level40Middleware } from './level-40-middleware';
import { level41CORS } from './level-41-cors';
import { level42RateLimiting } from './level-42-rate-limiting';
import { level43SafeMigrations } from './level-43-safe-migrations';
import { level44RecurringJobs } from './level-44-recurring-jobs';
import { level45DataLifecycle } from './level-45-data-lifecycle';
import { level46ErrorMonitoring } from './level-46-error-monitoring';
import { level47Observability } from './level-47-observability';
import { level48APIVersioning } from './level-48-api-versioning';

export const actSix: Act = {
	id: 6,
	name: 'Operations',
	tagline: 'Ship it. Run it. Keep it alive.',
	description:
		'The app is feature-complete. Build the production concerns first, then put it in production: middleware, CORS, rate limiting, safe migrations, recurring jobs, data lifecycle, structured error monitoring, observability, API versioning, deployment with Kamal, and feature flags for safe rollouts.',
	levels: [
		level40Middleware,
		level41CORS,
		level42RateLimiting,
		level43SafeMigrations,
		level44RecurringJobs,
		level45DataLifecycle,
		level46ErrorMonitoring,
		level47Observability,
		level48APIVersioning,
		level49Deployment,
		level50FeatureFlags,
	],
	unlockedNodes: ['middleware', 'rate_limiter', 'audit_trail', 'recurring_job'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
