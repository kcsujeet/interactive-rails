import type { Act } from '@/types';
import { level15Callbacks } from '../components/level-15-callbacks/data/content';
import { level16ServiceObjects } from './level-16-service-objects';
import { level17Concerns } from './level-17-concerns';
import { level18ValidationContracts } from './level-18-validation-contracts';
import { level19QueryObjects } from './level-19-query-objects';
import { level20ErrorHandling } from './level-20-error-handling';

export const actThree: Act = {
	id: 3,
	name: 'Clean Architecture',
	tagline: 'Features are piling up. The codebase is getting messy.',
	description:
		'Your API works and it is secure, but the controllers are doing too much and the code is hard to change. Stop hiding side effects in lifecycle callbacks. Extract service objects, concerns, validation contracts, query objects, and explicit error handling to keep things maintainable.',
	levels: [
		level15Callbacks,
		level16ServiceObjects,
		level17Concerns,
		level18ValidationContracts,
		level19QueryObjects,
		level20ErrorHandling,
	],
	unlockedNodes: ['service', 'concern', 'form_object', 'query_object'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate'],
};
