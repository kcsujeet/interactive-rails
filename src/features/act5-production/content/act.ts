import type { Act } from '@/types';
import { level30Polymorphic } from './level-30-polymorphic';
import { level31SoftDeletes } from './level-31-soft-deletes';
import { level32Transactions } from './level-32-transactions';
import { level33Locking } from './level-33-locking';
import { level34ActiveStorage } from './level-34-active-storage';
import { level35ActionMailer } from './level-35-action-mailer';
import { level36BackgroundJobs } from './level-36-background-jobs';
import { level37Realtime } from './level-37-realtime';
import { level38ExternalAPIs } from './level-38-external-apis';
import { level39Webhooks } from './level-39-webhooks';

export const actFive: Act = {
	id: 5,
	name: 'Advanced Features',
	tagline: 'Beyond CRUD: the features Rails apps reach for when they grow up.',
	description:
		'The API is fast and clean. Now layer in the advanced Rails features: polymorphic associations, soft deletes, transactions, locking, file uploads, mailers, background jobs, real-time notifications, external API integrations, and webhooks.',
	levels: [
		level30Polymorphic,
		level31SoftDeletes,
		level32Transactions,
		level33Locking,
		level34ActiveStorage,
		level35ActionMailer,
		level36BackgroundJobs,
		level37Realtime,
		level38ExternalAPIs,
		level39Webhooks,
	],
	unlockedNodes: ['circuit_breaker', 's3', 'mailer', 'job'],
	metricsVisible: true,
};
