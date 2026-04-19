import type { Act } from '@/types';
import { level55APIGateway } from './level-55-api-gateway';
import { level56Sharding } from './level-56-sharding';
import { level57Architect } from './level-57-architect';

export const actEight: Act = {
	id: 8,
	name: 'Mastery',
	tagline: 'You are the architect now.',
	description:
		'The final challenge. Design API gateways, implement database sharding, and architect a complete service extraction using everything you have learned across the preceding levels.',
	levels: [level55APIGateway, level56Sharding, level57Architect],
	unlockedNodes: ['api_gateway', 'shard', 'service_mesh'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
