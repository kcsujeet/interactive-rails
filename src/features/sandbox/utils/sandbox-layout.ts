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
	// Col 2: CDN (first layer, serves static assets at edge)
	{
		id: 'cdn',
		type: 'sandbox',
		position: { x: 250, y: 220 },
		data: {
			label: 'CDN',
			description: 'Cloudflare edge cache',
			color: '#06b6d4',
			icon: 'CD',
			status: 'idle',
		},
	},
	// Col 3: Rate Limiter (after CDN, before LB)
	{
		id: 'rate-limiter',
		type: 'sandbox',
		position: { x: 500, y: 220 },
		data: {
			label: 'Rate Limiter',
			description: 'rack-attack, per-IP throttling',
			color: '#f97316',
			icon: 'RL',
			status: 'idle',
		},
	},
	// Col 4: Load Balancer
	{
		id: 'lb',
		type: 'sandbox',
		position: { x: 750, y: 220 },
		data: {
			label: 'Load Balancer',
			description: 'Round-robin distribution',
			color: '#a78bfa',
			icon: 'LB',
			status: 'idle',
		},
	},
	// Col 5: App Servers (stacked)
	{
		id: 'app-1',
		type: 'sandbox',
		position: { x: 1000, y: 120 },
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
		position: { x: 1000, y: 320 },
		data: {
			label: 'App Server 2',
			description: 'Puma (5 threads)',
			color: '#10b981',
			icon: 'A2',
			status: 'idle',
		},
	},
	// Col 6: Data layer
	{
		id: 'cache',
		type: 'sandbox',
		position: { x: 1300, y: 40 },
		data: {
			label: 'Solid Cache',
			description: 'Rails 8 DB-backed cache',
			color: '#06b6d4',
			icon: 'SC',
			status: 'idle',
		},
	},
	{
		id: 'db-primary',
		type: 'sandbox',
		position: { x: 1300, y: 220 },
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
		position: { x: 1300, y: 400 },
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
		position: { x: 1000, y: 510 },
		data: {
			label: 'Solid Queue',
			description: 'Rails 8 background jobs',
			color: '#8b5cf6',
			icon: 'SQ',
			status: 'idle',
		},
	},
	{
		id: 'stripe',
		type: 'sandbox',
		position: { x: 1300, y: 560 },
		data: {
			label: 'Stripe API',
			description: 'Payment processing',
			color: '#f59e0b',
			icon: 'ST',
			status: 'idle',
		},
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
