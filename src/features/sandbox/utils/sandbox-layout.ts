/**
 * Pre-built production architecture layout.
 *
 * Real-world request flow:
 * Users -> CDN -> Rate Limiter -> Load Balancer -> App Servers -> Solid Cache / DB
 *
 * Layout columns (left to right):
 * Col 1 (x:0)    Users
 * Col 2 (x:250)  CDN
 * Col 3 (x:500)  Rate Limiter
 * Col 4 (x:750)  Load Balancer
 * Col 5 (x:1000) App Servers
 * Col 6 (x:1300) Solid Cache, DB Primary, DB Replica
 * Below apps:     Solid Queue, Stripe API
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
	status?: 'idle' | 'active' | 'warning' | 'error';
}

export type SandboxNode = Node<SandboxNodeData>;
export type SandboxEdge = Edge<Record<string, unknown>>;

export const INITIAL_NODES: SandboxNode[] = [
	{
		id: 'users',
		type: 'sandbox',
		position: { x: 0, y: 220 },
		data: nodeData('Users'),
	},
	{
		id: 'cdn',
		type: 'sandbox',
		position: { x: 250, y: 220 },
		data: nodeData('CDN'),
	},
	{
		id: 'rate-limiter',
		type: 'sandbox',
		position: { x: 500, y: 220 },
		data: nodeData('Rate Limiter'),
	},
	{
		id: 'lb',
		type: 'sandbox',
		position: { x: 750, y: 220 },
		data: nodeData('Load Balancer'),
	},
	{
		id: 'app-1',
		type: 'sandbox',
		position: { x: 1000, y: 120 },
		data: nodeData('App Server', { label: 'App Server 1', icon: 'A1' }),
	},
	{
		id: 'app-2',
		type: 'sandbox',
		position: { x: 1000, y: 320 },
		data: nodeData('App Server', { label: 'App Server 2', icon: 'A2' }),
	},
	{
		id: 'cache',
		type: 'sandbox',
		position: { x: 1300, y: 40 },
		data: nodeData('Solid Cache'),
	},
	{
		id: 'db-primary',
		type: 'sandbox',
		position: { x: 1300, y: 220 },
		data: nodeData('Database', { description: 'PostgreSQL (primary)' }),
	},
	{
		id: 'db-replica',
		type: 'sandbox',
		position: { x: 1300, y: 400 },
		data: nodeData('DB Replica'),
	},
	{
		id: 'queue',
		type: 'sandbox',
		position: { x: 1000, y: 510 },
		data: nodeData('Solid Queue'),
	},
	{
		id: 'stripe',
		type: 'sandbox',
		position: { x: 1300, y: 560 },
		data: nodeData('Stripe API'),
	},
];

// Edges: animated defaults to false, toggled by simulation
// Flow: Users -> CDN -> Rate Limiter -> LB -> App Servers -> Cache/DB
export const INITIAL_EDGES: SandboxEdge[] = [
	// Linear flow: Users -> CDN -> Rate Limiter -> LB
	{ id: 'e-users-cdn', source: 'users', target: 'cdn' },
	{ id: 'e-cdn-rl', source: 'cdn', target: 'rate-limiter' },
	{ id: 'e-rl-lb', source: 'rate-limiter', target: 'lb' },
	// LB -> App Servers
	{ id: 'e-lb-app1', source: 'lb', target: 'app-1' },
	{ id: 'e-lb-app2', source: 'lb', target: 'app-2' },
	// App Servers -> Solid Cache
	{ id: 'e-app1-cache', source: 'app-1', target: 'cache' },
	{ id: 'e-app2-cache', source: 'app-2', target: 'cache' },
	// App Servers -> DB Primary
	{ id: 'e-app1-db', source: 'app-1', target: 'db-primary' },
	{ id: 'e-app2-db', source: 'app-2', target: 'db-primary' },
	// DB Primary -> Replica (replication)
	{ id: 'e-db-replica', source: 'db-primary', target: 'db-replica' },
	// App -> Queue (async jobs)
	{ id: 'e-app2-queue', source: 'app-2', target: 'queue' },
	// Queue -> Stripe (payment processing)
	{ id: 'e-queue-stripe', source: 'queue', target: 'stripe' },
	// Queue -> DB (job results)
	{ id: 'e-queue-db', source: 'queue', target: 'db-primary' },
];
