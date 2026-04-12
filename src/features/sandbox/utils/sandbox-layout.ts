/**
 * Pre-built production architecture layout.
 *
 * Real-world request flow:
 * Users → CDN → Rate Limiter → Load Balancer → App Servers
 *   App Servers → Solid Cache (cached reads)
 *   App Servers → DB Primary (writes + cache misses)
 *   App Servers → Solid Queue (enqueue async jobs)
 *   DB Primary → DB Replica (automatic replication)
 *   Solid Queue → Stripe API (async payment processing)
 *   Solid Queue → DB Primary (write job results)
 *
 * Layout columns:
 * Col 1 (x:0-750)    Linear: Users, CDN, Rate Limiter, LB
 * Col 2 (x:1050)     App Servers (stacked)
 * Col 3 (x:1380)     Shared resources: Cache, DB Primary, Solid Queue
 * Col 4 (x:1700)     External: DB Replica, Stripe API
 */

import type { Edge, Node } from '@xyflow/react';
import { getNodeStyle } from '@/lib/node-styles';

/** Helper to create node data from the shared style registry */
function nodeData(
	label: string,
	overrides?: Partial<SandboxNodeData>,
): SandboxNodeData {
	const style = getNodeStyle(label);
	return {
		label,
		description: style.description,
		color: style.color,
		icon: style.icon,
		status: 'idle' as const,
		...overrides,
	};
}

export interface SandboxNodeData extends Record<string, unknown> {
	label: string;
	description: string;
	color: string;
	icon: string;
	metrics?: {
		reqPerSec?: number;
		latency?: number;
		hitRate?: number;
		queueDepth?: number;
		threadsBusy?: number;
		threadsTotal?: number;
		queryCount?: number;
		blockedCount?: number;
		errorRate?: number;
	};
	status?: 'idle' | 'active' | 'warning' | 'error' | 'critical';
}

export type SandboxNode = Node<SandboxNodeData>;
export type SandboxEdge = Edge<Record<string, unknown>>;

export const INITIAL_NODES: SandboxNode[] = [
	// Col 1: Linear entry flow (y=250 center)
	{ id: 'users', type: 'sandbox', position: { x: 0, y: 250 }, data: nodeData('Users') },
	{ id: 'cdn', type: 'sandbox', position: { x: 250, y: 250 }, data: nodeData('CDN') },
	{ id: 'rate-limiter', type: 'sandbox', position: { x: 500, y: 250 }, data: nodeData('Rate Limiter') },
	{ id: 'lb', type: 'sandbox', position: { x: 750, y: 250 }, data: nodeData('Load Balancer') },
	// Col 2: App Servers (stacked, centered on shared resources)
	{ id: 'app-1', type: 'sandbox', position: { x: 1050, y: 130 }, data: nodeData('App Server', { label: 'App Server 1', icon: 'A1' }) },
	{ id: 'app-2', type: 'sandbox', position: { x: 1050, y: 370 }, data: nodeData('App Server', { label: 'App Server 2', icon: 'A2' }) },
	// Col 3: Shared resources (stacked vertically between app servers)
	{ id: 'cache', type: 'sandbox', position: { x: 1380, y: 50 }, data: nodeData('Solid Cache') },
	{ id: 'db-primary', type: 'sandbox', position: { x: 1380, y: 240 }, data: nodeData('Database', { description: 'PostgreSQL (primary)' }) },
	{ id: 'queue', type: 'sandbox', position: { x: 1380, y: 430 }, data: nodeData('Solid Queue') },
	// Col 4: External (to the right of what they replicate from / process for)
	{ id: 'db-replica', type: 'sandbox', position: { x: 1700, y: 240 }, data: nodeData('DB Replica') },
	{ id: 'stripe', type: 'sandbox', position: { x: 1700, y: 430 }, data: nodeData('Stripe API') },
];

export const INITIAL_EDGES: SandboxEdge[] = [
	// Linear entry: Users -> CDN -> Rate Limiter -> LB
	{ id: 'e-users-cdn', source: 'users', target: 'cdn' },
	{ id: 'e-cdn-rl', source: 'cdn', target: 'rate-limiter' },
	{ id: 'e-rl-lb', source: 'rate-limiter', target: 'lb' },
	// LB distributes to both app servers
	{ id: 'e-lb-app1', source: 'lb', target: 'app-1' },
	{ id: 'e-lb-app2', source: 'lb', target: 'app-2' },
	// Both app servers -> shared resources (cache, DB, queue)
	{ id: 'e-app1-cache', source: 'app-1', target: 'cache' },
	{ id: 'e-app1-db', source: 'app-1', target: 'db-primary' },
	{ id: 'e-app1-queue', source: 'app-1', target: 'queue' },
	{ id: 'e-app2-cache', source: 'app-2', target: 'cache' },
	{ id: 'e-app2-db', source: 'app-2', target: 'db-primary' },
	{ id: 'e-app2-queue', source: 'app-2', target: 'queue' },
	// DB replication (automatic, not app traffic)
	{ id: 'e-db-replica', source: 'db-primary', target: 'db-replica' },
	// Solid Queue -> Stripe (async payment processing via background jobs)
	{ id: 'e-queue-stripe', source: 'queue', target: 'stripe' },
];
