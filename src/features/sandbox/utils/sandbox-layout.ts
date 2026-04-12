/**
 * Pre-built production architecture layout.
 * Defines the nodes and edges for the sandbox simulation.
 *
 * Layout is organized in columns left-to-right:
 * Col 1 (x:0)   - Users
 * Col 2 (x:250) - CDN, Rate Limiter
 * Col 3 (x:500) - Load Balancer
 * Col 4 (x:750) - App Servers
 * Col 5 (x:1050)- Cache, DB, Replica
 * Col 6 (x:1050)- Queue (below apps), Stripe (far right)
 */

import type { Edge, Node } from '@xyflow/react';

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
	// Col 1: Traffic source
	{
		id: 'users',
		type: 'sandbox',
		position: { x: 0, y: 220 },
		data: {
			label: 'Users',
			description: 'Traffic source',
			color: '#3b82f6',
			icon: 'US',
			status: 'idle',
		},
	},
	// Col 2: Edge layer (stacked vertically with spacing)
	{
		id: 'cdn',
		type: 'sandbox',
		position: { x: 250, y: 100 },
		data: {
			label: 'CDN',
			description: 'Static assets, edge cache',
			color: '#06b6d4',
			icon: 'CD',
			status: 'idle',
		},
	},
	{
		id: 'rate-limiter',
		type: 'sandbox',
		position: { x: 250, y: 340 },
		data: {
			label: 'Rate Limiter',
			description: 'Per-IP throttling',
			color: '#f97316',
			icon: 'RL',
			status: 'idle',
		},
	},
	// Col 3: Load balancer (centered)
	{
		id: 'lb',
		type: 'sandbox',
		position: { x: 500, y: 220 },
		data: {
			label: 'Load Balancer',
			description: 'Round-robin distribution',
			color: '#a78bfa',
			icon: 'LB',
			status: 'idle',
		},
	},
	// Col 4: App servers (stacked)
	{
		id: 'app-1',
		type: 'sandbox',
		position: { x: 750, y: 140 },
		data: {
			label: 'App Server 1',
			description: 'Puma (5 threads)',
			color: '#10b981',
			icon: 'A1',
			status: 'idle',
		},
	},
	{
		id: 'app-2',
		type: 'sandbox',
		position: { x: 750, y: 310 },
		data: {
			label: 'App Server 2',
			description: 'Puma (5 threads)',
			color: '#10b981',
			icon: 'A2',
			status: 'idle',
		},
	},
	// Col 5: Data layer (stacked vertically, well spaced)
	{
		id: 'cache',
		type: 'sandbox',
		position: { x: 1050, y: 60 },
		data: {
			label: 'Cache (Redis)',
			description: 'Key-value store',
			color: '#06b6d4',
			icon: 'CA',
			status: 'idle',
		},
	},
	{
		id: 'db-primary',
		type: 'sandbox',
		position: { x: 1050, y: 220 },
		data: {
			label: 'Database',
			description: 'PostgreSQL (primary)',
			color: '#ef4444',
			icon: 'DB',
			status: 'idle',
		},
	},
	{
		id: 'db-replica',
		type: 'sandbox',
		position: { x: 1050, y: 380 },
		data: {
			label: 'DB Replica',
			description: 'Read replica',
			color: '#f87171',
			icon: 'RD',
			status: 'idle',
		},
	},
	// Below apps: async layer
	{
		id: 'queue',
		type: 'sandbox',
		position: { x: 750, y: 490 },
		data: {
			label: 'Solid Queue',
			description: 'Background jobs',
			color: '#8b5cf6',
			icon: 'SQ',
			status: 'idle',
		},
	},
	{
		id: 'stripe',
		type: 'sandbox',
		position: { x: 1050, y: 540 },
		data: {
			label: 'Stripe API',
			description: 'Payment processing',
			color: '#f59e0b',
			icon: 'ST',
			status: 'idle',
		},
	},
];

// Edges start with animated: false. Simulation toggles them on.
export const INITIAL_EDGES: SandboxEdge[] = [
	// Users -> edge layer
	{ id: 'e-users-cdn', source: 'users', target: 'cdn' },
	{ id: 'e-users-rl', source: 'users', target: 'rate-limiter' },
	// Edge layer -> LB
	{ id: 'e-cdn-lb', source: 'cdn', target: 'lb' },
	{ id: 'e-rl-lb', source: 'rate-limiter', target: 'lb' },
	// LB -> App Servers
	{ id: 'e-lb-app1', source: 'lb', target: 'app-1' },
	{ id: 'e-lb-app2', source: 'lb', target: 'app-2' },
	// App Servers -> Cache (only app1 goes to cache to reduce crossing)
	{ id: 'e-app1-cache', source: 'app-1', target: 'cache' },
	{ id: 'e-app2-cache', source: 'app-2', target: 'cache' },
	// App Servers -> DB Primary
	{ id: 'e-app1-db', source: 'app-1', target: 'db-primary' },
	{ id: 'e-app2-db', source: 'app-2', target: 'db-primary' },
	// DB Primary -> Replica
	{ id: 'e-db-replica', source: 'db-primary', target: 'db-replica' },
	// App -> Queue (only app2 to reduce crossing)
	{ id: 'e-app2-queue', source: 'app-2', target: 'queue' },
	// Queue -> Stripe
	{ id: 'e-queue-stripe', source: 'queue', target: 'stripe' },
	// Queue -> DB
	{ id: 'e-queue-db', source: 'queue', target: 'db-primary' },
];
