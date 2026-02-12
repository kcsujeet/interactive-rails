// Pipeline node and connection types for the visual pipeline builder

export type NodeType =
	| 'request'
	| 'router'
	| 'controller'
	| 'model'
	| 'database'
	| 'cache'
	| 'serializer'
	| 'response'
	| 'background_job';

export type NodeStatus = 'idle' | 'processing' | 'error' | 'success';

export interface Position {
	x: number;
	y: number;
}

export interface Port {
	id: string;
	type: 'input' | 'output';
	dataType: 'request' | 'data' | 'query' | 'json' | 'any';
	label?: string;
}

// Base node configuration shared by all node types
export interface BaseNodeConfig {
	label?: string;
}

// Router configuration
export interface RouterConfig extends BaseNodeConfig {
	routes: Array<{
		method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
		path: string;
		controllerAction: string;
	}>;
	middleware?: string[];
}

// Controller configuration
export interface ControllerConfig extends BaseNodeConfig {
	name: string;
	actions: string[];
	beforeActions?: Array<{
		name: string;
		only?: string[];
		except?: string[];
	}>;
	strongParams?: string[];
}

// Model configuration
export interface ModelConfig extends BaseNodeConfig {
	name: string;
	tableName: string;
	associations: Array<{
		type: 'belongs_to' | 'has_one' | 'has_many' | 'has_and_belongs_to_many';
		name: string;
		foreignKey?: string;
	}>;
	validations?: Array<{
		field: string;
		type: 'presence' | 'uniqueness' | 'format' | 'length' | 'numericality';
		options?: Record<string, unknown>;
	}>;
	callbacks?: Array<{
		timing: 'before' | 'after' | 'around';
		action: 'save' | 'create' | 'update' | 'destroy' | 'validation';
		method: string;
	}>;
	scopes?: Array<{
		name: string;
		query: string;
	}>;
	// Eager loading configuration (includes/preload)
	defaultIncludes?: string[];
}

// Database configuration
export interface DatabaseConfig extends BaseNodeConfig {
	tables: Array<{
		name: string;
		columns: Array<{
			name: string;
			type:
				| 'string'
				| 'text'
				| 'integer'
				| 'float'
				| 'boolean'
				| 'datetime'
				| 'references';
		}>;
		indexes: Array<{
			columns: string[];
			unique?: boolean;
		}>;
	}>;
	// Connection pool settings
	poolSize?: number;
	connectionTimeout?: number;
}

// Cache configuration
export interface CacheConfig extends BaseNodeConfig {
	strategy: 'read_through' | 'write_through' | 'write_behind' | 'cache_aside';
	store: 'memory' | 'redis' | 'memcached';
	ttl: number; // seconds
	keyPattern?: string;
	// Fragment caching
	fragmentKeys?: string[];
	// Russian doll caching
	nestedCaching?: boolean;
}

// Serializer configuration
export interface SerializerConfig extends BaseNodeConfig {
	format: 'json' | 'jsonapi';
	fields?: string[];
	// N+1 detection: tracks which associations are accessed in serializer
	accessedAssociations?: string[];
	// Caching
	cacheKey?: string;
}

// Background job configuration
export interface BackgroundJobConfig extends BaseNodeConfig {
	queue: string;
	priority: 'low' | 'default' | 'high' | 'critical';
	retries?: number;
	retryDelay?: number; // seconds
	timeout?: number; // seconds
}

// Request node configuration (entry point)
export interface RequestConfig extends BaseNodeConfig {
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	path: string;
	params?: Record<string, string>;
	headers?: Record<string, string>;
}

// Response node configuration (exit point)
export interface ResponseConfig extends BaseNodeConfig {
	format: 'html' | 'json' | 'xml' | 'redirect';
	status?: number;
}

// Union type for all node configs
export type NodeConfig =
	| RouterConfig
	| ControllerConfig
	| ModelConfig
	| DatabaseConfig
	| CacheConfig
	| SerializerConfig
	| BackgroundJobConfig
	| RequestConfig
	| ResponseConfig;

