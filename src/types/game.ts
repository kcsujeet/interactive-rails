/**
 * Interactive Rails Game Types
 *
 * Type definitions for the pipeline builder game, Acts/Levels structure,
 * simulation, and learning content.
 */

// ============================================
// Game State Types
// ============================================

export type GameState =
	| 'loading'
	| 'briefing'
	| 'playing'
	| 'paused'
	| 'completed'
	| 'failed';

export type GamePhase = 'observe' | 'diagnose' | 'fix' | 'verify';

// ============================================
// Acts & Levels Structure
// ============================================

export interface Act {
	id: number;
	name: string;
	tagline: string;
	description: string;
	levels: Level[];
	/** Nodes that become available after completing this act */
	unlockedNodes: string[];
	/** Whether metrics are visible during this act */
	metricsVisible: boolean;
	/** Which metrics are visible (if metricsVisible is true) */
	visibleMetrics?: string[];
}

export interface Level {
	id: string;
	actId: number;
	levelNumber: number;
	name: string;
	/** Whether this level is the capstone finale */
	isCapstone?: boolean;
	/** What happens to trigger this level's problem */
	trigger: LevelTrigger;
	/** The starting state of the pipeline */
	startingPipeline: PipelineState;
	/** The problem the player must solve */
	problem: LevelProblem;
	/** Conditions that must be met to complete the level */
	successConditions: SuccessCondition[];
	/** Nodes available to use in this level */
	availableNodes: string[];
	/** New nodes unlocked upon completion */
	unlockedNodes: string[];
	/** Learning content unlocked upon completion */
	learningContent: LearningContent;
	/** Optional hint that appears after X seconds */
	hint?: { delay: number; text: string };
	/** Optional slots for Level 1-style choice mechanics */
	slots?: SlotConfig[];
	/** Optional decision modals that trigger on specific connections */
	decisionModals?: DecisionModalConfig[];
	/** Optional logic blocks that can be moved between nodes */
	logicBlocks?: LogicBlock[];
	/** Optional simulation events (restart, leak, etc.) */
	simulationEvents?: SimulationEvent[];
	/** Whether this level shows the canvas in "dark mode" (Level 1) */
	darkCanvas?: boolean;
	/** Whether this level requires writing tests (from Level 12 onward) */
	requiresTests?: boolean;
}

export interface LevelTrigger {
	type:
		| 'initialization'
		| 'traffic_spike'
		| 'new_feature'
		| 'attack'
		| 'outage'
		| 'data_growth'
		| 'user_complaint'
		| 'incident'
		| 'security_audit'
		| 'refactor_request'
		| 'code_review'
		| 'security_incident'
		| 'performance_alert'
		| 'optimization'
		| 'scaling'
		| 'architecture';
	description: string;
	/** For traffic_spike: requests per second multiplier */
	intensity?: number;
}

export interface LevelProblem {
	/** What the player observes */
	observation: string;
	/** The actual root cause (internal, for learning content) */
	rootCause: string;
	/** Rails code example showing the problem (NOT the solution) */
	codeExample: string;
	/** Player-facing goal hint (doesn't give away the answer) - optional, falls back to generic */
	goal?: string;
	/** Metric thresholds that indicate the problem */
	thresholds: MetricThresholds;
}

export interface MetricThresholds {
	maxLatency?: number;
	maxQueriesPerRequest?: number;
	minCacheHitRate?: number;
	maxErrorRate?: number;
	maxMemoryUsage?: number;
}

