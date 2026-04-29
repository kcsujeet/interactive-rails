/**
 * Level 50: Multi-Tenancy
 *
 * Sequential phase flow: observe -> build -> reward
 *
 * Phase 1 (WHY - observe): Custom visualization showing a database table with
 *   color-coded rows (blue = Company A, orange = Company B) all intermixed.
 *   Two company badge nodes at top, one database table node below.
 *   Probes reveal cross-tenant data leaks, orphan records, and direct ID access.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Step 0: bundle add acts_as_tenant (terminal)
 *   Step 1: rails generate migration (terminal)
 *   Step 2: Set current tenant from subdomain/header (OptionCard)
 *   Step 3: Add acts_as_tenant :company to Product (OptionCard)
 *   Step 4: Add acts_as_tenant :company to Order (OptionCard)
 *   Step 5: Add tenant-scoped unique index (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same visualization but with WHERE clause filter.
 *   Stress test fires cross-tenant and valid-tenant requests.
 *   Counters track "Isolated" (green) vs "Blocked" (red).
 */

import {
	BaseEdge,
	type Edge,
	EdgeLabelRenderer,
	type EdgeProps,
	getStraightPath,
	type Node,
} from '@xyflow/react';
import { ArrowRight, ShieldCheck, ShieldX } from 'lucide-react';
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

registerLevelCode('act7-level52-multi-tenancy', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ─── Types ────────────────────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';
type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

interface CompanyVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
	color: 'blue' | 'orange';
}

interface TableVizState {
	[key: string]: unknown;
	label: string;
	flash: ZoneFlash;
	sublabel: string | null;
	badge: string | null;
	filterActive: boolean;
}

interface EdgeVizState {
	[key: string]: unknown;
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
}

interface AnimFrame {
	acme?: Partial<CompanyVizState>;
	globex?: Partial<CompanyVizState>;
	table?: Partial<TableVizState>;
	edgeA?: Partial<EdgeVizState>;
	edgeB?: Partial<EdgeVizState>;
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_ACME: CompanyVizState = {
	label: 'Acme Corp',
	flash: 'idle',
	sublabel: 'Tenant A',
	badge: null,
	color: 'blue',
};

const DEFAULT_GLOBEX: CompanyVizState = {
	label: 'Globex Inc',
	flash: 'idle',
	sublabel: 'Tenant B',
	badge: null,
	color: 'orange',
};

const DEFAULT_TABLE: TableVizState = {
	label: 'Products Table',
	flash: 'red',
	sublabel: 'No WHERE clause',
	badge: null,
	filterActive: false,
};

const DEFAULT_EDGE: EdgeVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: '#ef4444',
};

const DEFAULT_ACME_REWARD: CompanyVizState = {
	label: 'Acme Corp',
	flash: 'green',
	sublabel: 'Tenant A (isolated)',
	badge: null,
	color: 'blue',
};

const DEFAULT_GLOBEX_REWARD: CompanyVizState = {
	label: 'Globex Inc',
	flash: 'green',
	sublabel: 'Tenant B (isolated)',
	badge: null,
	color: 'orange',
};

const DEFAULT_TABLE_REWARD: TableVizState = {
	label: 'Products Table',
	flash: 'green',
	sublabel: 'WHERE company_id = ?',
	badge: null,
	filterActive: true,
};

// ─── Discovery definitions ────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'cross-tenant-read', label: 'Company A sees Company B products' },
	{ id: 'cross-tenant-orders', label: 'Company B sees all orders' },
	{ id: 'orphan-record', label: 'Record created without company_id' },
	{ id: 'direct-id-access', label: 'Direct ID bypasses tenant scoping' },
];

