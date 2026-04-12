/**
 * Pre-built production architecture layout.
 * Defines the nodes and edges for the sandbox simulation.
 */

import type { Edge, Node } from '@xyflow/react';

export interface SandboxNodeData extends Record<string, unknown> {
	label: string;
	description: string;
	color: string;
	icon: string;
	/** Live metrics updated by the simulation */
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
	/** Visual state set by simulation */
	status?: 'idle' | 'active' | 'warning' | 'error';
}

export type SandboxNode = Node<SandboxNodeData>;
export type SandboxEdge = Edge<{ animated?: boolean; throughput?: number }>;

export const INITIAL_NODES: SandboxNode[] = [
	// Traffic source
	{
		id: 'users',
		type: 'sandbox',
		position: { x: 0, y: 200 },
		data: {
			label: 'Users',
			description: 'Traffic source',
			color: '#3b82f6',
			icon: 'US',
			status: 'idle',
		},
	},
	// Edge layer
	{
		id: 'cdn',
		type: 'sandbox',
		position: { x: 220, y: 80 },
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
		position: { x: 220, y: 320 },
		data: {
			label: 'Rate Limiter',
			description: 'Per-IP throttling',
			color: '#f97316',
			icon: 'RL',
			status: 'idle',
		},
	},
	// Load balancer
	{
		id: 'lb',
		type: 'sandbox',
		position: { x: 440, y: 200 },
		data: {
			label: 'Load Balancer',
			description: 'Round-robin distribution',
			color: '#a78bfa',
			icon: 'LB',
			status: 'idle',
		},
	},
	// App servers
	{
		id: 'app-1',
		type: 'sandbox',
		position: { x: 680, y: 100 },
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
		position: { x: 680, y: 320 },
		data: {
			label: 'App Server 2',
			description: 'Puma (5 threads)',
			color: '#10b981',
			icon: 'A2',
			status: 'idle',
		},
	},
	// Data layer
	{
		id: 'cache',
		type: 'sandbox',
		position: { x: 940, y: 80 },
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
		position: { x: 940, y: 240 },
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
		position: { x: 940, y: 400 },
		data: {
			label: 'DB Replica',
			description: 'Read replica',
			color: '#f87171',
			icon: 'RD',
			status: 'idle',
		},
	},
	// Async layer
	{
		id: 'queue',
		type: 'sandbox',
		position: { x: 680, y: 500 },
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
		position: { x: 940, y: 560 },
		data: {
			label: 'Stripe API',
			description: 'Payment processing',
			color: '#f59e0b',
			icon: 'ST',
			status: 'idle',
		},
	},
];

export const INITIAL_EDGES: SandboxEdge[] = [
	// User -> CDN, Rate Limiter
	{ id: 'e-users-cdn', source: 'users', target: 'cdn', animated: true },
	{
		id: 'e-users-rl',
		source: 'users',
		target: 'rate-limiter',
		animated: true,
	},
	// CDN -> LB
	{ id: 'e-cdn-lb', source: 'cdn', target: 'lb', animated: true },
	// Rate Limiter -> LB
	{ id: 'e-rl-lb', source: 'rate-limiter', target: 'lb', animated: true },
	// LB -> App Servers
	{ id: 'e-lb-app1', source: 'lb', target: 'app-1', animated: true },
	{ id: 'e-lb-app2', source: 'lb', target: 'app-2', animated: true },
	// App Servers -> Cache
	{ id: 'e-app1-cache', source: 'app-1', target: 'cache' },
	{ id: 'e-app2-cache', source: 'app-2', target: 'cache' },
	// App Servers -> DB Primary
	{ id: 'e-app1-db', source: 'app-1', target: 'db-primary' },
	{ id: 'e-app2-db', source: 'app-2', target: 'db-primary' },
	// DB Primary -> Replica
	{
		id: 'e-db-replica',
		source: 'db-primary',
		target: 'db-replica',
		label: 'replication',
	},
	// App Servers -> Queue
	{ id: 'e-app1-queue', source: 'app-1', target: 'queue' },
	{ id: 'e-app2-queue', source: 'app-2', target: 'queue' },
	// Queue -> Stripe
	{ id: 'e-queue-stripe', source: 'queue', target: 'stripe' },
	// Queue -> DB (job results)
	{ id: 'e-queue-db', source: 'queue', target: 'db-primary' },
];
