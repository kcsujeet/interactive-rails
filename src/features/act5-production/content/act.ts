import type { Act } from '@/types';
import { level32Polymorphic } from './level-32-polymorphic';
import { level33Transactions } from './level-33-transactions';
import { level34Locking } from './level-34-locking';
import { level35ActiveStorage } from './level-35-active-storage';
import { level36Encryption } from './level-36-encryption';
import { level37Realtime } from './level-37-realtime';
import { level38ExternalAPIs } from './level-38-external-apis';
import { level39Webhooks } from './level-39-webhooks';
import { level40APIVersioning } from './level-40-api-versioning';

export const actFive: Act = {
	id: 5,
	name: 'Advanced Features',
	tagline: 'Beyond CRUD: the features Rails apps reach for when they grow up.',
	description:
		'The API is fast and clean. Now layer in the advanced Rails features: polymorphic associations, transactions, locking, file uploads, encryption, real-time notifications, external API integrations, webhooks, and API versioning.',
	levels: [
		level32Polymorphic,
		level33Transactions,
		level34Locking,
		level35ActiveStorage,
		level36Encryption,
		level37Realtime,
		level38ExternalAPIs,
		level39Webhooks,
		level40APIVersioning,
	],
	unlockedNodes: ['circuit_breaker', 's3'],
	metricsVisible: true,
};