// ─── Probe definitions ────────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'list-products-a',
		label: 'List products as Company A',
		command: 'GET /api/v1/products  (as Acme Corp)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Returned 47 products (Acme only has 12).',
				color: 'red',
			},
			{
				text: "35 products belong to Globex Inc, visible to Acme's API key.",
				color: 'red',
			},
			{ text: 'No WHERE company_id clause in the query.', color: 'yellow' },
		],
		story: [
			'Acme Corp calls GET /api/v1/products with their API key.',
			'The controller runs Product.all with no tenant scoping.',
			'47 products returned: 12 from Acme, 35 from Globex.',
			'Acme can see competitor pricing and unreleased products.',
			'No WHERE clause filters by company_id.',
		],
	},
	{
		id: 'list-orders-b',
		label: 'List orders as Company B',
		command: 'GET /api/v1/orders  (as Globex Inc)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Returned 1,203 orders (Globex only has 89).',
				color: 'red',
			},
			{
				text: "1,114 orders belong to Acme Corp, visible to Globex's session.",
				color: 'red',
			},
			{ text: 'Customer PII (names, addresses) exposed.', color: 'red' },
		],
		story: [
			'Globex Inc calls GET /api/v1/orders.',
			'The controller runs Order.all with no tenant scoping.',
			'1,203 orders returned: 89 from Globex, 1,114 from Acme.',
			'Globex sees Acme customer names, addresses, and order totals.',
			'This is a data breach. PII from another tenant is exposed.',
		],
	},
	{
		id: 'create-product-a',
		label: 'Create product without company_id',
		command: 'POST /api/v1/products {name: "Widget", sku: "W-100"}  (as Acme)',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'yellow' },
			{ text: '', color: 'muted' },
			{ text: 'Product created with company_id: NULL.', color: 'red' },
			{
				text: 'Orphan record belongs to no tenant.',
				color: 'red',
			},
			{
				text: 'No automatic company_id assignment on create.',
				color: 'yellow',
			},
		],
		story: [
			'Acme Corp creates a new product via the API.',
			'The controller runs Product.create!(name: "Widget", sku: "W-100").',
			'No company_id is set because the controller does not assign it.',
			'The product is an orphan: it belongs to no company.',
			'It appears in every tenant query (no company_id to filter on).',
		],
	},
	{
		id: 'find-by-id',
		label: 'Access product by ID (wrong tenant)',
		command: 'GET /api/v1/products/42  (as Globex, product belongs to Acme)',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'yellow' },
			{ text: '', color: 'muted' },
			{
				text: 'Product #42 returned (belongs to Acme Corp).',
				color: 'red',
			},
			{
				text: 'Globex accessed it by guessing the ID.',
				color: 'red',
			},
			{ text: 'Product.find(42) has no tenant scope.', color: 'yellow' },
		],
		story: [
			'Globex calls GET /api/v1/products/42.',
			'Product #42 belongs to Acme Corp.',
			'The controller runs Product.find(42) with no tenant check.',
			'Globex gets back Acme product details, pricing, and metadata.',
			'Sequential IDs make it easy to enumerate all products.',
		],
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'list-products-a': ['cross-tenant-read'],
	'list-orders-b': ['cross-tenant-orders'],
	'create-product-a': ['orphan-record'],
	'find-by-id': ['direct-id-access'],
};

// ─── Observe animation frames ─────────────────────────────────────────

const LIST_PRODUCTS_FRAMES: AnimFrame[] = [
	{
		acme: {
			label: 'Acme Corp',
			flash: 'amber',
			sublabel: 'GET /products',
			badge: null,
		},
		table: {
			label: 'Products Table',
			flash: 'idle',
			sublabel: 'SELECT * FROM products',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'GET /products',
			dotColor: '#3b82f6',
		},
	},
	{
		acme: {
			label: 'Acme Corp',
			flash: 'red',
			sublabel: 'Sees 47 products!',
			badge: '35 leaked',
		},
		table: {
			label: 'Products Table',
			flash: 'red',
			sublabel: 'No WHERE clause',
			badge: '47 rows',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '47 products (should be 12)',
			dotColor: '#ef4444',
		},
	},
	{
		acme: { flash: 'idle', sublabel: 'Tenant A', badge: null },
		table: { flash: 'red', sublabel: 'No WHERE clause', badge: null },
		edgeA: { active: false, label: '' },
	},
];

const LIST_ORDERS_FRAMES: AnimFrame[] = [
	{
		globex: {
			label: 'Globex Inc',
			flash: 'amber',
			sublabel: 'GET /orders',
			badge: null,
		},
		table: {
			label: 'Orders Table',
			flash: 'idle',
			sublabel: 'SELECT * FROM orders',
			badge: null,
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'GET /orders',
			dotColor: '#f97316',
		},
	},
	{
		globex: {
			label: 'Globex Inc',
			flash: 'red',
			sublabel: 'Sees 1,203 orders!',
			badge: '1,114 leaked',
		},
		table: {
			label: 'Orders Table',
			flash: 'red',
			sublabel: 'No WHERE clause',
			badge: '1,203 rows',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '1,203 orders (should be 89)',
			dotColor: '#ef4444',
		},
	},
	{
		globex: { flash: 'idle', sublabel: 'Tenant B', badge: null },
		table: { flash: 'red', sublabel: 'No WHERE clause', badge: null },
		edgeB: { active: false, label: '' },
	},
];

const CREATE_PRODUCT_FRAMES: AnimFrame[] = [
	{
		acme: { flash: 'amber', sublabel: 'POST /products', badge: null },
		table: {
			label: 'Products Table',
			flash: 'idle',
			sublabel: 'INSERT INTO products',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'INSERT (no company_id)',
			dotColor: '#3b82f6',
		},
	},
	{
		acme: { flash: 'red', sublabel: 'Orphan created!', badge: 'NULL' },
		table: { flash: 'red', sublabel: 'company_id: NULL', badge: 'Orphan!' },
		edgeA: {
			active: true,
			reverse: true,
			label: '201 Created (orphan)',
			dotColor: '#ef4444',
		},
	},
	{
		acme: { flash: 'idle', sublabel: 'Tenant A', badge: null },
		table: { flash: 'red', sublabel: 'No WHERE clause', badge: null },
		edgeA: { active: false, label: '' },
	},
];

