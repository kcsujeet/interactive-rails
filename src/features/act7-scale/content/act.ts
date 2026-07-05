import type { Act } from '@/types';
import { level51MultiDatabase } from './level-51-multi-database';
import { level52MultiTenancy } from './level-52-multi-tenancy';
import { level53Sharding } from './level-53-sharding';
import { level54StateMachines } from './level-54-state-machines';
import { level55ModularMonolith } from './level-55-modular-monolith';
import { level56DomainEvents } from './level-56-domain-events';
import { level57APIGateway } from './level-57-api-gateway';
import { level58Architect } from './level-58-architect';

export const actSeven: Act = {
	id: 7,
	name: 'Scale',
	tagline: 'Past one of everything.',
	description:
		'You have shipped a real Rails app. Now scale past your starting limits: past one database, one tenant, one workflow, one codebase, one app. Then prove you can compose what you have learned.',
	levels: [
		level51MultiDatabase,
		level52MultiTenancy,
		level53Sharding,
		level54StateMachines,
		level55ModularMonolith,
		level56DomainEvents,
		level57APIGateway,
		level58Architect,
	],
	unlockedNodes: [
		'read_replica',
		'shard',
		'tenant',
		'state_machine',
		'event_bus',
		'api_gateway',
		'service_mesh',
	],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