export interface SuccessCondition {
	type:
		| 'metric'
		| 'node_present'
		| 'connection'
		| 'node_absent'
		| 'slot_filled'
		| 'logic_block_moved'
		| 'complexity_under'
		| 'decision_made'
		| 'path_exists'
		| 'node_count'
		| 'crud_complete'
		| 'pipeline_complete'
		| 'security_configured'
		| 'scopes_defined'
		| 'controller_lines'
		| 'service_created'
		| 'form_object_created'
		| 'authorization_configured'
		| 'view_component_created'
		| 'validations_configured'
		| 'callbacks_configured'
		| 'authentication_configured'
		| 'testing_configured'
		| 'concerns_configured'
		| 'query_object_created'
		| 'error_handling_configured'
		| 'mailer_configured'
		| 'encryption_configured'
		| 'realtime_configured'
		| 'search_configured'
		| 'counter_cache_configured'
		| 'polymorphic_configured'
		| 'transactions_configured'
		| 'versioning_configured'
		| 'middleware_configured'
		| 'soft_deletes_configured'
		| 'safe_migrations_configured'
		| 'recurring_jobs_configured'
		| 'error_monitoring_configured'
		| 'multi_database_configured'
		| 'state_machine_configured'
		| 'multi_tenancy_configured'
		| 'observability_configured'
		| 'domain_events_configured'
		| 'sharding_configured'
		| 'n1_identified'
		| 'eager_loading_applied'
		| 'queries_optimized'
		| 'pagination_implemented'
		| 'caching_configured'
		| 'background_jobs_configured'
		| 'api_resilience_configured'
		| 'webhooks_configured'
		| 'storage_configured'
		| 'idempotency_configured'
		| 'health_checks_configured'
		| 'load_balancing_configured'
		| 'cdn_configured'
		| 'rate_limiting_configured'
		| 'feature_flags_configured'
		| 'connection_pool_configured'
		| 'zero_downtime_configured'
		| 'message_queue_configured'
		| 'distributed_cache_configured'
		| 'api_gateway_configured'
		| 'microservice_extracted';
	/** For metric conditions */
	metric?: string;
	operator?: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
	value?: number;
	/** For node_present/absent conditions */
	nodeType?: string;
	/** For node_count conditions */
	count?: number;
	/** For connection conditions */
	sourceType?: string;
	targetType?: string;
	/** For slot_filled conditions */
	slotId?: string;
	slotValue?: string;
	/** For logic_block_moved conditions */
	blockId?: string;
	blockLocation?: string;
	/** For complexity_under conditions */
	maxComplexity?: number;
	/** For decision_made conditions */
	decisionValue?: string;
	/** For path_exists conditions */
	pathFrom?: string;
	pathTo?: string;
	/** For crud_complete conditions */
	modelType?: string;
	/** For controller_lines conditions */
	maxLines?: number;
}

export interface LearningContent {
	title: string;
	/** Markdown bullet list of concrete learning outcomes */
	goal: string;
	/** What the concept is (detailed reference, shown on completion screen) */
	conceptExplanation: string;
	/** Real Rails code showing the solution */
	railsCodeExample: string;
	/** Common mistakes to avoid */
	commonMistakes: string[];
	/** When to use this pattern */
	whenToUse: string;
	/** Links to further reading */
	furtherReading: Array<{ title: string; url: string }>;
}

// ============================================
// Pipeline Types
// ============================================

export interface PipelineState {
	nodes: PlacedNode[];
	connections: Connection[];
}

export interface PlacedNode {
	id: string;
	type: string;
	x: number;
	y: number;
	/** Optional configuration for the node */
	config?: NodeConfig;
	/** Whether the node is locked (cannot be moved/deleted) */
	locked?: boolean;
}

export interface NodeConfig {
	/** Custom label for the node (e.g. "Product", "Review") */
	label?: string;
	/** For eager_load: which associations to load */
	associations?: string[];
	/** For index: which columns */
	columns?: string[];
	/** For cache: TTL in seconds */
	ttl?: number;
	/** For scope: the query conditions */
	conditions?: string;
}

export interface Connection {
	id: string;
	sourceNodeId: string;
	targetNodeId: string;
	/** Whether this connection is highlighted (for trace mode) */
	highlighted?: boolean;
	/** Call count through this connection (for trace mode) */
	callCount?: number;
}

export interface PendingConnection {
	sourceNodeId: string;
	mouseX: number;
	mouseY: number;
}

// ============================================
// Node Types
// ============================================

export interface NodeTypeInfo {
	type: string;
	name: string;
	color: string;
	/** Icon or emoji for the node */
	icon?: string;
	/** Short description */
	description?: string;
}

// ============================================
// Simulation Types
// ============================================