const FIND_BY_ID_FRAMES: AnimFrame[] = [
	{
		globex: { flash: 'amber', sublabel: 'GET /products/42', badge: null },
		table: {
			label: 'Products Table',
			flash: 'idle',
			sublabel: 'SELECT * FROM products WHERE id = 42',
			badge: null,
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'Product.find(42)',
			dotColor: '#f97316',
		},
	},
	{
		globex: {
			flash: 'red',
			sublabel: "Acme's product!",
			badge: 'Wrong tenant',
		},
		table: {
			flash: 'red',
			sublabel: 'No tenant check on find',
			badge: '#42 = Acme',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: 'Returns Acme product to Globex',
			dotColor: '#ef4444',
		},
	},
	{
		globex: { flash: 'idle', sublabel: 'Tenant B', badge: null },
		table: { flash: 'red', sublabel: 'No WHERE clause', badge: null },
		edgeB: { active: false, label: '' },
	},
];

const OBSERVE_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'list-products-a': LIST_PRODUCTS_FRAMES,
	'list-orders-b': LIST_ORDERS_FRAMES,
	'create-product-a': CREATE_PRODUCT_FRAMES,
	'find-by-id': FIND_BY_ID_FRAMES,
};

// ─── Reward animation frames ─────────────────────────────────────────

