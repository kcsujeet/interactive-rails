/**
 * Level Data - Node types and challenge definitions
 *
 * This file provides both:
 * 1. Level challenges (legacy format)
 * 2. New Acts/Levels structure (imported from content/acts)
 */

import type { LevelChallenge, NodeTypeInfo } from '@/types/game';
import { isConnectionAllowed, NODE_BEHAVIORS } from './nodeBehavior';

// ============================================
// Node Type Definitions
// ============================================

export const nodeTypes: NodeTypeInfo[] = [
	// Act I - Basics
	{
		type: 'terminal',
		name: 'Terminal',
		color: '#1f2937',
		icon: '$_',
		description: 'Command Line Interface',
	},
	{
		type: 'postgres',
		name: 'Postgres',
		color: '#336791',
		icon: '🐘',
		description: 'PostgreSQL Database',
	},
	{
		type: 'sqlite',
		name: 'SQLite',
		color: '#003b57',
		icon: '🪶',
		description: 'SQLite File Database',
	},
	{
		type: 'request',
		name: 'Request',
		color: '#3b82f6',
		icon: '>',
		description: 'Incoming HTTP request',
	},
	{
		type: 'router',
		name: 'Router',
		color: '#a78bfa',
		icon: 'R',
		description: 'Routes to controller',
	},
	{
		type: 'controller',
		name: 'Controller',
		color: '#10b981',
		icon: 'C',
		description: 'Handles request logic',
	},
	{
		type: 'model',
		name: 'Model',
		color: '#f59e0b',
		icon: 'M',
		description: 'ActiveRecord model',
	},
	{
		type: 'database',
		name: 'Database',
		color: '#ef4444',
		icon: 'D',
		description: 'PostgreSQL database',
	},
	{
		type: 'response',
		name: 'Response',
		color: '#22c55e',
		icon: '<',
		description: 'HTTP response',
	},

	{
		type: 'serializer',
		name: 'Serializer',
		color: '#8b5cf6',
		icon: '{}',
		description: 'JSON Serializer',
	},

	// Act II - Performance
	{
		type: 'eager_load',
		name: 'Eager Load',
		color: '#14b8a6',
		icon: 'E',
		description: 'Batch load associations',
	},
	{
		type: 'index',
		name: 'Index',
		color: '#f97316',
		icon: 'I',
		description: 'Database index',
	},
	{
		type: 'service',
		name: 'Service',
		color: '#8b5cf6',
		icon: 'S',
		description: 'Service object (PORO)',
	},
	{
		type: 'command',
		name: 'Command',
		color: '#7c3aed',
		icon: '!',
		description: 'Atomic command operation',
	},
	{
		type: 'contract',
		name: 'Contract',
		color: '#06b6d4',
		icon: '📋',
		description: 'dry-validation schema',
	},
	{
		type: 'form',
		name: 'Form',
		color: '#14b8a6',
		icon: '📝',
		description: 'Validation contract (multi-model)',
	},
	{
		type: 'component',
		name: 'Component',
		color: '#f472b6',
		icon: '🧩',
		description: 'ViewComponent',
	},
	{
		type: 'batch',
		name: 'Batch',
		color: '#06b6d4',
		icon: 'B',
		description: 'Bulk operations',
	},
	{
		type: 'scope',
		name: 'Scope',
		color: '#84cc16',
		icon: 's',
		description: 'Named query scope',
	},

	// Act III - Scaling
	{
		type: 'cache',
		name: 'Cache',
		color: '#06b6d4',
		icon: '$',
		description: 'Rails.cache',
	},
	{
		type: 'fragment_cache',
		name: 'Fragment Cache',
		color: '#0ea5e9',
		icon: 'f',
		description: 'View fragment caching',
	},
	{
		type: 'http_cache',
		name: 'HTTP Cache',
		color: '#0284c7',
		icon: 'H',
		description: 'ETag/Last-Modified',
	},
	{
		type: 'job_queue',
		name: 'Job Queue',
		color: '#7c3aed',
		icon: 'Q',
		description: 'Background job queue',
	},
	{
		type: 'worker',
		name: 'Worker',
		color: '#9333ea',
		icon: 'W',
		description: 'Sidekiq worker',
	},
	{
		type: 'mailer',
		name: 'Mailer',
		color: '#ec4899',
		icon: '@',
		description: 'ActionMailer',
	},
	{
		type: 'storage',
		name: 'Storage',
		color: '#f472b6',
		icon: '☁️',
		description: 'S3/ActiveStorage',
	},
	{
		type: 'webhook_endpoint',
		name: 'Webhook',
		color: '#10b981',
		icon: '🔔',
		description: 'Incoming webhook endpoint',
	},
	{
		type: 'session',
		name: 'Session',
		color: '#a855f7',
		icon: 'z',
		description: 'Session storage',
	},
	{
		type: 'env',
		name: 'ENV',
		color: '#374151',
		icon: '🔒',
		description: 'Environment Variables',
	},

	// Act IV - Production
	{
		type: 'policy',
		name: 'Policy',
		color: '#dc2626',
		icon: 'P',
		description: 'Authorization policy',
	},
	{
		type: 'rate_limiter',
		name: 'Rate Limiter',
		color: '#ea580c',
		icon: '#',
		description: 'Rate limiting',
	},
	{
		type: 'circuit_breaker',
		name: 'Circuit Breaker',
		color: '#d97706',
		icon: '!',
		description: 'Fault tolerance',
	},
	{
		type: 'optimistic_lock',
		name: 'Optimistic Lock',
		color: '#ca8a04',
		icon: 'o',
		description: 'Optimistic locking',
	},
	{
		type: 'pessimistic_lock',
		name: 'Pessimistic Lock',
		color: '#a16207',
		icon: 'p',
		description: 'Pessimistic locking',
	},
	{
		type: 'transaction',
		name: 'Transaction',
		color: '#854d0e',
		icon: '🔄',
		description: 'Atomic DB transaction',
	},
	{
		type: 'external_api',
		name: 'External API',
		color: '#059669',
		icon: 'X',
		description: 'External API call',
	},
	{
		type: 'health_check',
		name: 'Health Check',
		color: '#10b981',
		icon: '+',
		description: 'Health endpoint',
	},

	// Act V - Infrastructure
	{
		type: 'redis',
		name: 'Redis',
		color: '#dc2626',
		icon: 'r',
		description: 'Redis server',
	},
	{
		type: 'pubsub',
		name: 'Pub/Sub',
		color: '#f43f5e',
		icon: '~',
		description: 'Redis Pub/Sub',
	},
	{
		type: 'websocket',
		name: 'WebSocket',
		color: '#e11d48',
		icon: 'w',
		description: 'ActionCable',
	},
	{
		type: 'event_bus',
		name: 'Event Bus',
		color: '#be185d',
		icon: 'e',
		description: 'Domain events',
	},

	// Act VI - Platform
	{
		type: 'api_gateway',
		name: 'API Gateway',
		color: '#7c3aed',
		icon: 'G',
		description: 'API gateway',
	},
	{
		type: 'load_balancer',
		name: 'Load Balancer',
		color: '#6366f1',
		icon: 'L',
		description: 'Load balancer',
	},
	{
		type: 'cdn',
		name: 'CDN',
		color: '#4f46e5',
		icon: 'N',
		description: 'Content delivery',
	},
	{
		type: 'elasticsearch',
		name: 'Elasticsearch',
		color: '#fcd34d',
		icon: 'ES',
		description: 'Search engine',
	},
	{
		type: 'logger',
		name: 'Logger',
		color: '#6b7280',
		icon: 'l',
		description: 'Structured logging',
	},
	{
		type: 'metrics_collector',
		name: 'Metrics',
		color: '#4b5563',
		icon: 'm',
		description: 'Metrics collection',
	},
	{
		type: 'tracer',
		name: 'Tracer',
		color: '#374151',
		icon: 't',
		description: 'Distributed tracing',
	},

	// Act III - Additional
	{
		type: 'concern',
		name: 'Concern',
		color: '#818cf8',
		icon: 'Cn',
		description: 'Rails concern module',
	},
	{
		type: 'form_object',
		name: 'Contract',
		color: '#2dd4bf',
		icon: 'VC',
		description: 'Dry::Validation contract',
	},
	{
		type: 'query_object',
		name: 'Query',
		color: '#38bdf8',
		icon: 'Qo',
		description: 'Composable query PORO',
	},
	{
		type: 'error_handler',
		name: 'Error Handler',
		color: '#fb7185',
		icon: 'Eh',
		description: 'Error handling middleware',
	},
	{
		type: 'background_job',
		name: 'Background Job',
		color: '#a78bfa',
		icon: 'BJ',
		description: 'Async background job',
	},
	{
		type: 'counter_cache',
		name: 'Counter Cache',
		color: '#fbbf24',
		icon: 'CC',
		description: 'Cached association count',
	},
	{
		type: 'search',
		name: 'Search',
		color: '#facc15',
		icon: 'Se',
		description: 'Full-text search',
	},

	// Act II - Additional
	{
		type: 'authentication',
		name: 'Authentication',
		color: '#f472b6',
		icon: 'Au',
		description: 'User authentication',
	},
	{
		type: 'validation',
		name: 'Validation',
		color: '#34d399',
		icon: 'Vl',
		description: 'Model validations',
	},
	{
		type: 'callback',
		name: 'Callback',
		color: '#c084fc',
		icon: 'Cb',
		description: 'ActiveRecord callback',
	},
	{
		type: 'cors',
		name: 'CORS',
		color: '#67e8f9',
		icon: 'CO',
		description: 'Cross-origin resource sharing',
	},
	{
		type: 'credentials',
		name: 'Credentials',
		color: '#475569',
		icon: 'Cr',
		description: 'Rails encrypted credentials',
	},
	{
		type: 'test',
		name: 'Test',
		color: '#4ade80',
		icon: 'Te',
		description: 'RSpec/Minitest tests',
	},

	// Act V - Additional
	{
		type: 's3',
		name: 'S3',
		color: '#f97316',
		icon: 'S3',
		description: 'AWS S3 storage',
	},

	// Act VI - Additional
	{
		type: 'middleware',
		name: 'Middleware',
		color: '#94a3b8',
		icon: 'Mw',
		description: 'Rack middleware',
	},
	{
		type: 'soft_delete',
		name: 'Soft Delete',
		color: '#f87171',
		icon: 'SD',
		description: 'Paranoia/Discard soft delete',
	},
	{
		type: 'audit_trail',
		name: 'Audit Trail',
		color: '#a3a3a3',
		icon: 'AT',
		description: 'Change tracking audit log',
	},
	{
		type: 'scheduler',
		name: 'Scheduler',
		color: '#c084fc',
		icon: 'Sc',
		description: 'Recurring job scheduler',
	},
	{
		type: 'error_monitor',
		name: 'Error Monitor',
		color: '#ef4444',
		icon: 'EM',
		description: 'Error tracking service',
	},

	// Act VII - Additional
	{
		type: 'state_machine',
		name: 'State Machine',
		color: '#8b5cf6',
		icon: 'SM',
		description: 'State transitions (AASM)',
	},
	{
		type: 'tenant_scope',
		name: 'Tenant Scope',
		color: '#6366f1',
		icon: 'TS',
		description: 'Multi-tenancy scoping',
	},
	{
		type: 'observability',
		name: 'Observability',
		color: '#64748b',
		icon: 'Ob',
		description: 'Metrics, logs & traces',
	},
	{
		type: 'message_queue',
		name: 'Message Queue',
		color: '#e879f9',
		icon: 'MQ',
		description: 'Async message queue',
	},

	// Act VIII - Additional
	{
		type: 'shard',
		name: 'Shard',
		color: '#b91c1c',
		icon: 'Sh',
		description: 'Database shard',
	},

	// Act VII - Expert
	{
		type: 'read_replica',
		name: 'Read Replica',
		color: '#ef4444',
		icon: 'RR',
		description: 'DB read replica',
	},
	{
		type: 'shard_router',
		name: 'Shard Router',
		color: '#dc2626',
		icon: 'SR',
		description: 'Shard routing',
	},
	{
		type: 'feature_flag',
		name: 'Feature Flag',
		color: '#16a34a',
		icon: 'FF',
		description: 'Feature toggle',
	},
];