export interface LiveMetrics {
	/** Total queries executed */
	queryCount: number;
	/** Response latency in ms */
	latency: number;
	/** CPU load percentage */
	cpuLoad: number;
	/** Database load percentage */
	dbLoad: number;
	/** Optional: queries per request */
	queriesPerRequest?: number;
	/** Optional: cache hit rate */
	cacheHitRate?: number;
	/** Optional: error rate */
	errorRate?: number;
	/** Optional: memory usage */
	memoryUsage?: number;
}

export interface QueryParticle {
	id: number;
	x: number;
	y: number;
	targetX: number;
	targetY: number;
	progress: number;
	type: 'request' | 'query' | 'cache_hit' | 'cache_miss';
	/** Optional: color override */
	color?: string;
}

export interface SimulatedRequest {
	id: string;
	startTime: number;
	endTime?: number;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	path: string[];
	queries: QueryTrace[];
	latency?: number;
	error?: string;
}

export interface QueryTrace {
	id: string;
	sql: string;
	duration: number;
	timestamp: number;
	/** Which node triggered this query */
	sourceNodeId: string;
	/** Whether this query was from cache */
	cached: boolean;
	/** Number of rows returned/affected */
	rowCount?: number;
	/** Whether this is part of an N+1 pattern */
	isNPlusOne?: boolean;
}

// ============================================
// Incident/Log Types
// ============================================

export interface Incident {
	id: string;
	timestamp: number;
	severity: 'info' | 'warning' | 'error' | 'critical';
	type: IncidentType;
	message: string;
	/** Which node(s) are involved */
	nodeIds?: string[];
	/** Metric values at time of incident */
	metrics?: Partial<LiveMetrics>;
}

export type IncidentType =
	| 'n_plus_one_detected'
	| 'slow_query'
	| 'cache_miss'
	| 'high_memory'
	| 'error_spike'
	| 'timeout'
	| 'rate_limit'
	| 'connection_blocked'
	| 'deadlock'
	| 'circuit_open';

// ============================================
// Validation Types
// ============================================

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
	score: number;
	/** Breakdown of the score */
	scoreBreakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
	latency: number;
	queryCount: number;
	cacheUsage: number;
	architecture: number;
}

// ============================================
// Level Data Types
// ============================================

export interface LevelData {
	id: string;
	name: string;
	description: string;
	rooms: Array<{ id: string; name: string; description: string }>;
	concepts: string[];
	/** Optional scenario description */
	scenario?: string;
	/** Optional problem code example */
	problem?: string;
	/** Optional goal description */
	goal?: string;
}

export interface LevelChallenge {
	name: string;
	description: string;
	concepts: string[];
	scenario: string;
	problem: string;
	goal: string;
	initialNodes: PlacedNode[];
	initialConnections: Array<{ sourceType: string; targetType: string }>;
	initialMetrics: {
		queries: number;
		latency: number;
		problem: string;
	};
	successCondition: (
		nodes: PlacedNode[],
		connections: Connection[],
	) => { success: boolean; message: string };
	availableNodes: string[];
	solutionNodeType: 'eager_load' | 'index' | 'cache' | 'multiple';
}

/** @deprecated Use LevelData instead */
export type DungeonData = LevelData;
/** @deprecated Use LevelChallenge instead */
export type DungeonChallenge = LevelChallenge;

// ============================================
// Player Progress Types
// ============================================

export interface PlayerProgress {
	currentAct: number;
	currentLevel: string;
	completedLevels: string[];
	/** Star ratings for each completed level (1-3) */
	levelStars: Record<string, number>;
	/** Nodes the player has unlocked */
	unlockedNodes: string[];
	/** Learning content the player has unlocked */
	unlockedContent: string[];
	/** Total time played in seconds */
	totalPlayTime: number;
	/** Achievements earned */
	achievements: string[];
}

// ============================================
// App State Types (for the "One App" that evolves)
// ============================================

export interface AppState {
	/** Current number of users */
	userCount: number;
	/** Current number of products */
	productCount: number;
	/** Current number of reviews */
	reviewCount: number;
	/** Features that have been added */
	features: string[];
	/** Current traffic level (requests per second) */
	trafficLevel: number;
	/** Database size in MB */
	databaseSize: number;
	/** Whether the app has experienced certain problems */
	experiencedProblems: string[];
	/** Technology choices made in Level 1 */
	stackChoices: StackChoices;
}

