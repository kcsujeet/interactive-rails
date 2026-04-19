import type { Act } from '@/types';
import { level49MultiDatabase } from './level-49-multi-database';
import { level50StateMachines } from './level-50-state-machines';
import { level51MultiTenancy } from './level-51-multi-tenancy';
import { level52Observability } from './level-52-observability';
import { level53ModularMonolith } from './level-53-modular-monolith';
import { level54DomainEvents } from './level-54-domain-events';

export const actSeven: Act = {
	id: 7,
	name: 'Scale',
	tagline: 'The old tricks are not enough anymore.',
	description:
		'Your optimizations from Act 4 carried you this far, but traffic has outgrown a single database. Introduce read replicas, state machines, multi-tenancy, observability, modular architecture, and domain events.',
	levels: [
		level49MultiDatabase,
		level50StateMachines,
		level51MultiTenancy,
		level52Observability,
		level53ModularMonolith,
		level54DomainEvents,
	],
	unlockedNodes: ['read_replica', 'state_machine', 'tenant', 'event_bus'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
