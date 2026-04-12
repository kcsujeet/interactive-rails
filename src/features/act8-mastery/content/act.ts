import type { Act } from '@/types';
import { level49APIGateway } from './level-54-api-gateway';
import { level50Sharding } from './level-55-sharding';
import { level51Architect } from './level-56-architect';

export const actEight: Act = {
	id: 8,
	name: 'Mastery',
	tagline: 'You are the architect now.',
	description:
		'The final challenge. Design API gateways, implement database sharding, and architect a complete service extraction using everything you have learned across 54 levels.',
	levels: [level49APIGateway, level50Sharding, level51Architect],
	unlockedNodes: ['api_gateway', 'shard', 'service_mesh'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