const REWARD_LIST_A_FRAMES: AnimFrame[] = [
	{
		acme: { flash: 'amber', sublabel: 'GET /products', badge: null },
		table: {
			label: 'Products Table',
			flash: 'idle',
			sublabel: 'WHERE company_id = 1',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'GET /products (scoped)',
			dotColor: '#3b82f6',
		},
	},
	{
		acme: {
			flash: 'green',
			sublabel: '12 products (own only)',
			badge: 'Isolated',
		},
		table: {
			flash: 'green',
			sublabel: 'WHERE company_id = 1',
			badge: '12 rows',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '12 products (Acme only)',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_LIST_B_FRAMES: AnimFrame[] = [
	{
		globex: { flash: 'amber', sublabel: 'GET /orders', badge: null },
		table: {
			label: 'Orders Table',
			flash: 'idle',
			sublabel: 'WHERE company_id = 2',
			badge: null,
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'GET /orders (scoped)',
			dotColor: '#f97316',
		},
	},
	{
		globex: {
			flash: 'green',
			sublabel: '89 orders (own only)',
			badge: 'Isolated',
		},
		table: {
			flash: 'green',
			sublabel: 'WHERE company_id = 2',
			badge: '89 rows',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '89 orders (Globex only)',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_CREATE_FRAMES: AnimFrame[] = [
	{
		acme: { flash: 'amber', sublabel: 'POST /products', badge: null },
		table: {
			label: 'Products Table',
			flash: 'idle',
			sublabel: 'INSERT with company_id = 1',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'INSERT (auto company_id)',
			dotColor: '#3b82f6',
		},
	},
	{
		acme: {
			flash: 'green',
			sublabel: 'Auto-assigned tenant',
			badge: 'company_id = 1',
		},
		table: { flash: 'green', sublabel: 'company_id auto-set', badge: 'Scoped' },
		edgeA: {
			active: true,
			reverse: true,
			label: '201 Created (company_id = 1)',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_CROSS_READ_FRAMES: AnimFrame[] = [
	{
		globex: { flash: 'amber', sublabel: 'GET /products/42', badge: null },
		table: {
			label: 'Products Table',
			flash: 'idle',
			sublabel: 'WHERE company_id = 2 AND id = 42',
			badge: null,
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'Product.find(42) (scoped)',
			dotColor: '#f97316',
		},
	},
	{
		globex: { flash: 'red', sublabel: 'RecordNotFound', badge: 'BLOCKED' },
		table: { flash: 'green', sublabel: 'Tenant filter active', badge: '404' },
		edgeB: {
			active: true,
			reverse: true,
			label: '404 Not Found',
			dotColor: '#ef4444',
		},
	},
];

const REWARD_CROSS_ORDER_FRAMES: AnimFrame[] = [
	{
		acme: { flash: 'amber', sublabel: 'GET /orders (as Acme)', badge: null },
		table: {
			label: 'Orders Table',
			flash: 'idle',
			sublabel: 'WHERE company_id = 1',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'Order.all (scoped)',
			dotColor: '#3b82f6',
		},
	},
	{
		acme: {
			flash: 'green',
			sublabel: '1,114 orders (own only)',
			badge: 'Isolated',
		},
		table: {
			flash: 'green',
			sublabel: 'WHERE company_id = 1',
			badge: '1,114 rows',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: 'Only Acme orders returned',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_NO_TENANT_FRAMES: AnimFrame[] = [
	{
		table: {
			label: 'Products Table',
			flash: 'amber',
			sublabel: 'No tenant set in request',
			badge: null,
		},
	},
	{
		table: {
			flash: 'red',
			sublabel: 'ActsAsTenant::Errors::NoTenantSet',
			badge: 'BLOCKED',
		},
	},
];

const REWARD_SAME_SKU_FRAMES: AnimFrame[] = [
	{
		acme: {
			flash: 'amber',
			sublabel: 'POST /products {sku: "W-100"}',
			badge: null,
		},
		globex: {
			flash: 'amber',
			sublabel: 'POST /products {sku: "W-100"}',
			badge: null,
		},
		table: {
			label: 'Products Table',
			flash: 'idle',
			sublabel: 'Tenant-scoped uniqueness',
			badge: null,
		},
		edgeA: {
			active: true,
			reverse: false,
			label: 'INSERT W-100 (Acme)',
			dotColor: '#3b82f6',
		},
		edgeB: {
			active: true,
			reverse: false,
			label: 'INSERT W-100 (Globex)',
			dotColor: '#f97316',
		},
	},
	{
		acme: { flash: 'green', sublabel: 'SKU W-100 created', badge: 'OK' },
		globex: { flash: 'green', sublabel: 'SKU W-100 created', badge: 'OK' },
		table: {
			flash: 'green',
			sublabel: 'UNIQUE(company_id, sku)',
			badge: 'Both OK',
		},
		edgeA: {
			active: true,
			reverse: true,
			label: '201 Created',
			dotColor: '#22c55e',
		},
		edgeB: {
			active: true,
			reverse: true,
			label: '201 Created',
			dotColor: '#22c55e',
		},
	},
];

const REWARD_PROBE_FRAMES: Record<string, AnimFrame[]> = {
	'list-products-a': REWARD_LIST_A_FRAMES,
	'list-orders-b': REWARD_LIST_B_FRAMES,
	'create-product-a': REWARD_CREATE_FRAMES,
	'cross-tenant-read': REWARD_CROSS_READ_FRAMES,
	'cross-tenant-order': REWARD_CROSS_ORDER_FRAMES,
	'no-tenant-set': REWARD_NO_TENANT_FRAMES,
	'same-sku-tenants': REWARD_SAME_SKU_FRAMES,
};

// ─── Stage inspector data ─────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	acme: {
		stageId: 'acme',
		title: 'Acme Corp (Tenant A)',
		description:
			'B2B customer with 12 products and 1,114 orders. Their API requests should only return their own data. Currently, Product.all and Order.all return records from every company.',
		code: `# Current query (no scoping)
Product.all
# => SELECT * FROM products
# Returns 47 rows (12 Acme + 35 Globex)`,
	},
	globex: {
		stageId: 'globex',
		title: 'Globex Inc (Tenant B)',
		description:
			'B2B customer with 35 products and 89 orders. Their API requests currently return data from all tenants. They can enumerate Acme products by guessing sequential IDs.',
		code: `# Current query (no scoping)
Order.all
# => SELECT * FROM orders
# Returns 1,203 rows (89 Globex + 1,114 Acme)`,
	},
	table: {
		stageId: 'table',
		title: 'Database Tables',
		description:
			'Products and orders tables have a company_id column but nothing enforces it. Queries run without WHERE company_id, new records can be inserted with NULL company_id, and Product.find(id) returns any record regardless of tenant.',
		code: `# Schema
create_table :products do |t|
  t.string :name
  t.string :sku
  t.references :company  # exists but unused
end

# No default_scope, no tenant filter
# No unique index scoped to company_id`,
	},
};

const STAGE_DISCOVERY_MAP: Record<string, string> = {
	table: 'cross-tenant-read',
};

// ─── Stress test scenarios ────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'list-products-a',
		label: 'List products as Company A',
		description: 'GET scoped to Acme (12 products)',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'Acme Corp',
		expectedResult: 'allowed',
	},
	{
		id: 'list-orders-b',
		label: 'List orders as Company B',
		description: 'GET scoped to Globex (89 orders)',
		method: 'GET',
		path: '/api/v1/orders',
		actor: 'Globex Inc',
		expectedResult: 'allowed',
	},
	{
		id: 'create-product-a',
		label: 'Create product (auto-assign tenant)',
		description: 'POST auto-sets company_id from current_tenant',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'Acme Corp',
		expectedResult: 'allowed',
	},
	{
		id: 'cross-tenant-read',
		label: 'Access product from wrong tenant',
		description: 'Globex tries Product.find(42) (belongs to Acme)',
		method: 'GET',
		path: '/api/v1/products/42',
		actor: 'Globex Inc',
		expectedResult: 'blocked',
	},
	{
		id: 'cross-tenant-order',
		label: 'Access orders from wrong tenant',
		description: 'Acme tries to list Globex orders',
		method: 'GET',
		path: '/api/v1/orders?company=globex',
		actor: 'Acme Corp',
		expectedResult: 'blocked',
	},
	{
		id: 'no-tenant-set',
		label: 'Request with no tenant set',
		description: 'API call without X-Tenant header',
		method: 'GET',
		path: '/api/v1/products',
		actor: 'anonymous',
		expectedResult: 'blocked',
	},
	{
		id: 'same-sku-tenants',
		label: 'Same SKU in different tenants',
		description: 'Both tenants create sku "W-100" (allowed)',
		method: 'POST',
		path: '/api/v1/products',
		actor: 'both tenants',
		expectedResult: 'allowed',
	},
];

// ─── Build step definitions ───────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'add-gem', title: 'Add acts_as_tenant Gem' },
	{ id: 'add-migration', title: 'Add Migration' },
	{ id: 'set-tenant', title: 'Set Current Tenant' },
	{ id: 'scope-product', title: 'Scope Product Model' },
	{ id: 'scope-order', title: 'Scope Order Model' },
	{ id: 'scoped-index', title: 'Tenant-Scoped Index' },
];

const STEP_TYPES: ('terminal' | 'option')[] = [
	'terminal', // 0: bundle add acts_as_tenant
	'terminal', // 1: rails generate migration
	'option', // 2: set current tenant
	'option', // 3: scope Product
	'option', // 4: scope Order
	'option', // 5: scoped unique index
];

// ─── Step 0: Add gem (Terminal) ──────────────────────────────────────

const addGemCommands: TerminalCommand[] = [
	{
		id: 'wrong-apartment',
		label: 'bundle add apartment',
		command: 'bundle add apartment',
		correct: false,
		feedback:
			'Apartment uses schema-per-tenant isolation. For shared-database row-level scoping with automatic WHERE clauses, a different gem is more appropriate.',
	},
	{
		id: 'correct',
		label: 'bundle add acts_as_tenant',
		command: 'bundle add acts_as_tenant',
		correct: true,
	},
	{
		id: 'wrong-multi-tenant',
		label: 'gem install multi_tenant',
		command: 'gem install multi_tenant',
		correct: false,
		feedback:
			'That installs system-wide, not into your project. Use bundle add to add it to the Gemfile.',
	},
];

const addGemOutput: TerminalOutputLine[] = [
	{ text: 'Fetching acts_as_tenant 1.0.0', color: 'cyan' },
	{ text: 'Installing acts_as_tenant 1.0.0', color: 'muted' },
	{ text: 'Bundle complete! 14 Gemfile dependencies.', color: 'green' },
];

// ─── Step 1: Add migration (Terminal) ────────────────────────────────

const addMigrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-add-tenant-id',
		label: 'rails generate migration AddTenantIdToProducts tenant_id:integer',
		command: 'rails generate migration AddTenantIdToProducts tenant_id:integer',
		correct: false,
		feedback:
			'A plain integer column misses the foreign key and index. Use references to get the foreign key constraint and index automatically.',
	},
	{
		id: 'wrong-no-table',
		label: 'rails generate migration AddCompany',
		command: 'rails generate migration AddCompany',
		correct: false,
		feedback:
			'This migration has no target table or column type. Specify which table gets the company reference.',
	},
	{
		id: 'correct',
		label: 'rails generate migration AddCompanyToProducts company:references',
		command: 'rails generate migration AddCompanyToProducts company:references',
		correct: true,
	},
];

const addMigrationOutput: TerminalOutputLine[] = [
	{
		text: 'create db/migrate/20260330_add_company_to_products.rb',
		color: 'green',
	},
	{
		text: 'add_reference :products, :company, foreign_key: true',
		color: 'cyan',
	},
];

// ─── OptionCard step options ──────────────────────────────────────────

interface StepOption {
	id: string;
	name: string;
	correct: boolean;
	feedback?: string;
}

const SET_TENANT_OPTIONS: StepOption[] = [
	{
		id: 'wrong-before-action',
		name: 'before_action :set_company\n\ndef set_company\n  @company = Company.find(params[:company_id])\nend',
		correct: false,
		feedback:
			'A manual instance variable does not automatically scope queries. The gem needs to know the current tenant to inject WHERE clauses on every query.',
	},
	{
		id: 'wrong-default-scope',
		name: 'default_scope { where(company: Current.company) }',
		correct: false,
		feedback:
			'Default scopes are brittle and can be bypassed with unscoped. The tenant gem provides a safer, thread-safe approach that cannot be accidentally removed.',
	},
	{
		id: 'correct',
		name: 'set_current_tenant_through_filter\nbefore_action :set_tenant\n\ndef set_tenant\n  current_tenant = Company.find_by!(\n    subdomain: request.subdomains.first\n  )\n  set_current_tenant(current_tenant)\nend',
		correct: true,
	},
];

const SCOPE_PRODUCT_OPTIONS: StepOption[] = [
	{
		id: 'wrong-belongs-to',
		name: 'belongs_to :company',
		correct: false,
		feedback:
			'belongs_to defines the association but does not add automatic query scoping. Every Product.all would still return records from all companies.',
	},
	{
		id: 'correct',
		name: 'acts_as_tenant :company',
		correct: true,
	},
	{
		id: 'wrong-default-scope',
		name: 'default_scope { where(company_id: ActsAsTenant.current_tenant) }',
		correct: false,
		feedback:
			'Manual default_scope misses auto-assignment on create, find-by-ID protection, and can be bypassed with unscoped. The gem handles all of this.',
	},
];

const SCOPE_ORDER_OPTIONS: StepOption[] = [
	{
		id: 'wrong-validates',
		name: 'validates :company_id, presence: true',
		correct: false,
		feedback:
			'Validation ensures presence but does not scope queries. Order.all would still return records from every company.',
	},
	{
		id: 'wrong-scope',
		name: 'scope :for_tenant, ->(c) { where(company: c) }',
		correct: false,
		feedback:
			'A named scope requires every caller to remember to use it. One missed .for_tenant call causes a data leak. Automatic scoping is safer.',
	},
	{
		id: 'correct',
		name: 'acts_as_tenant :company',
		correct: true,
	},
];

const SCOPED_INDEX_OPTIONS: StepOption[] = [
	{
		id: 'wrong-global-unique',
		name: 'add_index :products, :sku, unique: true',
		correct: false,
		feedback:
			'A global unique index means two tenants cannot use the same SKU. Each tenant should have their own namespace for SKUs.',
	},
	{
		id: 'correct',
		name: 'add_index :products, [:company_id, :sku],\n  unique: true',
		correct: true,
	},
	{
		id: 'wrong-no-unique',
		name: 'add_index :products, [:company_id, :sku]',
		correct: false,
		feedback:
			'Without the unique constraint, duplicate SKUs within the same tenant are allowed. The index should enforce uniqueness per tenant.',
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; options: StepOption[] }
> = {
	2: {
		title: 'Set Current Tenant',
		description:
			'The gem is installed and the migration is ready. Now the application controller needs to identify the current tenant on every request and tell the gem which company is active.',
		options: SET_TENANT_OPTIONS,
	},
	3: {
		title: 'Scope Product Model',
		description:
			'The controller sets the current tenant. Now the Product model needs to be scoped so every query automatically includes a WHERE company_id clause and new records get company_id auto-assigned.',
		options: SCOPE_PRODUCT_OPTIONS,
	},
	4: {
		title: 'Scope Order Model',
		description:
			'Products are scoped. Orders also contain sensitive data (customer PII, addresses, totals). Apply the same tenant scoping to the Order model.',
		options: SCOPE_ORDER_OPTIONS,
	},
	5: {
		title: 'Add Tenant-Scoped Unique Index',
		description:
			'SKUs should be unique within each tenant, but different tenants should be able to use the same SKU. What database index enforces uniqueness per tenant?',
		options: SCOPED_INDEX_OPTIONS,
	},
};

// ─── Terminal step map for history ────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: addGemCommands, outputLines: addGemOutput },
	{ commands: addMigrationCommands, outputLines: addMigrationOutput },
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
				filename: 'app/controllers/api/v1/products_controller.rb',
				language: 'ruby',
				code: `class Api::V1::ProductsController < ApplicationController
  def index
    result = Products::ListService.call(params:)
    render json: ProductSerializer.new(result.products)
      .serializable_hash
  end
end`,
				highlight: [3],
			},
			{
				filename: 'app/services/products/list_service.rb',
				language: 'ruby',
				code: `class Products::ListService < ApplicationService
  def call(params:)
    products = Product.all
    # No tenant scoping: returns ALL rows
    # Product.find(id) ignores company_id
    Result.new(products:)
  end
end`,
				highlight: [3, 4, 5],
			},
			{
				filename: 'app/models/product.rb',
				language: 'ruby',
				code: `class Product < ApplicationRecord
  belongs_to :company
  # No tenant scoping at the model layer
end`,
				highlight: [3],
			},
			{
				filename: 'app/controllers/application_controller.rb',
				language: 'ruby',
				code: `class ApplicationController < ActionController::API
  # No tenant identification
  # No automatic query scoping
  # Each request sees ALL data
end`,
				highlight: [2, 3, 4],
			},
		];
	}

	const files = [];

	if (completedStep >= 0) {
		files.push({
			filename: 'Gemfile',
			language: 'ruby',
			code: `gem "rails", "~> 8.0.0"
gem "acts_as_tenant"`,
			highlight: [2],
		});
	}

	if (completedStep >= 1) {
		files.push({
			filename: 'db/migrate/add_company_to_products.rb',
			language: 'ruby',
			code: `class AddCompanyToProducts < ActiveRecord::Migration[8.0]
  def change
    add_reference :products, :company, foreign_key: true
  end
end`,
			highlight: [3],
		});
	}

	if (completedStep >= 2) {
		files.push({
			filename: 'app/controllers/application_controller.rb',
			language: 'ruby',
			code: `class ApplicationController < ActionController::API
  set_current_tenant_through_filter
  before_action :set_tenant

  private

  def set_tenant
    current_tenant = Company.find_by!(
      subdomain: request.subdomains.first
    )
    set_current_tenant(current_tenant)
  end
end`,
			highlight: [2, 3, 8, 9, 10, 11],
		});
	}

	if (completedStep >= 3) {
		const hasOrderScope = completedStep >= 4;
		const hasScopedIndex = completedStep >= 5;
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  acts_as_tenant :company

  validates :name, presence: true
  validates :sku, uniqueness: { scope: :company_id }
end`,
			highlight: [2],
		});
		files.push({
			filename: 'app/services/products/list_service.rb',
			language: 'ruby',
			code: `class Products::ListService < ApplicationService
  def call(params:)
    # acts_as_tenant auto-scopes Product.all
    # to current tenant, no code changes needed
    products = Product.all
    Result.new(products:)
  end
end`,
			highlight: [3, 4],
		});
		files.push({
			filename: 'app/controllers/api/v1/products_controller.rb',
			language: 'ruby',
			code: `class Api::V1::ProductsController < ApplicationController
  def index
    result = Products::ListService.call(params:)
    render json: ProductSerializer.new(result.products)
      .serializable_hash
  end
end`,
			highlight: [],
		});
		if (hasOrderScope) {
			files.push({
				filename: 'app/models/order.rb',
				language: 'ruby',
				code: `class Order < ApplicationRecord
  acts_as_tenant :company

  has_many :line_items
  belongs_to :customer
end`,
				highlight: [2],
			});
		}
		if (hasScopedIndex) {
			files.push({
				filename: 'db/migrate/add_scoped_index.rb',
				language: 'ruby',
				code: `class AddScopedIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :products, [:company_id, :sku],
      unique: true
  end
end`,
				highlight: [3, 4],
			});
		}
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

const CompanyNode = memo(function CompanyNode({
	data,
}: {
	data: CompanyVizState;
}) {
	const isBlue = data.color === 'blue';
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'CO',
		color: isBlue ? '#3b82f6' : '#f97316',
		description: data.sublabel ?? undefined,
		status: flashToStatus(data.flash),
		showTarget: false,
		showSource: false,
	};
	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.badge && (
				<div
					className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-mono ${
						data.flash === 'green'
							? 'bg-success/20 text-success'
							: data.flash === 'red'
								? 'bg-destructive/20 text-destructive'
								: isBlue
									? 'bg-blue-500/20 text-blue-500'
									: 'bg-orange-500/20 text-orange-500'
					}`}
				>
					{data.badge}
				</div>
			)}
		</FlowNode>
	);
});

