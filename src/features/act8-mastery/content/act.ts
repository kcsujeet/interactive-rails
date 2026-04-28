import type { Act } from '@/types';
import { level56APIGateway } from './level-56-api-gateway';
import { level57Sharding } from './level-57-sharding';
import { level58Architect } from './level-58-architect';

export const actEight: Act = {
	id: 8,
	name: 'Mastery',
	tagline: 'You are the architect now.',
	description:
		'The final challenge. Design API gateways, implement database sharding, and architect a complete service extraction using everything you have learned across the preceding levels.',
	levels: [level56APIGateway, level57Sharding, level58Architect],
	unlockedNodes: ['api_gateway', 'shard', 'service_mesh'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