export interface StackChoices {
	database: 'sqlite' | 'postgres' | null;
}

// ============================================
// UI Types
// ============================================

export interface TooltipData {
	nodeId: string;
	nodeType: string;
	position: { x: number; y: number };
	metrics?: {
		latencyCost: number;
		memoryCost: number;
		callCount: number;
	};
}

export interface ContextMenuData {
	position: { x: number; y: number };
	nodeId?: string;
	connectionId?: string;
	items: ContextMenuItem[];
}

export interface ContextMenuItem {
	label: string;
	action: () => void;
	disabled?: boolean;
	danger?: boolean;
}

// ============================================
// Particle Types (Visual States)
// ============================================

export type ParticleVisualType =
	| 'request' // Normal request (white/default)
	| 'transient' // Blue - not persisted yet
	| 'persisted' // Green - saved to DB
	| 'dirty' // Jagged - invalid input
	| 'clean' // Smooth - validated
	| 'hacker' // Red - malicious request
	| 'cache_hit' // Green - served from cache
	| 'cache_miss' // Red - goes to DB
	| 'read' // Blue - SELECT query
	| 'write' // Orange - INSERT/UPDATE query
	| 'ghost'; // Faded - incomplete path (poofs on dead end)

// ============================================
// Game Choices (Level 1 Persistence)
// ============================================

export interface GameChoices {
	database: 'postgresql' | 'sqlite' | null;
	/** Constraints that affect future levels */
	constraints: {
		canShard: boolean; // PostgreSQL choice - enables Level 22
	};
}

// ============================================
// Logic Blocks (Draggable Code)
// ============================================

export interface LogicBlock {
	id: string;
	name: string; // 'Validate', 'Charge', 'Email', 'Save'
	code: string; // The actual Rails code
	category: 'validation' | 'business' | 'side_effect' | 'persistence';
	canMoveTo: string[]; // Node types this block can be moved to
}

// ============================================
// Complexity Meter
// ============================================

export interface ComplexityState {
	nodeId: string;
	score: number; // 0-100
	status: 'green' | 'yellow' | 'red';
	threshold: number; // Level-specific limit
	blocks: string[]; // Logic block IDs in this node
}

// ============================================
// Decision Modal
// ============================================

export interface DecisionModalConfig {
	trigger: {
		sourceType: string;
		targetType: string;
	};
	question: string;
	options: DecisionOption[];
	levelId?: string; // Only show for specific level
}

export interface DecisionOption {
	label: string;
	value: string;
	preview?: string; // Visual preview description
	consequence?: string; // Future impact warning
	correct?: boolean; // For level validation
}

// ============================================
// Slot System (Level 1)
// ============================================

export interface SlotConfig {
	id: string;
	label: string; // 'Database System', 'Frontend Architecture'
	acceptTypes: string[]; // Node types that can fill this slot
	required: boolean;
	filled?: string; // Node type that filled the slot
	position: { x: number; y: number };
}

// ============================================
// Level Trigger Types (Extended)
// ============================================

export type TriggerType =
	| 'initialization' // Level 1 - Day 1 setup
	| 'new_feature' // Product wants something new
	| 'traffic_spike' // Users increased
	| 'data_growth' // Data accumulated
	| 'incident' // Something broke
	| 'security_audit' // Security review
	| 'refactor_request' // Code quality concerns
	| 'attack' // Security attack
	| 'outage' // System failure
	| 'user_complaint'; // User feedback

// ============================================
// Success Condition Types (Extended)
// ============================================

export interface ExtendedSuccessCondition extends SuccessCondition {
	/** For slot_filled conditions */
	slotId?: string;
	slotValue?: string;
	/** For logic_block conditions */
	blockId?: string;
	blockLocation?: string;
	/** For complexity conditions */
	maxComplexity?: number;
	/** For decision conditions */
	decisionValue?: string;
	/** For path conditions */
	pathExists?: boolean;
	pathFrom?: string;
	pathTo?: string;
}

// ============================================
// Simulation Events
// ============================================

export interface SimulationEvent {
	type: 'restart' | 'leak' | 'attack' | 'spike' | 'failure';
	timestamp: number;
	description: string;
	affectedNodes?: string[];
}