const TableNode = memo(function TableNode({ data }: { data: TableVizState }) {
	const flowData: FlowNodeData = {
		label: data.label,
		icon: 'TB',
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
				<div
					className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-mono ${
						data.flash === 'green'
							? 'bg-success/20 text-success'
							: 'bg-destructive/20 text-destructive'
					}`}
				>
					{data.badge}
				</div>
			)}
			{data.filterActive && (
				<div className="mt-1 flex items-center justify-center gap-1 text-xs text-success">
					<ShieldCheck className="w-3 h-3" />
					Tenant filter active
				</div>
			)}
		</FlowNode>
	);
});

// ─── Custom edge ──────────────────────────────────────────────────────

const TenantEdge = memo(function TenantEdge(props: EdgeProps) {
	const { id, sourceX, sourceY, targetX, targetY, data } = props;
	const d = (data ?? DEFAULT_EDGE) as EdgeVizState;

	const [edgePath, labelX, labelY] = getStraightPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
	});

	const dotPath = d.reverse
		? `M${targetX},${targetY} L${sourceX},${sourceY}`
		: edgePath;
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
						className="nodrag nopan pointer-events-none absolute text-[10px] font-mono text-foreground bg-background/90 px-1.5 py-0.5 rounded border border-border max-w-64 text-center whitespace-nowrap"
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

const tenantNodeTypes = {
	company: CompanyNode,
	table: TableNode,
};
const tenantEdgeTypes = { tenant: TenantEdge };

// ─── Main component ───────────────────────────────────────────────────

export function Level52MultiTenancy({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const isReward = phase === 'reward';

	// ── Viz state ──
	const [acmeState, setAcmeState] = useState<CompanyVizState>(DEFAULT_ACME);
	const [globexState, setGlobexState] =
		useState<CompanyVizState>(DEFAULT_GLOBEX);
	const [tableState, setTableState] = useState<TableVizState>(DEFAULT_TABLE);
	const [edgeAState, setEdgeAState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [edgeBState, setEdgeBState] = useState<EdgeVizState>(DEFAULT_EDGE);
	const [vizAnimating, setVizAnimating] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const resetViz = useCallback(() => {
		setAcmeState(isReward ? DEFAULT_ACME_REWARD : DEFAULT_ACME);
		setGlobexState(isReward ? DEFAULT_GLOBEX_REWARD : DEFAULT_GLOBEX);
		setTableState(isReward ? DEFAULT_TABLE_REWARD : DEFAULT_TABLE);
		setEdgeAState(DEFAULT_EDGE);
		setEdgeBState(DEFAULT_EDGE);
	}, [isReward]);

	const applyFrame = useCallback((frame: AnimFrame) => {
		if (frame.acme) setAcmeState((prev) => ({ ...prev, ...frame.acme }));
		if (frame.globex) setGlobexState((prev) => ({ ...prev, ...frame.globex }));
		if (frame.table) setTableState((prev) => ({ ...prev, ...frame.table }));
		if (frame.edgeA) setEdgeAState((prev) => ({ ...prev, ...frame.edgeA }));
		if (frame.edgeB) setEdgeBState((prev) => ({ ...prev, ...frame.edgeB }));
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
		return [
			{
				id: 'acme',
				type: 'company',
				position: { x: 80, y: 20 },
				data: acmeState,
			},
			{
				id: 'globex',
				type: 'company',
				position: { x: 420, y: 20 },
				data: globexState,
			},
			{
				id: 'table',
				type: 'table',
				position: { x: 230, y: 220 },
				data: tableState,
			},
		];
	}, [acmeState, globexState, tableState]);

	const flowEdges: Edge[] = useMemo(() => {
		return [
			{
				id: 'edgeA',
				source: 'acme',
				target: 'table',
				type: 'tenant',
				data: edgeAState,
			},
			{
				id: 'edgeB',
				source: 'globex',
				target: 'table',
				type: 'tenant',
				data: edgeBState,
			},
		];
	}, [edgeAState, edgeBState]);

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
				'Multi-tenancy configured! Every query is scoped to the current tenant.',
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
							edgeTypes={tenantEdgeTypes}
							nodes={flowNodes}
							nodeTypes={tenantNodeTypes}
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
							title="Tenant Isolation Probe"
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
						{/* Step 0: Terminal (add gem) */}
						{currentStepType === 'terminal' && stepper.currentStep === 0 && (
							<TerminalChoiceStep
								commands={addGemCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										Queries return data from all tenants. Add a gem that
										automatically scopes every query with a WHERE clause for the
										current tenant.
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
								outputLines={addGemOutput}
								stepKey={stepper.currentStep}
								title="Add Tenant Scoping Gem"
							/>
						)}
						{/* Step 1: Terminal (add migration) */}
						{currentStepType === 'terminal' && stepper.currentStep === 1 && (
							<TerminalChoiceStep
								commands={addMigrationCommands}
								completed={isViewingCompletedStep}
								description={
									<p className="text-sm text-muted-foreground">
										The gem is installed. Now generate a migration to add a
										company reference to the products table so each row can be
										associated with a tenant.
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
								outputLines={addMigrationOutput}
								stepKey={stepper.currentStep}
								title="Add Company Reference Migration"
							/>
						)}

						{/* OptionCard steps (2-5) */}
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
						edgeTypes={tenantEdgeTypes}
						nodes={flowNodes}
						nodeTypes={tenantNodeTypes}
					/>
				</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
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
							Company A can see Company B's products and orders. The API returns
							data from all tenants with no scoping. Customer PII, pricing, and
							order details are exposed across companies.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Every query must be automatically scoped to the current tenant so
							each company only sees their own data.
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

					{/* Reward: isolation counters */}
					{phase === 'reward' && (
						<>
							<div className="p-4 border-b border-border">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Isolation Legend
								</div>
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<ShieldCheck className="w-4 h-4 text-success" />
										<span className="text-foreground">
											Tenant-scoped request (isolated)
										</span>
									</div>
									<div className="flex items-center gap-2">
										<ShieldX className="w-4 h-4 text-destructive" />
										<span className="text-foreground">
											Cross-tenant request (blocked)
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
										<div className="text-xs text-success/70">Isolated</div>
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
					levelName="Multi-Tenancy"
					levelNumber={50}
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
					learningGoal="acts_as_tenant automatically adds WHERE company_id = ? to every query, auto-assigns company_id on create, and raises RecordNotFound when accessing records from another tenant. Combined with a tenant-scoped unique index, each company gets full data isolation in a shared database."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level52MultiTenancy;
