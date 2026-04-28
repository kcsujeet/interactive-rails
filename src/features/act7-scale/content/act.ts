import type { Act } from '@/types';
import { level50MultiDatabase } from './level-50-multi-database';
import { level51StateMachines } from './level-51-state-machines';
import { level52MultiTenancy } from './level-52-multi-tenancy';
import { level53Observability } from './level-53-observability';
import { level54ModularMonolith } from './level-54-modular-monolith';
import { level55DomainEvents } from './level-55-domain-events';

export const actSeven: Act = {
	id: 7,
	name: 'Scale',
	tagline: 'The old tricks are not enough anymore.',
	description:
		'Your optimizations from Act 4 carried you this far, but traffic has outgrown a single database. Introduce read replicas, state machines, multi-tenancy, observability, modular architecture, and domain events.',
	levels: [
		level50MultiDatabase,
		level51StateMachines,
		level52MultiTenancy,
		level53Observability,
		level54ModularMonolith,
		level55DomainEvents,
	],
	unlockedNodes: ['read_replica', 'state_machine', 'tenant', 'event_bus'],
	metricsVisible: true,
	visibleMetrics: ['latency', 'errorRate', 'queryCount', 'memoryUsage'],
};
