/**
 * Canonical node style registry.
 * Single source of truth for colors, icons, and descriptions of all node types.
 * Used by FlowNode, PipelineFlow, QueryZoneFlow, and the sandbox.
 */

export interface NodeStyle {
	id: string;
	label: string;
	icon: string;
	color: string;
	description: string;
}

const styles: NodeStyle[] = [
	// Request lifecycle
	{
		id: 'request',
		label: 'Request',
		icon: 'RQ',
		color: '#3b82f6',
		description: 'Incoming HTTP request',
	},
	{
		id: 'router',
		label: 'Router',
		icon: 'RT',
		color: '#a78bfa',
		description: 'Routes to controller actions',
	},
	{
		id: 'controller',
		label: 'Controller',
		icon: 'CO',
		color: '#10b981',
		description: 'Handles request logic',
	},
	{
		id: 'model',
		label: 'Model',
		icon: 'MO',
		color: '#f59e0b',
		description: 'ActiveRecord model',
	},
	{
		id: 'database',
		label: 'Database',
		icon: 'DB',
		color: '#ef4444',
		description: 'PostgreSQL / SQLite',
	},
	{
		id: 'serializer',
		label: 'Serializer',
		icon: 'SE',
		color: '#8b5cf6',
		description: 'JSON serialization',
	},
	{
		id: 'response',
		label: 'Response',
		icon: 'RS',
		color: '#22c55e',
		description: 'HTTP response',
	},
	// Infrastructure
	{
		id: 'middleware',
		label: 'Middleware',
		icon: 'MW',
		color: '#64748b',
		description: 'Rack middleware',
	},
	{
		id: 'cache',
		label: 'Cache',
		icon: 'CA',
		color: '#06b6d4',
		description: 'Solid Cache',
	},
	{
		id: 'service',
		label: 'Service',
		icon: 'SV',
		color: '#6366f1',
		description: 'Service object',
	},
	{
		id: 'mailer',
		label: 'Mailer',
		icon: 'ML',
		color: '#ec4899',
		description: 'Action Mailer',
	},
	{
		id: 'job',
		label: 'Job',
		icon: 'JB',
		color: '#8b5cf6',
		description: 'Background job',
	},
	{
		id: 'auth',
		label: 'Auth',
		icon: 'AU',
		color: '#f97316',
		description: 'Authentication layer',
	},
	{
		id: 'policy',
		label: 'Policy',
		icon: 'PO',
		color: '#f97316',
		description: 'Authorization policy',
	},
	// Production / scale
	{
		id: 'users',
		label: 'Users',
		icon: 'US',
		color: '#3b82f6',
		description: 'Traffic source',
	},
	{
		id: 'cdn',
		label: 'CDN',
		icon: 'CD',
		color: '#06b6d4',
		description: 'Cloudflare edge cache',
	},
	{
		id: 'rate-limiter',
		label: 'Rate Limiter',
		icon: 'RL',
		color: '#f97316',
		description: 'rack-attack, per-IP throttling',
	},
	{
		id: 'load-balancer',
		label: 'Load Balancer',
		icon: 'LB',
		color: '#a78bfa',
		description: 'Round-robin distribution',
	},
	{
		id: 'app-server',
		label: 'App Server',
		icon: 'AP',
		color: '#10b981',
		description: 'Puma (5 threads)',
	},
	{
		id: 'solid-cache',
		label: 'Solid Cache',
		icon: 'SC',
		color: '#06b6d4',
		description: 'Rails 8 DB-backed cache',
	},
	{
		id: 'db-replica',
		label: 'DB Replica',
		icon: 'RD',
		color: '#f87171',
		description: 'Read replica',
	},
	{
		id: 'solid-queue',
		label: 'Solid Queue',
		icon: 'SQ',
		color: '#8b5cf6',
		description: 'Rails 8 background jobs',
	},
	{
		id: 'stripe-api',
		label: 'Stripe API',
		icon: 'ST',
		color: '#f59e0b',
		description: 'Payment processing',
	},
];

/** Index by id for O(1) lookup */
const byId = new Map<string, NodeStyle>(styles.map((s) => [s.id, s]));

/** Index by label for label-based lookup (used by PipelineFlow) */
const byLabel = new Map<string, NodeStyle>(styles.map((s) => [s.label, s]));

/** All registered node styles */
export const NODE_STYLES = styles;

/** Look up by kebab-case id */
export function getNodeStyleById(id: string): NodeStyle | undefined {
	return byId.get(id);
}

/**
 * Look up style by label. Checks exact match, then partial match, then fallback.
 * Used by PipelineFlow and QueryZoneFlow where nodes are identified by label text.
 */
export function getNodeStyle(label: string): NodeStyle {
	const exact = byLabel.get(label);
	if (exact) return exact;
	for (const style of styles) {
		if (label.includes(style.label)) return style;
	}
	const upper = label.replace(/[^A-Z]/g, '');
	return {
		id: 'unknown',
		label,
		icon:
			upper.length >= 2 ? upper.slice(0, 2) : label.slice(0, 2).toUpperCase(),
		color: '#a1a1aa',
		description: '',
	};
}