// The base node interface
export interface BaseNode {
	id: string;
	type: NodeType;
	position: Position;
	ports: Port[];
	config: NodeConfig;
	status: NodeStatus;
	// Runtime metrics (updated during simulation)
	metrics?: {
		processTime: number;
		queryCount: number;
		cacheHits: number;
		cacheMisses: number;
		errorCount: number;
	};
}

// Connection between nodes
export interface Connection {
	id: string;
	sourceNodeId: string;
	sourcePortId: string;
	targetNodeId: string;
	targetPortId: string;
	// Data flow metrics (updated during simulation)
	dataFlow?: {
		requestsPerSecond: number;
		avgLatency: number;
		errorRate: number;
		bytesTransferred: number;
	};
}

// Pipeline definition (complete graph)
export interface Pipeline {
	id: string;
	name: string;
	description?: string;
	nodes: BaseNode[];
	connections: Connection[];
	// Validation state
	isValid: boolean;
	validationErrors?: string[];
}

// Node factory defaults for each type
export const NODE_DEFAULTS: Record<NodeType, Partial<BaseNode>> = {
	request: {
		ports: [
			{ id: 'out', type: 'output', dataType: 'request', label: 'Request' },
		],
		config: { method: 'GET', path: '/' } as RequestConfig,
	},
	router: {
		ports: [
			{ id: 'in', type: 'input', dataType: 'request', label: 'Request' },
			{ id: 'out', type: 'output', dataType: 'request', label: 'Action' },
		],
		config: { routes: [] } as RouterConfig,
	},
	controller: {
		ports: [
			{ id: 'in', type: 'input', dataType: 'request', label: 'Action' },
			{ id: 'model', type: 'output', dataType: 'query', label: 'Query' },
			{ id: 'serializer', type: 'output', dataType: 'data', label: 'Data' },
			{ id: 'job', type: 'output', dataType: 'data', label: 'Job' },
		],
		config: { name: 'Controller', actions: [] } as ControllerConfig,
	},
	model: {
		ports: [
			{ id: 'in', type: 'input', dataType: 'query', label: 'Query' },
			{ id: 'db', type: 'output', dataType: 'query', label: 'SQL' },
			{ id: 'cache', type: 'output', dataType: 'query', label: 'Cache' },
			{ id: 'out', type: 'output', dataType: 'data', label: 'Data' },
		],
		config: { name: 'Model', tableName: '', associations: [] } as ModelConfig,
	},
	database: {
		ports: [
			{ id: 'in', type: 'input', dataType: 'query', label: 'SQL' },
			{ id: 'out', type: 'output', dataType: 'data', label: 'Results' },
		],
		config: { tables: [] } as DatabaseConfig,
	},
	cache: {
		ports: [
			{ id: 'in', type: 'input', dataType: 'query', label: 'Lookup' },
			{ id: 'miss', type: 'output', dataType: 'query', label: 'Miss' },
			{ id: 'out', type: 'output', dataType: 'data', label: 'Hit' },
		],
		config: {
			strategy: 'cache_aside',
			store: 'redis',
			ttl: 3600,
		} as CacheConfig,
	},
	serializer: {
		ports: [
			{ id: 'in', type: 'input', dataType: 'data', label: 'Data' },
			{ id: 'out', type: 'output', dataType: 'json', label: 'JSON' },
		],
		config: { format: 'json' } as SerializerConfig,
	},
	response: {
		ports: [{ id: 'in', type: 'input', dataType: 'any', label: 'Response' }],
		config: { format: 'json' } as ResponseConfig,
	},
	background_job: {
		ports: [
			{ id: 'in', type: 'input', dataType: 'data', label: 'Payload' },
			{ id: 'out', type: 'output', dataType: 'data', label: 'Result' },
		],
		config: { queue: 'default', priority: 'default' } as BackgroundJobConfig,
	},
};

// Helper to create a new node with defaults
export function createNode(
	type: NodeType,
	position: Position,
	overrides?: Partial<BaseNode>,
): BaseNode {
	const defaults = NODE_DEFAULTS[type];
	return {
		id: crypto.randomUUID(),
		type,
		position,
		ports: defaults.ports || [],
		config: defaults.config as NodeConfig,
		status: 'idle',
		...overrides,
	};
}
