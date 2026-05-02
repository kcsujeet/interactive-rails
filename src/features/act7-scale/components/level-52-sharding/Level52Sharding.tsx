/**
 * Level 52: Database Sharding
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom visualization with 3 tenant nodes converging
 *   on a single overloaded Primary DB. Probes reveal write contention, table bloat,
 *   backup failures, and vacuum lag.
 *
 * Phase 2 (HOW - build): 6 steps (1 terminal + 5 OptionCard)
 *   Step 0: Add shard entries to database.yml (TerminalChoice)
 *   Step 1: Create ShardRecord abstract class with connects_to shards (OptionCard)
 *   Step 2: Configure shard key selection with modular hash (OptionCard)
 *   Step 3: Build ShardResolver middleware (OptionCard)
 *   Step 4: Move Order to inherit from ShardRecord (OptionCard)
 *   Step 5: Add cross-shard aggregation service (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Topology changes to 3 tenants -> ShardResolver -> 3 shards.
 *   Stress test fires tenant writes, cross-shard queries, migrations, and wrong-shard lookups.
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import {
	ArrowRight,
	Database,
	GitBranch,
	ShieldAlert,
	Zap,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalCommand,
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	AnimatedDots,
	type DotConfig,
	FlowDiagram,
	FlowHandles,
	reversePath,
} from '@/components/levels/FlowDiagram';
import { FlowNode, type FlowNodeData } from '@/components/levels/FlowNode';
import type { ProbeConfig } from '@/components/levels/ProbeTerminal';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import {
	StageInspector,
	type StageInspectorData,
} from '@/components/levels/StageInspector';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act7-level52-sharding', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface TenantVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
}

interface DbVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
	isOverloaded: boolean;
}

interface ResolverVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
}

interface EdgeVizState {
	[key: string]: unknown;
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	tenantA?: Partial<TenantVizState>;
	tenantB?: Partial<TenantVizState>;
	tenantC?: Partial<TenantVizState>;
	primaryDb?: Partial<DbVizState>;
	resolver?: Partial<ResolverVizState>;
	shardOne?: Partial<DbVizState>;
	shardTwo?: Partial<DbVizState>;
	shardThree?: Partial<DbVizState>;
	edgeA?: Partial<EdgeVizState>;
	edgeB?: Partial<EdgeVizState>;
	edgeC?: Partial<EdgeVizState>;
	edgeRA?: Partial<EdgeVizState>;
	edgeRB?: Partial<EdgeVizState>;
	edgeRC?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_TENANT_A: TenantVizState = {
	label: 'Acme Corp',
	flash: 'idle',
	sublabel: 'Tenant A',
};

const DEFAULT_TENANT_B: TenantVizState = {
	label: 'Globex Inc',
	flash: 'idle',
	sublabel: 'Tenant B',
};

const DEFAULT_TENANT_C: TenantVizState = {
	label: 'Initech',
	flash: 'idle',
	sublabel: 'Tenant C',
};

const DEFAULT_PRIMARY: DbVizState = {
	label: 'Primary DB',
	flash: 'red',
	sublabel: '2B rows, ALL tenants',
	badge: null,
	isOverloaded: true,
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

const DEFAULT_RESOLVER: ResolverVizState = {
	label: 'ShardResolver',
	flash: 'green',
	sublabel: 'company_id % 3',
};

const DEFAULT_SHARD_ONE: DbVizState = {
	label: 'shard_one',
	flash: 'green',
	sublabel: 'Acme Corp data',
	badge: null,
	isOverloaded: false,
};

const DEFAULT_SHARD_TWO: DbVizState = {
	label: 'shard_two',
	flash: 'green',
	sublabel: 'Globex Inc data',
	badge: null,
	isOverloaded: false,
};

const DEFAULT_SHARD_THREE: DbVizState = {
	label: 'shard_three',
	flash: 'green',
	sublabel: 'Initech data',
	badge: null,
	isOverloaded: false,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'write-bottleneck', label: 'Write latency 200ms+ from contention' },
	{ id: 'table-bloat', label: 'Index rebuild takes 4+ hours on 2B rows' },
	{ id: 'backup-failure', label: 'pg_dump fails after 6 hours, out of disk' },
	{ id: 'vacuum-lag', label: 'Autovacuum cannot keep up with dead tuples' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'write-latency',
		label: 'Test INSERT latency',
		command: 'INSERT INTO orders (tenant_id, total) VALUES (1, 99.00)',
		responseLines: [
			{ text: 'INSERT 0 1 (214ms)', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Write latency 214ms (was 5ms six months ago).',
				color: 'red',
			},
			{
				text: '3 tenants contending for same table locks.',
				color: 'yellow',
			},
			{
				text: 'Index on (tenant_id, created_at) spans 2B rows.',
				color: 'yellow',
			},
		],
		story: [
			'Acme Corp places an order.',
			'The INSERT must acquire a lock on the orders table.',
			'But Globex and Initech are also writing concurrently.',
			'The shared index spans 2 billion rows across all tenants.',
			'A simple INSERT now takes 200ms+ instead of 5ms.',
		],
	},
	{
		id: 'index-rebuild',
		label: 'Rebuild orders index',
		command: 'REINDEX INDEX CONCURRENTLY idx_orders_tenant_created',
		responseLines: [
			{ text: 'REINDEX started...', color: 'cyan' },
			{ text: '', color: 'muted' },
			{
				text: 'Estimated time: 4 hours 22 minutes (2.1B rows).',
				color: 'red',
			},
			{
				text: 'Index size: 48GB. Temporary space needed: 96GB.',
				color: 'red',
			},
			{
				text: 'Cannot complete during maintenance window.',
				color: 'yellow',
			},
		],
		story: [
			'The orders index is fragmented after months of writes.',
			'You attempt a concurrent reindex to fix performance.',
			'With 2.1 billion rows, the rebuild takes over 4 hours.',
			'The maintenance window is only 2 hours.',
			'Index maintenance becomes impossible at this scale.',
		],
	},
	{
		id: 'backup-fails',
		label: 'Run pg_dump backup',
		command: 'pg_dump -Fc app_production > backup.dump',
		responseLines: [
			{ text: 'pg_dump: dumping contents of table "orders"...', color: 'cyan' },
			{ text: '', color: 'muted' },
			{
				text: 'pg_dump: [archiver] could not write to output file: No space left on device',
				color: 'red',
			},
			{
				text: 'Dump failed after 6 hours. Backup size exceeded 2TB disk.',
				color: 'red',
			},
			{
				text: 'Point-in-time recovery is now at risk.',
				color: 'yellow',
			},
		],
		story: [
			'You run the nightly backup as usual.',
			'pg_dump starts serializing the 2B-row orders table.',
			'After 6 hours, the backup file exceeds available disk space.',
			'The backup fails. No complete backup exists.',
			'If the primary fails, point-in-time recovery is impossible.',
		],
	},
	{
		id: 'vacuum-behind',
		label: 'Check autovacuum status',
		command:
			"SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables WHERE relname = 'orders'",
		responseLines: [
			{
				text: 'orders | n_dead_tup: 84,000,000 | last_autovacuum: 3 days ago',
				color: 'red',
			},
			{ text: '', color: 'muted' },
			{
				text: '84M dead tuples accumulating. Autovacuum takes 18 hours.',
				color: 'red',
			},
			{
				text: 'Table bloat: 340GB actual vs 220GB live data.',
				color: 'yellow',
			},
			{
				text: 'Transaction ID wraparound risk in 2 weeks.',
				color: 'red',
			},
		],
		story: [
			'You check the vacuum status on the orders table.',
			'84 million dead tuples have accumulated.',
			'Autovacuum started 3 days ago but cannot finish in time.',
			'The table is 55% bloated (340GB vs 220GB live data).',
			'Transaction ID wraparound will force a full-table freeze soon.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'write-latency': ['write-bottleneck'],
	'index-rebuild': ['table-bloat'],
	'backup-fails': ['backup-failure'],
	'vacuum-behind': ['vacuum-lag'],
};

// ─── Observe animation frames ─────────────────────────────────────────
// Observe: 4 nodes (3 tenants + Primary DB). edgeA/B/C = tenants -> Primary.

const WRITE_LATENCY_FRAMES: AnimFrame[] = [
	{
		tenantA: {
			label: 'Acme Corp',
			flash: 'amber',
			sublabel: 'INSERT INTO orders...',
		},
		primaryDb: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Lock contention on orders',
			badge: '214ms',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'INSERT (Acme)',
			dotColor: '#ef4444',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'INSERT (Globex)',
			dotColor: '#ef4444',
		},
		edgeC: {
			active: true,
			reverse: false,
			label: 'INSERT (Initech)',
			dotColor: '#ef4444',
		},
	},
	{
		tenantA: { label: 'Acme Corp', flash: 'red', sublabel: '214ms (was 5ms)' },
		tenantB: {
			label: 'Globex Inc',
			flash: 'red',
			sublabel: 'Waiting for lock...',
		},
		tenantC: {
			label: 'Initech',
			flash: 'red',
			sublabel: 'Waiting for lock...',
		},
		primaryDb: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: '3 tenants contending',
			badge: '2B rows',
			isOverloaded: true,
		},
	},
	{
		tenantA: { flash: 'idle', sublabel: 'Tenant A' },
		tenantB: { flash: 'idle', sublabel: 'Tenant B' },
		tenantC: { flash: 'idle', sublabel: 'Tenant C' },
		primaryDb: {
			flash: 'red',
			sublabel: '2B rows, ALL tenants',
			badge: null,
			isOverloaded: true,
		},
		edgeA: { active: false, label: '' },
		edgeB: { active: false, label: '' },
		edgeC: { active: false, label: '' },
	},
];

const INDEX_REBUILD_FRAMES: AnimFrame[] = [
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'REINDEX CONCURRENTLY...',
			badge: '2.1B rows',
		},
	},
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'Rebuild: 4h 22m estimated',
			badge: '48GB index',
			isOverloaded: true,
		},
	},
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'Exceeds maintenance window',
			badge: null,
			isOverloaded: true,
		},
	},
];

const BACKUP_FRAMES: AnimFrame[] = [
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'pg_dump running...',
			badge: '6h elapsed',
		},
	},
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'No space left on device',
			badge: 'FAILED',
			isOverloaded: true,
		},
	},
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'No valid backup exists',
			badge: null,
			isOverloaded: true,
		},
	},
];

const VACUUM_FRAMES: AnimFrame[] = [
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'amber',
			sublabel: 'Checking autovacuum...',
			badge: null,
		},
	},
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: '84M dead tuples',
			badge: '340GB bloat',
			isOverloaded: true,
		},
	},
	{
		primaryDb: {
			label: 'Primary DB',
			flash: 'red',
			sublabel: 'TX wraparound risk: 2 weeks',
			badge: null,
			isOverloaded: true,
		},
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'write-latency': WRITE_LATENCY_FRAMES,
	'index-rebuild': INDEX_REBUILD_FRAMES,
	'backup-fails': BACKUP_FRAMES,
	'vacuum-behind': VACUUM_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────
// Reward: 7 nodes (3 tenants, resolver, 3 shards).
// edgeA/B/C = tenants -> resolver. edgeRA/RB/RC = resolver -> shards.

const REWARD_TENANT_A_FRAMES: AnimFrame[] = [
	{
		tenantA: {
			label: 'Acme Corp',
			flash: 'amber',
			sublabel: 'INSERT INTO orders...',
		},
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'company_id=1 % 3 = 1',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'Acme write',
			dotColor: '#22c55e',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: 'Routed to shard_one',
		},
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'INSERT 0 1',
			badge: '5ms',
		},
		edgeA: { active: false, label: '' },
		edgeRA: {
			active: true,
			reverse: false,
			label: 'INSERT -> shard_one',
			dotColor: '#22c55e',
		},
	},
	{
		tenantA: {
			label: 'Acme Corp',
			flash: 'green',
			sublabel: '5ms (was 214ms)',
		},
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'Acme Corp data',
			badge: null,
		},
		edgeRA: { active: false, label: '' },
	},
];

const REWARD_TENANT_B_FRAMES: AnimFrame[] = [
	{
		tenantB: {
			label: 'Globex Inc',
			flash: 'amber',
			sublabel: 'INSERT INTO orders...',
		},
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'company_id=2 % 3 = 2',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'Globex write',
			dotColor: '#22c55e',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: 'Routed to shard_two',
		},
		shardTwo: {
			label: 'shard_two',
			flash: 'green',
			sublabel: 'INSERT 0 1',
			badge: '5ms',
		},
		edgeB: { active: false, label: '' },
		edgeRB: {
			active: true,
			reverse: false,
			label: 'INSERT -> shard_two',
			dotColor: '#22c55e',
		},
	},
	{
		tenantB: {
			label: 'Globex Inc',
			flash: 'green',
			sublabel: '5ms (was 214ms)',
		},
		shardTwo: {
			label: 'shard_two',
			flash: 'green',
			sublabel: 'Globex Inc data',
			badge: null,
		},
		edgeRB: { active: false, label: '' },
	},
];

const REWARD_TENANT_C_FRAMES: AnimFrame[] = [
	{
		tenantC: {
			label: 'Initech',
			flash: 'amber',
			sublabel: 'INSERT INTO orders...',
		},
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'company_id=3 % 3 = 0',
		},
		edgeC: {
			active: true,
			reverse: false,
			label: 'Initech write',
			dotColor: '#22c55e',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: 'Routed to shard_three',
		},
		shardThree: {
			label: 'shard_three',
			flash: 'green',
			sublabel: 'INSERT 0 1',
			badge: '5ms',
		},
		edgeC: { active: false, label: '' },
		edgeRC: {
			active: true,
			reverse: false,
			label: 'INSERT -> shard_three',
			dotColor: '#22c55e',
		},
	},
	{
		tenantC: { label: 'Initech', flash: 'green', sublabel: '5ms (was 214ms)' },
		shardThree: {
			label: 'shard_three',
			flash: 'green',
			sublabel: 'Initech data',
			badge: null,
		},
		edgeRC: { active: false, label: '' },
	},
];

const REWARD_CROSS_SHARD_FRAMES: AnimFrame[] = [
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'Cross-shard aggregation...',
		},
		edgeRA: {
			active: true,
			reverse: false,
			label: 'SELECT SUM',
			dotColor: '#f59e0b',
		},
		edgeRB: {
			active: true,
			reverse: false,
			label: 'SELECT SUM',
			dotColor: '#f59e0b',
		},
		edgeRC: {
			active: true,
			reverse: false,
			label: 'SELECT SUM',
			dotColor: '#f59e0b',
		},
	},
	{
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'Partial: $142K',
			badge: null,
		},
		shardTwo: {
			label: 'shard_two',
			flash: 'green',
			sublabel: 'Partial: $98K',
			badge: null,
		},
		shardThree: {
			label: 'shard_three',
			flash: 'green',
			sublabel: 'Partial: $67K',
			badge: null,
		},
		edgeRA: {
			active: true,
			reverse: true,
			label: '$142K',
			dotColor: '#22c55e',
		},
		edgeRB: { active: true, reverse: true, label: '$98K', dotColor: '#22c55e' },
		edgeRC: { active: true, reverse: true, label: '$67K', dotColor: '#22c55e' },
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: 'Total: $307K revenue',
		},
		shardOne: { sublabel: 'Acme Corp data', flash: 'green' },
		shardTwo: { sublabel: 'Globex Inc data', flash: 'green' },
		shardThree: { sublabel: 'Initech data', flash: 'green' },
		edgeRA: { active: false, label: '' },
		edgeRB: { active: false, label: '' },
		edgeRC: { active: false, label: '' },
	},
];

const REWARD_WRITE_LATENCY_FRAMES: AnimFrame[] = [
	{
		tenantA: {
			label: 'Acme Corp',
			flash: 'amber',
			sublabel: 'INSERT INTO orders...',
		},
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'Routing to shard_one...',
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'Acme write',
			dotColor: '#22c55e',
		},
	},
	{
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'No contention!',
			badge: '5ms',
		},
		edgeA: { active: false, label: '' },
		edgeRA: {
			active: true,
			reverse: false,
			label: 'INSERT -> shard_one',
			dotColor: '#22c55e',
		},
	},
	{
		tenantA: {
			label: 'Acme Corp',
			flash: 'green',
			sublabel: '5ms, no lock contention',
		},
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'Acme Corp data',
			badge: null,
		},
		edgeRA: { active: false, label: '' },
	},
];

const REWARD_MIGRATE_FRAMES: AnimFrame[] = [
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'Running migration on all shards...',
		},
		edgeRA: {
			active: true,
			reverse: false,
			label: 'ALTER TABLE',
			dotColor: '#f59e0b',
		},
		edgeRB: {
			active: true,
			reverse: false,
			label: 'ALTER TABLE',
			dotColor: '#f59e0b',
		},
		edgeRC: {
			active: true,
			reverse: false,
			label: 'ALTER TABLE',
			dotColor: '#f59e0b',
		},
	},
	{
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'Migration complete',
			badge: '12s',
		},
		shardTwo: {
			label: 'shard_two',
			flash: 'green',
			sublabel: 'Migration complete',
			badge: '10s',
		},
		shardThree: {
			label: 'shard_three',
			flash: 'green',
			sublabel: 'Migration complete',
			badge: '8s',
		},
		edgeRA: {
			active: true,
			reverse: true,
			label: 'OK (12s)',
			dotColor: '#22c55e',
		},
		edgeRB: {
			active: true,
			reverse: true,
			label: 'OK (10s)',
			dotColor: '#22c55e',
		},
		edgeRC: {
			active: true,
			reverse: true,
			label: 'OK (8s)',
			dotColor: '#22c55e',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: 'All shards migrated',
		},
		shardOne: { sublabel: 'Acme Corp data', badge: null, flash: 'green' },
		shardTwo: { sublabel: 'Globex Inc data', badge: null, flash: 'green' },
		shardThree: { sublabel: 'Initech data', badge: null, flash: 'green' },
		edgeRA: { active: false, label: '' },
		edgeRB: { active: false, label: '' },
		edgeRC: { active: false, label: '' },
	},
];

const REWARD_WRONG_SHARD_FRAMES: AnimFrame[] = [
	{
		tenantB: {
			label: 'Globex Inc',
			flash: 'amber',
			sublabel: 'SELECT * FROM orders...',
		},
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'company_id=2 -> shard_one?',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'Globex query',
			dotColor: '#f59e0b',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'red',
			sublabel: 'Wrong shard for tenant B!',
		},
		shardOne: {
			label: 'shard_one',
			flash: 'red',
			sublabel: '0 rows found',
			badge: 'MISS',
		},
		edgeRA: {
			active: true,
			reverse: false,
			label: 'SELECT -> wrong shard',
			dotColor: '#ef4444',
		},
	},
	{
		tenantB: {
			label: 'Globex Inc',
			flash: 'red',
			sublabel: 'Empty result set',
		},
		resolver: {
			label: 'ShardResolver',
			flash: 'red',
			sublabel: 'Shard key mismatch',
		},
		shardOne: {
			label: 'shard_one',
			flash: 'idle',
			sublabel: 'Acme Corp data',
			badge: null,
		},
		edgeB: { active: false, label: '' },
		edgeRA: { active: false, label: '' },
	},
];

const REWARD_INDEX_REBUILD_FRAMES: AnimFrame[] = [
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'REINDEX on shard_one...',
		},
		edgeRA: {
			active: true,
			reverse: false,
			label: 'REINDEX',
			dotColor: '#f59e0b',
		},
	},
	{
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'Reindex complete',
			badge: '15min',
		},
		edgeRA: {
			active: true,
			reverse: true,
			label: 'OK (15min)',
			dotColor: '#22c55e',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: '15min vs 4h on monolith',
		},
		shardOne: {
			label: 'shard_one',
			flash: 'green',
			sublabel: 'Acme Corp data',
			badge: null,
		},
		edgeRA: { active: false, label: '' },
	},
];

const REWARD_BACKUP_FRAMES: AnimFrame[] = [
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'pg_dump on shard_two...',
		},
		edgeRB: {
			active: true,
			reverse: false,
			label: 'pg_dump',
			dotColor: '#f59e0b',
		},
	},
	{
		shardTwo: {
			label: 'shard_two',
			flash: 'green',
			sublabel: 'Backup complete',
			badge: '200GB',
		},
		edgeRB: {
			active: true,
			reverse: true,
			label: 'OK (200GB)',
			dotColor: '#22c55e',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: '200GB vs 2TB monolith failure',
		},
		shardTwo: {
			label: 'shard_two',
			flash: 'green',
			sublabel: 'Globex Inc data',
			badge: null,
		},
		edgeRB: { active: false, label: '' },
	},
];

const REWARD_VACUUM_FRAMES: AnimFrame[] = [
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'amber',
			sublabel: 'Autovacuum on shard_three...',
		},
		edgeRC: {
			active: true,
			reverse: false,
			label: 'VACUUM',
			dotColor: '#f59e0b',
		},
	},
	{
		shardThree: {
			label: 'shard_three',
			flash: 'green',
			sublabel: 'Vacuum complete',
			badge: '8min',
		},
		edgeRC: {
			active: true,
			reverse: true,
			label: 'OK (8min)',
			dotColor: '#22c55e',
		},
	},
	{
		resolver: {
			label: 'ShardResolver',
			flash: 'green',
			sublabel: 'No dead tuple buildup',
		},
		shardThree: {
			label: 'shard_three',
			flash: 'green',
			sublabel: 'Initech data',
			badge: null,
		},
		edgeRC: { active: false, label: '' },
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'tenant-a-write': REWARD_TENANT_A_FRAMES,
	'tenant-b-write': REWARD_TENANT_B_FRAMES,
	'tenant-c-write': REWARD_TENANT_C_FRAMES,
	'cross-shard-query': REWARD_CROSS_SHARD_FRAMES,
	'write-latency': REWARD_WRITE_LATENCY_FRAMES,
	'migrate-all': REWARD_MIGRATE_FRAMES,
	'wrong-shard': REWARD_WRONG_SHARD_FRAMES,
	'index-rebuild': REWARD_INDEX_REBUILD_FRAMES,
	'backup-fails': REWARD_BACKUP_FRAMES,
	'vacuum-behind': REWARD_VACUUM_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	tenantA: {
		stageId: 'tenantA',
		title: 'Acme Corp (Tenant A)',
		description:
			'Large enterprise customer with 800M orders. Generates 45% of all write traffic. Peak activity during US business hours creates contention with other tenants.',
	},
	tenantB: {
		stageId: 'tenantB',
		title: 'Globex Inc (Tenant B)',
		description:
			'Mid-size customer with 500M orders. Write patterns overlap with Acme Corp during peak hours. Index scans slow down as shared indexes span all tenants.',
	},
	tenantC: {
		stageId: 'tenantC',
		title: 'Initech (Tenant C)',
		description:
			'Growing customer with 300M orders. Nightly batch imports create write spikes that compete with Acme and Globex real-time traffic.',
	},
	primaryDb: {
		stageId: 'primaryDb',
		title: 'Primary Database',
		description:
			'Single PostgreSQL instance holding 2 billion rows across all tenants. Indexes span the full dataset. Backups, vacuums, and migrations all operate on the entire 2B-row table.',
		code: `# config/database.yml (current)
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 50
    # ALL tenants share this one database
    # 2B rows in orders table alone`,
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	primaryDb: 'write-bottleneck',
};

// ─── Stress test scenarios (reward) ───────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'tenant-a-write',
		label: 'Acme writes to shard_one',
		description: 'INSERT routed to shard_one via company_id % 3',
		method: 'POST',
		path: '/api/v1/orders (tenant: Acme)',
		actor: 'acme',
		expectedResult: 'allowed',
	},
	{
		id: 'tenant-b-write',
		label: 'Globex writes to shard_two',
		description: 'INSERT routed to shard_two via company_id % 3',
		method: 'POST',
		path: '/api/v1/orders (tenant: Globex)',
		actor: 'globex',
		expectedResult: 'allowed',
	},
	{
		id: 'tenant-c-write',
		label: 'Initech writes to shard_three',
		description: 'INSERT routed to shard_three via company_id % 3',
		method: 'POST',
		path: '/api/v1/orders (tenant: Initech)',
		actor: 'initech',
		expectedResult: 'allowed',
	},
	{
		id: 'cross-shard-query',
		label: 'Admin cross-shard aggregation',
		description: 'Queries all 3 shards and merges results',
		method: 'GET',
		path: '/api/v1/admin/revenue',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'write-latency',
		label: 'Write latency check (5ms)',
		description: 'Shard-local write, no cross-tenant contention',
		method: 'POST',
		path: '/api/v1/orders (shard_one)',
		actor: 'acme',
		expectedResult: 'allowed',
	},
	{
		id: 'migrate-all',
		label: 'Migration on all shards',
		description: 'ALTER TABLE runs on each shard independently',
		method: 'POST',
		path: '/admin/migrations/run',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'wrong-shard',
		label: 'Query wrong shard for tenant B',
		description: 'Globex data queried on shard_one returns empty',
		method: 'GET',
		path: '/api/v1/orders?shard=shard_one (tenant: Globex)',
		actor: 'globex',
		expectedResult: 'blocked',
	},
	{
		id: 'index-rebuild',
		label: 'Reindex shard_one',
		description: '15 minutes per shard vs 4 hours on monolith',
		method: 'POST',
		path: '/admin/maintenance/reindex (shard_one)',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'backup-fails',
		label: 'Backup shard_two',
		description: '200GB per shard succeeds vs 2TB monolith failure',
		method: 'POST',
		path: '/admin/maintenance/backup (shard_two)',
		actor: 'admin',
		expectedResult: 'allowed',
	},
	{
		id: 'vacuum-behind',
		label: 'Vacuum shard_three',
		description: 'Autovacuum keeps up on smaller tables',
		method: 'POST',
		path: '/admin/maintenance/vacuum (shard_three)',
		actor: 'admin',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-shards', title: 'Add Shard Entries to database.yml' },
	{ id: 'shard-record', title: 'Create ShardRecord Abstract Class' },
	{ id: 'shard-key', title: 'Configure Shard Key Selection' },
	{ id: 'shard-resolver', title: 'Build ShardResolver Middleware' },
	{ id: 'move-order', title: 'Move Order to ShardRecord' },
	{ id: 'cross-shard', title: 'Add Cross-Shard Aggregation' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: add shard entries
	'option', // 1: ShardRecord
	'option', // 2: shard key
	'option', // 3: ShardResolver
	'option', // 4: move Order
	'option', // 5: cross-shard
];

// ─── Step 0: Add shard entries (Terminal) ─────────────────────────────

const addShardsCommands: TerminalCommand[] = [
	{
		id: 'wrong-single-replica',
		label: 'Add one replica to database.yml',
		command:
			'cat >> config/database.yml << EOF\n  primary_replica:\n    adapter: postgresql\n    host: replica.example.com\nEOF',
		correct: false,
		feedback:
			'A single replica handles read scaling but not write scaling. Sharding distributes writes across multiple independent databases.',
	},
	{
		id: 'wrong-partition',
		label: 'ALTER TABLE orders PARTITION BY RANGE (tenant_id)',
		command:
			'rails dbconsole -e production -c "ALTER TABLE orders PARTITION BY RANGE (tenant_id)"',
		correct: false,
		feedback:
			'Table partitioning keeps data on the same server. Sharding distributes data across separate database servers for independent scaling.',
	},
	{
		id: 'correct',
		label: 'Add shard_one, shard_two, shard_three to database.yml',
		command:
			'cat >> config/database.yml << EOF\n  shard_one:\n    adapter: postgresql\n    host: shard1.example.com\n    database: app_shard_one\n  shard_two:\n    adapter: postgresql\n    host: shard2.example.com\n    database: app_shard_two\n  shard_three:\n    adapter: postgresql\n    host: shard3.example.com\n    database: app_shard_three\nEOF',
		correct: true,
	},
];

const addShardsOutput: TerminalOutputLine[] = [
	{ text: 'Added 3 shard entries to database.yml', color: 'green' },
	{ text: 'shard_one: shard1.example.com', color: 'cyan' },
	{ text: 'shard_two: shard2.example.com', color: 'cyan' },
	{ text: 'shard_three: shard3.example.com', color: 'cyan' },
];

// ─── Step 1: ShardRecord (OptionCard) ────────────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const SHARD_RECORD_OPTIONS: StepOption[] = [
	{
		id: 'wrong-app-record',
		name: 'class ApplicationRecord < ActiveRecord::Base\n  connects_to shards: {\n    shard_one: { writing: :shard_one },\n    shard_two: { writing: :shard_two },\n    shard_three: { writing: :shard_three }\n  }\nend',
		correct: false,
		feedback:
			'Putting shards on ApplicationRecord forces ALL models onto shards. Only tenant-specific models should be sharded. Use a separate abstract class.',
	},
	{
		id: 'correct',
		name: 'class ShardRecord < ApplicationRecord\n  self.abstract_class = true\n\n  connects_to shards: {\n    shard_one: { writing: :shard_one },\n    shard_two: { writing: :shard_two },\n    shard_three: { writing: :shard_three }\n  }\nend',
		correct: true,
	},
	{
		id: 'wrong-establish',
		name: 'class ShardRecord < ApplicationRecord\n  self.abstract_class = true\n\n  establish_connection :shard_one\n  establish_connection :shard_two\n  establish_connection :shard_three\nend',
		correct: false,
		feedback:
			'establish_connection creates a single static connection, not shard routing. Rails provides a declarative method for defining shard mappings that enables dynamic switching at runtime.',
	},
];

// ─── Step 2: Shard key (OptionCard) ───────────────────────────────────

const SHARD_KEY_OPTIONS: StepOption[] = [
	{
		id: 'wrong-random',
		name: 'shard = [:shard_one, :shard_two, :shard_three].sample',
		correct: false,
		feedback:
			'Random assignment scatters each tenant across all shards. Queries would need to fan out to every shard, eliminating the performance benefit.',
	},
	{
		id: 'wrong-round-robin',
		name: 'shard = SHARDS[Order.count % 3]',
		correct: false,
		feedback:
			'Round-robin by order count distributes individual rows, not tenants. A single tenant query would need to check all shards.',
	},
	{
		id: 'correct',
		name: 'shard = [:shard_one, :shard_two, :shard_three][company_id % 3]',
		correct: true,
	},
];

// ─── Step 3: ShardResolver (OptionCard) ───────────────────────────────

const RESOLVER_OPTIONS: StepOption[] = [
	{
		id: 'wrong-header',
		name: 'class ShardResolver\n  def self.call(request)\n    shard = request.headers["X-Shard"]\n    ActiveRecord::Base.connected_to(shard: shard.to_sym) { yield }\n  end\nend',
		correct: false,
		feedback:
			'Relying on a client-provided header is a security risk. Clients could target any shard. Derive the shard from the authenticated tenant context instead.',
	},
	{
		id: 'correct',
		name: 'class ShardResolver\n  def self.call(request)\n    tenant = ActsAsTenant.current_tenant\n    shard = [:shard_one, :shard_two, :shard_three][tenant.id % 3]\n    ActiveRecord::Base.connected_to(shard: shard) { yield }\n  end\nend',
		correct: true,
	},
	{
		id: 'wrong-env',
		name: 'class ShardResolver\n  def self.call(request)\n    shard = ENV["DATABASE_SHARD"].to_sym\n    ActiveRecord::Base.connected_to(shard: shard) { yield }\n  end\nend',
		correct: false,
		feedback:
			'An environment variable is static per process. Every request would go to the same shard, defeating the purpose of tenant-based routing.',
	},
];

// ─── Step 4: Move Order (OptionCard) ──────────────────────────────────

const MOVE_ORDER_OPTIONS: StepOption[] = [
	{
		id: 'wrong-concern',
		name: 'class Order < ApplicationRecord\n  include Shardable\nend',
		correct: false,
		feedback:
			'A concern cannot change the database connection. The model must inherit from ShardRecord to use the connects_to shards: declaration.',
	},
	{
		id: 'correct',
		name: 'class Order < ShardRecord\n  belongs_to :company\n  belongs_to :customer\n\n  validates :total, presence: true\nend',
		correct: true,
	},
	{
		id: 'wrong-both',
		name: 'class Order < ApplicationRecord\n  connects_to shards: {\n    shard_one: { writing: :shard_one }\n  }\nend',
		correct: false,
		feedback:
			'Duplicating connects_to on every model is unmaintainable. Inherit from ShardRecord so the shard configuration lives in one place.',
	},
];

// ─── Step 5: Cross-shard aggregation (OptionCard) ─────────────────────

const CROSS_SHARD_OPTIONS: StepOption[] = [
	{
		id: 'wrong-single',
		name: 'class RevenueReport < ApplicationService\n  def call\n    Order.sum(:total)\n  end\nend',
		correct: false,
		feedback:
			'Order.sum only queries the current shard. Cross-shard reports must iterate over all shards and merge results.',
	},
	{
		id: 'wrong-raw',
		name: 'class RevenueReport < ApplicationService\n  def call\n    sql = "SELECT SUM(total) FROM orders"\n    ActiveRecord::Base.connection.execute(sql)\n  end\nend',
		correct: false,
		feedback:
			'Raw SQL on the base connection only hits the default database, not the shards. You need to query each shard and combine results.',
	},
	{
		id: 'correct',
		name: 'class RevenueReport < ApplicationService\n  SHARDS = [:shard_one, :shard_two, :shard_three]\n\n  def call\n    SHARDS.sum do |shard|\n      ActiveRecord::Base.connected_to(shard: shard) do\n        Order.sum(:total)\n      end\n    end\n  end\nend',
		correct: true,
	},
];

// ─── Option step config map ───────────────────────────────────────────

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	1: {
		title: 'Create ShardRecord Abstract Class',
		description:
			'Rails needs an abstract base class that declares the shard connections. Only tenant-specific models will inherit from it. Which declaration correctly maps the three shards?',
		options: SHARD_RECORD_OPTIONS,
	},
	2: {
		title: 'Configure Shard Key Selection',
		description:
			"The shard key determines which database stores each tenant. The key must keep all of a tenant's data on one shard while distributing tenants evenly. Which selection strategy works?",
		options: SHARD_KEY_OPTIONS,
	},
	3: {
		title: 'Build ShardResolver Middleware',
		description:
			'Each request must route to the correct shard based on the authenticated tenant. The resolver reads the tenant from the request context and switches the database connection. Which implementation is secure and dynamic?',
		options: RESOLVER_OPTIONS,
	},
	4: {
		title: 'Move Order to ShardRecord',
		description:
			'The Order model currently inherits from ApplicationRecord, which uses the primary database. It needs to use the sharded connections instead. How should Order be updated?',
		options: MOVE_ORDER_OPTIONS,
	},
	5: {
		title: 'Add Cross-Shard Aggregation',
		description:
			'Admin reports need totals across all tenants. With data split across 3 shards, a simple Order.sum only queries one shard. How do you aggregate across all shards?',
		options: CROSS_SHARD_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addShardsCommands, outputLines: addShardsOutput },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// ─── Code preview per phase/step ──────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'config/database.yml',
				language: 'yaml',
				code: `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 50
    # ALL tenants in one database
    # 2B rows in orders table`,
				highlight: [8, 9],
			},
			{
				filename: 'app/models/order.rb',
				language: 'ruby',
				code: `class Order < ApplicationRecord
  belongs_to :company
  belongs_to :customer

  validates :total, presence: true
  # All tenant orders in one table
  # 2 billion rows and growing
end`,
				highlight: [6, 7],
			},
		];
	}

	const files = [];

	// Step 0 complete: database.yml has shard entries
	if (completedStep >= 0) {
		files.push({
			filename: 'config/database.yml',
			language: 'yaml',
			code: `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 50
  shard_one:
    adapter: postgresql
    host: shard1.example.com
    database: app_shard_one
  shard_two:
    adapter: postgresql
    host: shard2.example.com
    database: app_shard_two
  shard_three:
    adapter: postgresql
    host: shard3.example.com
    database: app_shard_three`,
			highlight: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
		});
	} else {
		files.push({
			filename: 'config/database.yml',
			language: 'yaml',
			code: `# config/database.yml
production:
  primary:
    adapter: postgresql
    host: primary-db.example.com
    database: app_production
    pool: 50
    # TODO: add shard entries`,
			highlight: [8],
		});
	}

	// Step 1 complete: ShardRecord abstract class
	if (completedStep >= 1) {
		files.push({
			filename: 'app/models/shard_record.rb',
			language: 'ruby',
			code: `class ShardRecord < ApplicationRecord
  self.abstract_class = true

  connects_to shards: {
    shard_one: { writing: :shard_one },
    shard_two: { writing: :shard_two },
    shard_three: { writing: :shard_three }
  }
end`,
			highlight: [4, 5, 6, 7],
		});
	}

	// Step 2 complete: shard key selection
	if (completedStep >= 2) {
		files.push({
			filename: 'app/models/concerns/shard_routing.rb',
			language: 'ruby',
			code: `module ShardRouting
  SHARDS = %i[shard_one shard_two shard_three]

  def self.shard_for(company_id)
    SHARDS[company_id % 3]
  end
end`,
			highlight: [4, 5],
		});
	}

	// Step 3 complete: ShardResolver middleware
	if (completedStep >= 3) {
		files.push({
			filename: 'app/middleware/shard_resolver.rb',
			language: 'ruby',
			code: `class ShardResolver
  def self.call(request)
    tenant = ActsAsTenant.current_tenant
    shard = ShardRouting.shard_for(tenant.id)
    ActiveRecord::Base.connected_to(shard: shard) { yield }
  end
end`,
			highlight: [3, 4, 5],
		});
	}

	// Step 4 complete: Order inherits from ShardRecord
	if (completedStep >= 4) {
		files.push({
			filename: 'app/models/order.rb',
			language: 'ruby',
			code: `class Order < ShardRecord
  belongs_to :company
  belongs_to :customer

  validates :total, presence: true
end`,
			highlight: [1],
		});
	}

	// Step 5 complete: Cross-shard aggregation
	if (completedStep >= 5) {
		files.push({
			filename: 'app/services/revenue_report.rb',
			language: 'ruby',
			code: `class RevenueReport < ApplicationService
  SHARDS = %i[shard_one shard_two shard_three]

  def call
    SHARDS.sum do |shard|
      ActiveRecord::Base.connected_to(shard: shard) do
        Order.sum(:total)
      end
    end
  end
end`,
			highlight: [5, 6, 7],
		});
	}

	return files;
}

// ─── Flash to FlowNode status mapping ────────────────────────────────

function flashToStatus(flash: ZoneFlash): FlowNodeData['status'] {
	switch (flash) {
		case 'green':
			return 'active';
		case 'red':
			return 'error';
		case 'amber':
			return 'warning';
		default:
			return 'idle';
	}
}

// ─── Custom React Flow nodes ──────────────────────────────────────────

const TenantNode = memo(function TenantNode({
	data,
}: {
	data: TenantVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'TN',
		color: '#6366f1',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
		</FlowNode>
	);
});

const DbNode = memo(function DbNode({ data }: { data: DbVizState }) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'DB',
		color: '#71717a',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-mono">
					{data.badge}
				</div>
			)}
			{data.isOverloaded && (
				<div className="mt-1 flex items-center justify-center gap-1 text-xs text-destructive">
					<Zap className="w-3 h-3" />
					Overloaded
				</div>
			)}
		</FlowNode>
	);
});

const ShardDbNode = memo(function ShardDbNode({ data }: { data: DbVizState }) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'SD',
		color: '#22c55e',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-mono">
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

const ResolverNode = memo(function ResolverNode({
	data,
}: {
	data: ResolverVizState;
}) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'RS',
		color: '#6366f1',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
		</FlowNode>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

const ShardEdge = memo(function ShardEdge(props: EdgeProps) {
	const { id, sourceX, sourceY, targetX, targetY, data } = props;
	const d = (data ?? DEFAULT_EDGE) as EdgeVizState;

	const [edgePath, labelX, labelY] = getStraightPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
	});

	const dotPath = d.reverse ? reversePath(edgePath) : edgePath;
	const fill = d.dotColor || '#ef4444';

	const dots: DotConfig[] = d.active
		? Array.from({ length: 3 }, (_, i) => ({
				id: `${id}-d${i}`,
				color: fill,
				r: 5,
				dur: '1.2s',
				begin: i === 0 ? '0s' : `-${i * 0.4}s`,
			}))
		: [];

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					stroke: d.active ? fill : '#a1a1aa',
					strokeWidth: 2,
					strokeDasharray: d.active ? undefined : '6 4',
				}}
			/>
			{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
			{d.label && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan pointer-events-none absolute text-xs font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 20}px)`,
						}}
					>
						{d.label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
});

const shardNodeTypes = {
	tenant: TenantNode,
	db: DbNode,
	shardDb: ShardDbNode,
	resolver: ResolverNode,
};
const shardEdgeTypes = { shard: ShardEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level52Sharding({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [tenantAState, setTenantAState] =
		useState<TenantVizState>(DEFAULT_TENANT_A);
	const [tenantBState, setTenantBState] =
		useState<TenantVizState>(DEFAULT_TENANT_B);
	const [tenantCState, setTenantCState] =
		useState<TenantVizState>(DEFAULT_TENANT_C);
	const [primaryDbState, setPrimaryDbState] =
		useState<DbVizState>(DEFAULT_PRIMARY);
	const [resolverState, setResolverState] =
		useState<ResolverVizState>(DEFAULT_RESOLVER);
	const [shardOneState, setShardOneState] =
		useState<DbVizState>(DEFAULT_SHARD_ONE);
	const [shardTwoState, setShardTwoState] =
		useState<DbVizState>(DEFAULT_SHARD_TWO);
	const [shardThreeState, setShardThreeState] =
		useState<DbVizState>(DEFAULT_SHARD_THREE);
	const [edgeAState, setEdgeAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeCState, setEdgeCState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeRAState, setEdgeRAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeRBState, setEdgeRBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeRCState, setEdgeRCState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setTenantAState(DEFAULT_TENANT_A);
		setTenantBState(DEFAULT_TENANT_B);
		setTenantCState(DEFAULT_TENANT_C);
		if (isReward) {
			setPrimaryDbState({
				...DEFAULT_PRIMARY,
				flash: 'idle',
				sublabel: null,
				isOverloaded: false,
			});
			setResolverState(DEFAULT_RESOLVER);
			setShardOneState(DEFAULT_SHARD_ONE);
			setShardTwoState(DEFAULT_SHARD_TWO);
			setShardThreeState(DEFAULT_SHARD_THREE);
		} else {
			setPrimaryDbState(DEFAULT_PRIMARY);
		}
		setEdgeAState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
		setEdgeCState(DEFAULT_EDGE);
		setEdgeRAState(DEFAULT_EDGE);
		setEdgeRBState(DEFAULT_EDGE);
		setEdgeRCState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.tenantA)
			setTenantAState((prev) => ({ ...prev, ...frame.tenantA }));
		if (frame.tenantB)
			setTenantBState((prev) => ({ ...prev, ...frame.tenantB }));
		if (frame.tenantC)
			setTenantCState((prev) => ({ ...prev, ...frame.tenantC }));
		if (frame.primaryDb)
			setPrimaryDbState((prev) => ({ ...prev, ...frame.primaryDb }));
		if (frame.resolver)
			setResolverState((prev) => ({ ...prev, ...frame.resolver }));
		if (frame.shardOne)
			setShardOneState((prev) => ({ ...prev, ...frame.shardOne }));
		if (frame.shardTwo)
			setShardTwoState((prev) => ({ ...prev, ...frame.shardTwo }));
		if (frame.shardThree)
			setShardThreeState((prev) => ({ ...prev, ...frame.shardThree }));
		if (frame.edgeA) setEdgeAState((prev) => ({ ...prev, ...frame.edgeA }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
		if (frame.edgeC) setEdgeCState((prev) => ({ ...prev, ...frame.edgeC }));
		if (frame.edgeRA) setEdgeRAState((prev) => ({ ...prev, ...frame.edgeRA }));
		if (frame.edgeRB) setEdgeRBState((prev) => ({ ...prev, ...frame.edgeRB }));
		if (frame.edgeRC) setEdgeRCState((prev) => ({ ...prev, ...frame.edgeRC }));
	}, []);

	const runAnimation = useCallback(
		(frames: AnimFrame[], onDone?: () => void) => {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			setVizAnimating(true);
			resetViz();

			for (const [i, frame] of frames.entries()) {
				const t = setTimeout(() => {
					applyFrame(frame);
					if (i === frames.length - 1) {
						const cleanup = setTimeout(() => {
							setVizAnimating(false);
							onDone?.();
						}, ANIMATION_DURATION_MS);
						timersRef.current.push(cleanup);
					}
				}, i * ANIMATION_DURATION_MS);
				timersRef.current.push(t);
			}
		},
		[applyFrame, resetViz],
	);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	// ── Hooks ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// ── Inspector ──
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);

	// ── Flow nodes/edges ──
	const flowNodes: Node[] = useMemo(() => {
		if (isReward) {
			return [
				{
					id: 'tenantA',
					type: 'tenant',
					position: { x: 30, y: 20 },
					data: tenantAState,
				},
				{
					id: 'tenantB',
					type: 'tenant',
					position: { x: 250, y: 20 },
					data: tenantBState,
				},
				{
					id: 'tenantC',
					type: 'tenant',
					position: { x: 470, y: 20 },
					data: tenantCState,
				},
				{
					id: 'resolver',
					type: 'resolver',
					position: { x: 220, y: 160 },
					data: resolverState,
				},
				{
					id: 'shardOne',
					type: 'shardDb',
					position: { x: 30, y: 310 },
					data: shardOneState,
				},
				{
					id: 'shardTwo',
					type: 'shardDb',
					position: { x: 250, y: 310 },
					data: shardTwoState,
				},
				{
					id: 'shardThree',
					type: 'shardDb',
					position: { x: 470, y: 310 },
					data: shardThreeState,
				},
			];
		}
		// Observe: 3 tenants at top, 1 primary DB at bottom
		return [
			{
				id: 'tenantA',
				type: 'tenant',
				position: { x: 30, y: 20 },
				data: tenantAState,
			},
			{
				id: 'tenantB',
				type: 'tenant',
				position: { x: 250, y: 20 },
				data: tenantBState,
			},
			{
				id: 'tenantC',
				type: 'tenant',
				position: { x: 470, y: 20 },
				data: tenantCState,
			},
			{
				id: 'primaryDb',
				type: 'db',
				position: { x: 230, y: 220 },
				data: primaryDbState,
			},
		];
	}, [
		tenantAState,
		tenantBState,
		tenantCState,
		primaryDbState,
		resolverState,
		shardOneState,
		shardTwoState,
		shardThreeState,
		isReward,
	]);

	const flowEdges: Edge[] = useMemo(() => {
		if (isReward) {
			return [
				{
					id: 'edgeA',
					source: 'tenantA',
					target: 'resolver',
					type: 'shard',
					data: edgeAState,
				},
				{
					id: 'edgeB',
					source: 'tenantB',
					target: 'resolver',
					type: 'shard',
					data: edgeBState,
				},
				{
					id: 'edgeC',
					source: 'tenantC',
					target: 'resolver',
					type: 'shard',
					data: edgeCState,
				},
				{
					id: 'edgeRA',
					source: 'resolver',
					target: 'shardOne',
					type: 'shard',
					data: edgeRAState,
				},
				{
					id: 'edgeRB',
					source: 'resolver',
					target: 'shardTwo',
					type: 'shard',
					data: edgeRBState,
				},
				{
					id: 'edgeRC',
					source: 'resolver',
					target: 'shardThree',
					type: 'shard',
					data: edgeRCState,
				},
			];
		}
		// Observe: all 3 tenants -> primary
		return [
			{
				id: 'edgeA',
				source: 'tenantA',
				target: 'primaryDb',
				type: 'shard',
				data: edgeAState,
			},
			{
				id: 'edgeB',
				source: 'tenantB',
				target: 'primaryDb',
				type: 'shard',
				data: edgeBState,
			},
			{
				id: 'edgeC',
				source: 'tenantC',
				target: 'primaryDb',
				type: 'shard',
				data: edgeCState,
			},
		];
	}, [
		edgeAState,
		edgeBState,
		edgeCState,
		edgeRAState,
		edgeRBState,
		edgeRCState,
		isReward,
	]);

	// ── Handlers ──
	const handleNodeClick = useCallback(
		(nodeId: string) => {
			if (phase !== 'observe') return;
			const data = STAGE_INSPECTOR_MAP[nodeId];
			if (!data) return;
			setInspectorData(data);
			const discoveryId = STAGE_DISCOVERY_MAP[nodeId];
			if (discoveryId) discoveryGating.discover(discoveryId);
		},
		[phase, discoveryGating],
	);

	const handleProbe = useCallback(
		(probeId: string) => {
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}
			const frames = OBSERVE_PROBE_FRAMES[probeId];
			if (frames) runAnimation(frames);
		},
		[discoveryGating, runAnimation],
	);

	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const frames = REWARD_PROBE_FRAMES[scenarioId];
			if (frames) runAnimation(frames);
		},
		[stressTest, runAnimation],
	);

	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const config = OPTION_STEP_CONFIG[stepper.currentStep];
			if (!config) return;
			const option = config.options.find((o) => o.id === optionId);
			if (!option) return;
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all build steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return {
			valid: true,
			message:
				'Database sharding configured! Writes distributed across 3 independent shards.',
		};
	};

	// ── Code preview index ──
	const codePreviewStep = stepper.isCurrentStepCompleted
		? stepper.currentStep
		: stepper.currentStep - 1;

	// ── Render ──
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Center panel content ──
	function renderCenter() {
		// Observe phase
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					<div className="flex-1 relative">
						<FlowDiagram
							edges={flowEdges}
							edgeTypes={shardEdgeTypes}
							nodes={flowNodes}
							nodeTypes={shardNodeTypes}
							onNodeClick={handleNodeClick}
						/>
						{inspectorData && (
							<StageInspector
								data={inspectorData}
								onClose={() => setInspectorData(null)}
							/>
						)}
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={vizAnimating}
							onProbe={handleProbe}
							probes={PROBES}
							title="Sharding Probe"
						/>
					</div>
					{discoveryGating.isUnlocked && (
						<div className="p-4 flex justify-center animate-in fade-in duration-500">
							<Button
								className="gap-2"
								onClick={() => setPhase('build')}
								size="lg"
							>
								Build the Fix
								<ArrowRight className="w-4 h-4" />
							</Button>
						</div>
					)}
				</div>
			);
		}

		// Build phase
		if (phase === 'build') {
			return (
				<div className="flex-1 overflow-auto p-6">
					<div className="max-w-2xl mx-auto space-y-4">
						{/* Step 0: Terminal */}
						{currentStepType === 'terminal' && stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={addShardsCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										All 3 tenants share a single database with 2 billion rows.
										Add 3 shard database entries so Rails knows about the
										separate database servers.
									</p>
								}
								hasNext={hasNextStep}
								initialHistory={buildTerminalHistory(
									SHELL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={addShardsOutput}
								stepKey={stepper.currentStep}
								title="Add Shard Entries"
							/>
						)}

						{/* OptionCard steps (1-5) */}
						{currentStepType === 'option' && currentOptionConfig && (
							<>
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								{isViewingCompletedStep ? (
									<div className="space-y-2">
										{shuffleOptions(
											currentOptionConfig.options,
											stepper.currentStep,
										).map((opt) => (
											<OptionCard
												color="violet"
												disabled={!opt.correct}
												key={opt.id}
												mono
												name={opt.name}
												selected={opt.correct}
												size="lg"
											/>
										))}
									</div>
								) : (
									<>
										<div className="space-y-2">
											{shuffleOptions(
												currentOptionConfig.options,
												stepper.currentStep,
											).map((opt) => (
												<OptionCard
													color="violet"
													key={opt.id}
													mono
													name={opt.name}
													onClick={() => handleOptionSelect(opt.id)}
													size="lg"
												/>
											))}
										</div>
										<ErrorFeedback
											message={stepper.lastFeedback}
											onDismiss={stepper.clearFeedback}
										/>
									</>
								)}

								{isViewingCompletedStep && (
									<div className="flex justify-end">
										<Button
											className="gap-2"
											onClick={
												hasNextStep
													? stepper.nextStep
													: () => setPhase('reward')
											}
											size="sm"
										>
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			);
		}

		// Reward phase
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={shardEdgeTypes}
						nodes={flowNodes}
						nodeTypes={shardNodeTypes}
					/>
				</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
						disabled={vizAnimating}
						isAutoFiring={stressTest.isAutoFiring}
						onFire={handleFireScenario}
						onToggleAutoFire={stressTest.toggleAutoFire}
						results={stressTest.results}
						scenarios={STRESS_SCENARIOS}
					/>
				</div>
			</div>
		);
	}

	return (
		<LevelLayout>
			<LeftPanel>
				<div className="flex flex-col h-full overflow-y-auto">
					{/* Scenario text */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Three tenants share one PostgreSQL database with 2 billion rows.
							Writes take 200ms+ from lock contention. Index rebuilds take 4+
							hours. Backups fail because the dump exceeds disk space.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Rails supports horizontal sharding natively. Split each tenant
							onto its own database so writes, indexes, and maintenance scale
							independently.
						</p>
					</div>

					{/* Observe: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build: step progress */}
					{phase === 'build' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Build Steps
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{/* Reward: routing legend + counters */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Sharding Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<GitBranch className="w-4 h-4 text-success" />
										<span className="text-foreground">
											ShardResolver routes by tenant
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Database className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Each shard holds one tenant
										</span>
									</div>
									<div className="flex items-center gap-2">
										<ShieldAlert className="w-4 h-4 text-destructive" />
										<span className="text-foreground">
											Wrong shard returns empty results
										</span>
									</div>
								</div>
							</div>
							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Routed</div>
									</div>
									<div className="bg-destructive/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-destructive">
											{stressTest.blockedCount}
										</div>
										<div className="text-xs text-destructive/70">Blocked</div>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Database Sharding"
					levelNumber={52}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>
				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{renderCenter()}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build'
							? codePreviewStep
							: phase === 'reward'
								? STEP_DEFS.length - 1
								: -1,
					)}
					learningGoal="Rails horizontal sharding distributes data across multiple database servers. A ShardRecord abstract class declares shard connections, a resolver middleware routes each request to the correct shard based on tenant, and cross-shard aggregation iterates all shards to merge results."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level52Sharding;
