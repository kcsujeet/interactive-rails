import type { Act } from '@/types';
import { level16ServiceObjects } from './level-16-service-objects';
import { level17Concerns } from './level-17-concerns';
import { level18ValidationContracts } from './level-18-validation-contracts';
import { level19QueryObjects } from './level-19-query-objects';
import { level20ErrorHandling } from './level-20-error-handling';
import { level21ActionMailer } from './level-21-action-mailer';
import { level22BackgroundJobs } from './level-22-background-jobs';

export const actThree: Act = {
	id: 3,
	name: 'Clean Architecture',
	tagline: 'Features are piling up. The codebase is getting messy.',
	description:
		'Your API works and it is secure, but the controllers are doing too much and the code is hard to change. Extract service objects, concerns, validation contracts, query objects, mailers, error handling, and background jobs to keep things maintainable.',
	levels: [
		level16ServiceObjects,
		level17Concerns,
		level18ValidationContracts,
		level19QueryObjects,
		level20ErrorHandling,
		level21ActionMailer,
		level22BackgroundJobs,
	],
	unlockedNodes: [
		'service',
		'concern',
		'form_object',
		'query_object',
		'mailer',
		'job',
	],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate'],
};