// ============================================
// Connection Rules (using node behaviors)
// ============================================

export const validConnections: Record<string, string[]> = {};

// Build validConnections from NODE_BEHAVIORS
for (const [nodeType, behavior] of Object.entries(NODE_BEHAVIORS)) {
	validConnections[nodeType] = behavior.allowedConnections;
}

// ============================================
// Helper Functions
// ============================================

export function getNodeInfo(type: string): NodeTypeInfo {
	return (
		nodeTypes.find((n) => n.type === type) || {
			type,
			name: type,
			color: '#6b7280',
		}
	);
}

export function isValidConnection(
	sourceType: string,
	targetType: string,
): boolean {
	const result = isConnectionAllowed(sourceType, targetType);
	return result.allowed;
}

export function getConnectionError(
	sourceType: string,
	targetType: string,
): string | null {
	const result = isConnectionAllowed(sourceType, targetType);
	return result.allowed ? null : result.reason || 'Invalid connection';
}

// ============================================
// Level Challenges
// ============================================

export const levelChallenges: Record<string, LevelChallenge> = {
	'tutorial-n-plus-one': {
		name: 'N+1 Query Tutorial',
		description: 'Learn to identify and fix the infamous N+1 query problem.',
		concepts: ['N+1 queries', 'Eager loading', 'includes()'],
		scenario:
			'A blog is loading posts with their authors. The current implementation has a serious performance problem.',
		problem: `The code runs 101 queries to display 100 posts:

  # Current broken code:
  @products = Product.all
  @products.each do |product|
    product.user.name  # ← Extra query for EACH product!
  end`,
		goal: 'Reduce the query count from 101 to 2. The database is being hammered - find a way to batch the queries.',
		initialNodes: [
			{ id: 'node-1', type: 'request', x: 120, y: 200 },
			{ id: 'node-2', type: 'router', x: 300, y: 200 },
			{ id: 'node-3', type: 'controller', x: 480, y: 200 },
			{ id: 'node-4', type: 'model', x: 660, y: 200 },
			{ id: 'node-5', type: 'database', x: 660, y: 380 },
			{ id: 'node-6', type: 'serializer', x: 840, y: 200 },
			{ id: 'node-7', type: 'response', x: 1020, y: 200 },
		],
		initialConnections: [
			{ sourceType: 'request', targetType: 'router' },
			{ sourceType: 'router', targetType: 'controller' },
			{ sourceType: 'controller', targetType: 'model' },
			{ sourceType: 'model', targetType: 'database' },
			{ sourceType: 'database', targetType: 'serializer' },
			{ sourceType: 'serializer', targetType: 'response' },
		],
		initialMetrics: {
			queries: 101,
			latency: 2400,
			problem: 'N+1 Query Detected!',
		},
		successCondition: (nodes, connections) => {
			const hasEagerLoad = nodes.some((n) => n.type === 'eager_load');
			const eagerLoadConnected = connections.some((c) => {
				const source = nodes.find((n) => n.id === c.sourceNodeId);
				const target = nodes.find((n) => n.id === c.targetNodeId);
				return source?.type === 'eager_load' || target?.type === 'eager_load';
			});

			if (hasEagerLoad && eagerLoadConnected) {
				return {
					success: true,
					message: 'N+1 fixed! Queries reduced from 101 to 2.',
				};
			}
			return {
				success: false,
				message:
					'Query count is still too high. Think about how to batch multiple queries into one.',
			};
		},
		availableNodes: ['eager_load', 'cache', 'index'],
		solutionNodeType: 'eager_load',
	},
	'tutorial-indexing': {
		name: 'Database Indexing',
		description: 'Speed up slow queries with database indexes.',
		concepts: ['Database indexes', 'Query optimization'],
		scenario:
			"User lookup by email is taking 3 seconds because there's no index.",
		problem: `Without an index, the database scans all 1M rows:

  User.find_by(email: 'test@example.com')
  # Scans 1,000,000 rows = 3000ms`,
		goal: 'Reduce query latency from 3000ms to under 50ms. The database is scanning too many rows.',
		initialNodes: [
			{ id: 'node-1', type: 'request', x: 120, y: 200 },
			{ id: 'node-2', type: 'router', x: 300, y: 200 },
			{ id: 'node-3', type: 'controller', x: 480, y: 200 },
			{ id: 'node-4', type: 'model', x: 660, y: 200 },
			{ id: 'node-5', type: 'database', x: 660, y: 380 },
			{ id: 'node-6', type: 'response', x: 840, y: 200 },
		],
		initialConnections: [
			{ sourceType: 'request', targetType: 'router' },
			{ sourceType: 'router', targetType: 'controller' },
			{ sourceType: 'controller', targetType: 'model' },
			{ sourceType: 'model', targetType: 'database' },
			{ sourceType: 'database', targetType: 'response' },
		],
		initialMetrics: {
			queries: 1,
			latency: 3000,
			problem: 'Missing Index - Full Table Scan!',
		},
		successCondition: (nodes, connections) => {
			const hasIndex = nodes.some((n) => n.type === 'index');
			const indexConnected = connections.some((c) => {
				const source = nodes.find((n) => n.id === c.sourceNodeId);
				const target = nodes.find((n) => n.id === c.targetNodeId);
				return source?.type === 'index' || target?.type === 'index';
			});

			if (hasIndex && indexConnected) {
				return {
					success: true,
					message: 'Index added! Query time reduced from 3000ms to 5ms.',
				};
			}
			return {
				success: false,
				message:
					'Latency is still too high. The query is scanning too many rows.',
			};
		},
		availableNodes: ['index', 'cache', 'eager_load'],
		solutionNodeType: 'index',
	},
	'tutorial-caching': {
		name: 'Rails Caching',
		description: 'Add caching to reduce database load.',
		concepts: ['Fragment caching', 'Rails.cache'],
		scenario: 'The homepage runs expensive queries on every single request.',
		problem: `Every visitor triggers the same expensive query:

  # Runs on EVERY request!
  @products = Product.includes(:user, :reviews)
               .order(created_at: :desc)
               .limit(10)`,
		goal: 'Stop the database from being hit on every single request. The same data is being fetched repeatedly.',
		initialNodes: [
			{ id: 'node-1', type: 'request', x: 120, y: 200 },
			{ id: 'node-2', type: 'router', x: 300, y: 200 },
			{ id: 'node-3', type: 'controller', x: 480, y: 200 },
			{ id: 'node-4', type: 'model', x: 660, y: 200 },
			{ id: 'node-5', type: 'database', x: 660, y: 380 },
			{ id: 'node-6', type: 'serializer', x: 840, y: 200 },
			{ id: 'node-7', type: 'response', x: 1020, y: 200 },
		],
		initialConnections: [
			{ sourceType: 'request', targetType: 'router' },
			{ sourceType: 'router', targetType: 'controller' },
			{ sourceType: 'controller', targetType: 'model' },
			{ sourceType: 'model', targetType: 'database' },
			{ sourceType: 'database', targetType: 'serializer' },
			{ sourceType: 'serializer', targetType: 'response' },
		],
		initialMetrics: {
			queries: 5,
			latency: 800,
			problem: 'No Caching - DB hit on every request!',
		},
		successCondition: (nodes) => {
			const hasCache = nodes.some((n) => n.type === 'cache');
			if (hasCache) {
				return {
					success: true,
					message: 'Caching added! Subsequent requests will be instant.',
				};
			}
			return {
				success: false,
				message:
					'Database is still being hit on every request. Find a way to avoid repeated queries.',
			};
		},
		availableNodes: ['cache', 'eager_load', 'index'],
		solutionNodeType: 'cache',
	},
	'boss-database': {
		name: 'The Database Guardian',
		description: 'Fix all the performance problems to defeat the boss!',
		concepts: ['N+1', 'Caching', 'Optimization'],
		scenario:
			'The Database Guardian has corrupted your entire pipeline with multiple performance issues!',
		problem: `Multiple issues detected:
  - N+1 queries on reviews
  - No caching layer
  - Missing eager loading`,
		goal: 'Bring query count under 10 and latency under 100ms. Multiple optimizations needed.',
		initialNodes: [
			{ id: 'node-1', type: 'request', x: 120, y: 250 },
			{ id: 'node-2', type: 'router', x: 280, y: 250 },
			{ id: 'node-3', type: 'controller', x: 440, y: 250 },
			{ id: 'node-4', type: 'model', x: 600, y: 150 },
			{ id: 'node-5', type: 'model', x: 600, y: 350 },
			{ id: 'node-6', type: 'database', x: 760, y: 250 },
			{ id: 'node-7', type: 'serializer', x: 920, y: 250 },
			{ id: 'node-8', type: 'response', x: 1080, y: 250 },
		],
		initialConnections: [
			{ sourceType: 'request', targetType: 'router' },
			{ sourceType: 'router', targetType: 'controller' },
		],
		initialMetrics: {
			queries: 250,
			latency: 5000,
			problem: 'Multiple Performance Issues!',
		},
		successCondition: (nodes) => {
			const cacheCount = nodes.filter((n) => n.type === 'cache').length;
			if (cacheCount >= 2) {
				return {
					success: true,
					message: 'The Database Guardian is defeated! All issues fixed.',
				};
			}
			return {
				success: false,
				message:
					'Performance is still poor. Multiple optimizations are needed.',
			};
		},
		availableNodes: ['cache', 'eager_load', 'index', 'model'],
		solutionNodeType: 'multiple',
	},
};

// ============================================
// Re-export Acts for new structure
// ============================================

export {
	ACTS,
	getAct,
	getActForLevel,
	getAllLevels,
	getLevel,
	getNextLevel,
	isLevelUnlocked,
} from '@/lib/acts-registry';

/** @deprecated Use levelChallenges instead */
export const dungeonChallenges = levelChallenges;
