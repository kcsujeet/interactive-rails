import type { Act } from '@/types';
import { level48MultiDatabase } from './level-48-multi-database';
import { level49StateMachines } from './level-49-state-machines';
import { level50MultiTenancy } from './level-50-multi-tenancy';
import { level51Observability } from './level-51-observability';
import { level52ModularMonolith } from './level-52-modular-monolith';
import { level53DomainEvents } from './level-53-domain-events';

export const actSeven: Act = {
	id: 7,
	name: 'Scale',
	tagline: 'The old tricks are not enough anymore.',
	description:
		'Your optimizations from Act 4 carried you this far, but traffic has outgrown a single database. Introduce read replicas, state machines, multi-tenancy, observability, modular architecture, and domain events.',
	levels: [
		level48MultiDatabase,
		level49StateMachines,
		level50MultiTenancy,
		level51Observability,
		level52ModularMonolith,
		level53DomainEvents,
	],
	unlockedNodes: ['read_replica', 'state_machine', 'tenant', 'event_bus'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
