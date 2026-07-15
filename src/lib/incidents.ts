/**
 * Incident generation for the pipeline simulation.
 *
 * Pure, React-free helpers used by the simulation engine
 * (usePipelineSimulation). Extracted from the former IncidentFeed
 * component when the app went fully client-side; the visual feed
 * component was unused, but these generators drive the live metrics.
 */

import type { Incident, IncidentType } from '@/types/game';

let incidentIdCounter = 0;

export function generateIncidentId(): string {
	return `incident-${Date.now()}-${incidentIdCounter++}`;
}

export function createIncident(
	type: IncidentType,
	message: string,
	severity: Incident['severity'] = 'info',
	nodeIds?: string[],
): Incident {
	return {
		id: generateIncidentId(),
		timestamp: Date.now(),
		type,
		message,
		severity,
		nodeIds,
	};
}

// Pre-defined incident messages for simulation
export const INCIDENT_MESSAGES: Record<IncidentType, string[]> = {
	n_plus_one_detected: [
		'N+1 query detected: Product.find each triggers User.find',
		'N+1 pattern: Loading reviews individually for each product',
		'Detected 50 individual queries for associated records',
	],
	slow_query: [
		'Slow query: SELECT * FROM users took 2340ms',
		'Query exceeded threshold: full table scan on posts (1823ms)',
		'Slow query alert: complex JOIN took 5200ms',
	],
	cache_miss: [
		'Cache miss: homepage_posts (regenerating)',
		'Cache expired: user_profile_42',
		'Cache miss ratio exceeded 80% in last minute',
	],
	high_memory: [
		'Memory pressure: 85% utilization',
		'Memory spike: eager loading 10k records',
		'GC pause: 150ms due to memory pressure',
	],
	error_spike: [
		'Error rate spiked to 12% in last 30s',
		'ActiveRecord::RecordNotFound surge',
		'Timeout errors increasing: 23 in last minute',
	],
	timeout: [
		'Request timeout: /api/reports (30s limit)',
		'Database connection timeout',
		'External API timeout: payment_service',
	],
	rate_limit: [
		'Rate limit exceeded for IP 192.168.1.100',
		'API rate limit: 1000 req/min exceeded',
		'Throttling requests from user_id=42',
	],
	connection_blocked: [
		'Connection blocked: View cannot connect to Database directly',
		'Invalid connection attempt: Controller -> Cache (use Model)',
		'Blocked: direct database access from view layer',
	],
	deadlock: [
		'Deadlock detected: transactions waiting on each other',
		'Database deadlock: rolling back transaction',
		'Lock timeout: could not acquire advisory lock',
	],
	circuit_open: [
		'Circuit breaker open: payment_service',
		'Circuit tripped: 5 failures in 10s',
		'External service degraded: using fallback',
	],
};

export function generateRandomIncident(nodeIds?: string[]): Incident {
	const types = Object.keys(INCIDENT_MESSAGES) as IncidentType[];
	const type = types[Math.floor(Math.random() * types.length)];
	const messages = INCIDENT_MESSAGES[type];
	const message = messages[Math.floor(Math.random() * messages.length)];

	let severity: Incident['severity'] = 'info';
	if (['n_plus_one_detected', 'error_spike', 'deadlock'].includes(type)) {
		severity = 'error';
	} else if (
		['slow_query', 'high_memory', 'timeout', 'circuit_open'].includes(type)
	) {
		severity = 'warning';
	} else if (['cache_miss', 'rate_limit'].includes(type)) {
		severity = 'info';
	}

	if (Math.random() < 0.05 && severity === 'error') {
		severity = 'critical';
	}

	return createIncident(type, message, severity, nodeIds);
}
