/**
 * Level 8: Associations
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration. Click pipeline stages to
 *   inspect code, fire API probes to discover that products are isolated with no
 *   way to attach reviews. Discovery gating controls when "Build the Fix" appears.
 * Phase 2 (HOW - build): 6 steps (3 terminal + 1 informational + 2 OptionCard)
 *   Step 0: Generate Review model with product:references (terminal)
 *   Step 1: Run migration (terminal)
 *   Step 2: Choose relationship type for Product model (OptionCard)
 *   Step 3: Auto belongs_to explanation (informational, "Got It" button)
 *   Step 4: Set dependent option (OptionCard)
 *   Step 5: Test the association in Rails console (terminal, irb> prompt)
 * Phase 3 (ADVANTAGE - reward): Stress test. Fire request scenarios at the
 *   associated pipeline and watch create/cascade results.
 *
 * Teaches: has_many, belongs_to, dependent: :destroy, product:references
 */

import { ArrowRight, Check, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
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
	type PipelineConnection,
	PipelineFlow,
	type PipelineStage,
} from '@/components/levels/PipelineFlow';
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
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';

registerLevelCode('act1-level8-associations', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'no-review-model', label: 'Review model does not exist' },
	{ id: 'no-association', label: 'Product has no associations defined' },
	{ id: 'isolated-products', label: 'Products exist in isolation' },
	{ id: 'no-nested-routes', label: 'No nested routes for reviews' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'get-reviews',
		label: 'GET reviews',
		story: [
			'A customer wants to read reviews for a product before buying it.',
			'The frontend sends GET /api/v1/products/1/reviews.',
			'The router looks for a nested reviews route under products.',
			'No nested routes exist. Products are defined in isolation.',
			'The request returns a 404. There is no way to access reviews through the API.',
		],
		command: 'GET /api/v1/products/1/reviews',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No route matches GET "/api/v1/products/1/reviews"',
				color: 'yellow',
			},
			{
				text: 'Products exist in isolation. No review routes defined.',
				color: 'red',
			},
		],
	},
	{
		id: 'post-review',
		label: 'POST review',
		story: [
			'A customer finishes reading a product page and wants to leave a review.',
			'They submit a POST to /api/v1/products/1/reviews with their feedback.',
			'The router has no matching route for this path.',
			'Beyond routing, no Review model exists in the application at all.',
			'The request fails with a 404. Reviews cannot be created or stored.',
		],
		command: 'POST /api/v1/products/1/reviews (body: "Great post!")',
		responseLines: [
			{ text: 'HTTP/1.1 404 Not Found', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'No route matches POST "/api/v1/products/1/reviews"',
				color: 'yellow',
			},
			{
				text: 'No Review model or association exists.',
				color: 'red',
			},
		],
	},
	{
		id: 'console-reviews',
		label: 'Rails console',
		story: [
			'A developer opens the Rails console to debug the missing reviews.',
			'They run Product.first.reviews to check if the association exists.',
			'Rails raises a NoMethodError: Product has no "reviews" method.',
			'The Product model has no has_many :reviews declaration.',
			'Without an association, Rails cannot link products to their reviews.',
		],
		command: 'rails console: Product.first.reviews',
		responseLines: [
			{ text: "NoMethodError: undefined method `reviews'", color: 'red' },
			{ text: 'for #<Product id: 1, name: "Laptop Pro">', color: 'muted' },
			{ text: '', color: 'muted' },
			{
				text: 'Product has no "reviews" method. No association is defined.',
				color: 'yellow',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'get-reviews': 'isolated-products',
	'post-review': 'no-review-model',
	'console-reviews': 'no-association',
};

// Map probe IDs to pipeline node display during observe
const PROBE_PIPELINE_MAP: Record<
	string,
	{ modelSublabel: string; modelBadge: string }
> = {
	'get-reviews': {
		modelSublabel: 'No .reviews method',
		modelBadge: '404!',
	},
	'post-review': {
		modelSublabel: 'No Review model',
		modelBadge: '404!',
	},
	'console-reviews': {
		modelSublabel: 'NoMethodError',
		modelBadge: 'ERROR',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	request: {
		stageId: 'request',
		title: 'Incoming Request',
		description:
			'HTTP request targeting reviews on a product. The request expects nested resources at /products/:id/reviews.',
	},
	router: {
		stageId: 'router',
		title: 'Router',
		description:
			'Routes only define `resources :products`. There are no nested routes for reviews. Add `resources :reviews` inside the products block to create /products/:id/reviews.',
		code: `# config/routes.rb
namespace :api do
  namespace :v1 do
    resources :products
    # No nested routes!
  end
end`,
	},
	controller: {
		stageId: 'controller',
		title: 'ProductsController',
		description:
			'ProductsController handles product CRUD. No ReviewsController exists yet.',
	},
	model: {
		stageId: 'model',
		title: 'Product Model (Isolated)',
		description:
			'Product model has name, description, price but no associations. Each model is isolated. Rails associations (has_many, belongs_to) link models and provide query methods like `product.reviews`.',
		code: `class Product < ApplicationRecord
  # No associations defined
end`,
	},
	serializer: {
		stageId: 'serializer',
		title: 'Serializer (from Level 7)',
		description:
			'ProductSerializer shapes output into JSON:API format. Once associations are added, the serializer can include nested review data in the response.',
	},
	response: {
		stageId: 'response',
		title: 'Response',
		description: '404 for all review-related requests.',
	},
};

// Map stage IDs to discovery IDs they trigger
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	model: 'no-review-model',
	router: 'no-nested-routes',
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'create-review',
		label: 'Create review on product',
		description: 'Add a new review through the association',
		method: 'POST',
		path: '/api/v1/products/1/reviews',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'list-reviews',
		label: 'List product reviews',
		description: 'Fetch all reviews for a specific product',
		method: 'GET',
		path: '/api/v1/products/1/reviews',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'delete-product-cascade',
		label: 'Delete product (cascade)',
		description: 'Delete a product and cascade-destroy its reviews',
		method: 'DELETE',
		path: '/api/v1/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'get-product-with-reviews',
		label: 'Show product with reviews',
		description: 'Fetch a product with its nested reviews',
		method: 'GET',
		path: '/api/v1/products/1',
		actor: 'client',
		expectedResult: 'allowed',
	},
	{
		id: 'review-invalid-product',
		label: 'Review on missing product',
		description: 'Try to create a review on a non-existent product',
		method: 'POST',
		path: '/api/v1/products/999/reviews',
		actor: 'client',
		expectedResult: 'blocked',
	},
];

// ──────────────────────────────────────────────
// Step definitions (6 steps: 3 terminal + 1 info + 2 OptionCard)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-review', title: 'Generate Review' },
	{ id: 'run-migration', title: 'Run Migration' },
	{ id: 'choose-relationship', title: 'Choose Relationship' },
	{ id: 'auto-belongs-to', title: 'Auto belongs_to' },
	{ id: 'set-dependent', title: 'Set Dependent' },
	{ id: 'test-it', title: 'Test It' },
];

// Step type indexed by step number
const STEP_TYPES: ('terminal' | 'option' | 'info')[] = [
	'terminal', // 0: generate model
	'terminal', // 1: run migration
	'option', // 2: choose relationship
	'info', // 3: auto belongs_to
	'option', // 4: set dependent
	'terminal', // 5: test it
];

// ──────────────────────────────────────────────
// Step 0: Generate Review model (Terminal)
// ──────────────────────────────────────────────

const generateCommands: TerminalCommand[] = [
	{
		id: 'wrong-integer',
		label: 'rails generate model Review body:text product_id:integer',
		command: 'rails generate model Review body:text product_id:integer',
		correct: false,
		feedback:
			'Adding an integer column only gives you the column. You miss the automatic index, foreign key, and model association. There is a better field type for linking models.',
	},
	{
		id: 'correct',
		label: 'rails generate model Review body:text product:references',
		command: 'rails generate model Review body:text product:references',
		correct: true,
	},
	{
		id: 'wrong-missing-product',
		label: 'rails generate model Review body:text',
		command: 'rails generate model Review body:text',
		correct: false,
		feedback:
			'Without a field that links Review to Product, there is no relationship. You need to declare the connection in the generator.',
	},
];

const generateOutput: TerminalOutputLine[] = [
	{ text: '      invoke  active_record', color: 'green' },
	{
		text: '      create    db/migrate/20240101000001_create_reviews.rb',
		color: 'green',
	},
	{ text: '      create    app/models/review.rb', color: 'green' },
	{ text: '      invoke    test_unit', color: 'muted' },
];

// ──────────────────────────────────────────────
// Step 1: Run Migration (Terminal)
// ──────────────────────────────────────────────

const migrateCommands: TerminalCommand[] = [
	{
		id: 'wrong-schema',
		label: 'rails db:schema:dump',
		command: 'rails db:schema:dump',
		correct: false,
		feedback:
			'That dumps the current schema to a file. It does not apply pending migrations.',
	},
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'That populates the database with seed data. The reviews table does not exist yet.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
];

const migrateOutput: TerminalOutputLine[] = [
	{
		text: '== CreateReviews: migrating =============================',
		color: 'muted',
	},
	{
		text: '-- create_table(:reviews)',
		color: 'green',
	},
	{
		text: '   -> 0.0042s',
		color: 'muted',
	},
	{
		text: '== CreateReviews: migrated (0.0043s) ====================',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// Step 5: Test It (Terminal, irb> prompt)
// ──────────────────────────────────────────────

const testCommands: TerminalCommand[] = [
	{
		id: 'wrong-orphan',
		label: 'Review.create(body: "Nice!")',
		command: 'Review.create(body: "Nice!")',
		correct: false,
		feedback:
			'This creates an orphaned Review with no product_id. Use the association method on the parent object instead.',
	},
	{
		id: 'wrong-manual',
		label: 'Review.create(body: "Nice!", product_id: product.id)',
		command: 'Review.create(body: "Nice!", product_id: product.id)',
		correct: false,
		feedback:
			'This works but bypasses the association. Rails provides a cleaner way to create through the parent object.',
	},
	{
		id: 'correct',
		label: 'product.reviews.create(body: "Nice!")',
		command: 'product.reviews.create(body: "Nice!")',
		correct: true,
	},
];

const testOutput: TerminalOutputLine[] = [
	{
		text: '=> #<Review id: 1, body: "Nice!", product_id: 1>',
		color: 'green',
	},
];

// ──────────────────────────────────────────────
// OptionCard step data type
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

// ──────────────────────────────────────────────
// Terminal step map (for buildTerminalHistory)
// ──────────────────────────────────────────────

const SHELL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: generateCommands, outputLines: generateOutput },
	{ commands: migrateCommands, outputLines: migrateOutput },
	null, // step 2: OptionCard (choose relationship)
	null, // step 3: info (auto belongs_to)
	null, // step 4: OptionCard (set dependent)
];

const CONSOLE_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: testCommands, outputLines: testOutput },
];

// ──────────────────────────────────────────────
// Step 2: Choose Relationship (OptionCard)
// ──────────────────────────────────────────────

const RELATIONSHIP_OPTIONS: StepOption[] = [
	{
		id: 'has_one',
		label: 'has_one :reviews',
		correct: false,
		feedback:
			'"has_one" limits the parent to a single child record. Products should be able to have unlimited reviews.',
	},
	{
		id: 'belongs_to',
		label: 'belongs_to :reviews',
		correct: false,
		feedback:
			'"belongs_to" goes on the child side (Review). The parent needs a different declaration to express a one-to-many relationship.',
	},
	{
		id: 'has_many',
		label: 'has_many :reviews',
		correct: true,
	},
	{
		id: 'habtm',
		label: 'has_and_belongs_to_many :reviews',
		correct: false,
		feedback:
			'"has_and_belongs_to_many" creates a many-to-many relationship. Reviews belong to one product, not shared across many.',
	},
];

// ──────────────────────────────────────────────
// Step 4: Set Dependent (OptionCard)
// ──────────────────────────────────────────────

const DEPENDENT_OPTIONS: StepOption[] = [
	{
		id: 'nothing',
		label: 'No dependent option',
		correct: false,
		feedback:
			'Orphaned reviews would break your API. You need to specify what happens to child records when the parent is deleted.',
	},
	{
		id: 'nullify',
		label: 'dependent: :nullify',
		correct: false,
		feedback:
			'Orphaned reviews with NULL product_id would break your API. You need a strategy that removes them entirely.',
	},
	{
		id: 'restrict',
		label: 'dependent: :restrict_with_error',
		correct: false,
		feedback:
			'For a product API, cleaning up reviews on delete is better than preventing deletion entirely.',
	},
	{
		id: 'destroy',
		label: 'dependent: :destroy',
		correct: true,
	},
];

// Map from step index -> OptionCard data for option-type steps
const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	2: {
		title: 'Choose Relationship',
		description:
			'A Product _____ Reviews. What relationship type goes in the Product model?',
		options: RELATIONSHIP_OPTIONS,
	},
	4: {
		title: 'Set Dependent',
		description:
			'When a Product is destroyed, what should happen to its reviews?',
		options: DEPENDENT_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Hub layout positions (Controller is the hub)
// ──────────────────────────────────────────────

const HUB_POS = {
	serializer: { x: 500, y: -180 },
	model: { x: 500, y: 180 },
	database: { x: 500, y: 360 },
} as const;

// ──────────────────────────────────────────────
// Pipeline visualization configs
// ──────────────────────────────────────────────

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'mixed' },
	{ from: 'router', to: 'controller', dots: 'mixed' },
	{ from: 'controller', to: 'response', dots: 'mixed' },
	{
		from: 'controller',
		to: 'model',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'mixed',
	},
	{
		from: 'model',
		to: 'database',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'mixed',
	},
	{
		from: 'controller',
		to: 'serializer',
		sourceHandle: 'top',
		targetHandle: 'bottom',
		bidirectional: true,
		dots: 'mixed',
	},
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{ from: 'request', to: 'router', dots: 'clean' },
	{ from: 'router', to: 'controller', dots: 'clean' },
	{ from: 'controller', to: 'response', dots: 'clean' },
	{
		from: 'controller',
		to: 'model',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'clean',
	},
	{
		from: 'model',
		to: 'database',
		sourceHandle: 'bottom',
		targetHandle: 'top',
		bidirectional: true,
		dots: 'clean',
	},
	{
		from: 'controller',
		to: 'serializer',
		sourceHandle: 'top',
		targetHandle: 'bottom',
		bidirectional: true,
		dots: 'clean',
	},
];

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the Product model with no associations
	if (phase === 'observe') {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  # No associations defined
  # Products exist in isolation
end`,
			highlight: [2, 3],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  # No associations yet
end`,
			highlight: [],
		});
	}

	if (furthestStep >= 1) {
		// After step 0: migration file from generator
		files.push({
			filename: 'db/migrate/create_reviews.rb',
			language: 'ruby',
			code: `class CreateReviews < ActiveRecord::Migration[8.0]
  def change
    create_table :reviews do |t|
      t.text :body
      t.references :product, null: false, foreign_key: true

      t.timestamps
    end
  end
end`,
			highlight: [5],
		});
	}

	if (furthestStep >= 2) {
		// After step 1: Review model with belongs_to (auto-generated)
		files.push({
			filename: 'app/models/review.rb',
			language: 'ruby',
			code: `class Review < ApplicationRecord
  belongs_to :product
end`,
			highlight: [2],
		});
	}

	if (furthestStep >= 3) {
		// After step 2: Product model with has_many
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code:
				furthestStep >= 5
					? `class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy
end`
					: `class Product < ApplicationRecord
  has_many :reviews
end`,
			highlight: [2],
		});
	} else if (furthestStep >= 1) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: `class Product < ApplicationRecord
  # No associations yet
end`,
			highlight: [],
		});
	}

	if (furthestStep >= 6) {
		// After step 5 (test): show the console output
		files.push({
			filename: 'Rails Console',
			language: 'ruby',
			code: `product = Product.first
product.reviews.create(body: "Nice!")
# => #<Review id: 1, body: "Nice!", product_id: 1>

product.reviews.count
# => 1`,
			highlight: [2, 3],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Pipeline Legend (reward phase)
// ──────────────────────────────────────────────

function PipelineLegend() {
	return (
		<div className="p-4 border-b border-border">
			<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
				Pipeline Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Successful request (passes)</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Failed request (blocked)</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level8Associations({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: 3,
	});
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [phase, setPhase] = useState<Phase>('observe');
	const [inspectorData, setInspectorData] = useState<StageInspectorData | null>(
		null,
	);
	const [inspectedStages, setInspectedStages] = useState<Set<string>>(
		new Set(),
	);
	const [lastProbeId, setLastProbeId] = useState<string | null>(null);

	// ── Build observe stages dynamically (tracks inspected + last probe) ──
	const probeDisplay = lastProbeId ? PROBE_PIPELINE_MAP[lastProbeId] : null;
	const observeStages: PipelineStage[] = useMemo(
		() => [
			{
				id: 'request',
				label: 'Request',
				inspectable: true,
				inspected: inspectedStages.has('request'),
			},
			{
				id: 'router',
				label: 'Router',
				variant: 'active' as const,
				inspectable: true,
				inspected: inspectedStages.has('router'),
			},
			{
				id: 'controller',
				label: 'Controller',
				variant: 'active' as const,
				inspectable: true,
				inspected: inspectedStages.has('controller'),
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: probeDisplay ? '404' : undefined,
				variant: (probeDisplay ? 'danger' : 'default') as 'danger' | 'default',
				inspectable: true,
				inspected: inspectedStages.has('response'),
			},
			{
				id: 'serializer',
				label: 'Serializer',
				position: HUB_POS.serializer,
				variant: 'active' as const,
				inspectable: true,
				inspected: inspectedStages.has('serializer'),
			},
			{
				id: 'model',
				label: 'Model',
				position: HUB_POS.model,
				sublabel: probeDisplay ? probeDisplay.modelSublabel : 'No associations',
				badge: probeDisplay ? probeDisplay.modelBadge : undefined,
				variant: (probeDisplay ? 'danger' : 'inactive') as
					| 'danger'
					| 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('model'),
			},
			{
				id: 'database',
				label: 'Database',
				position: HUB_POS.database,
				variant: 'active' as const,
			},
		],
		[inspectedStages, probeDisplay],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];
	const lastScenario = lastResult
		? STRESS_SCENARIOS.find((s) => s.id === lastResult.scenarioId)
		: null;
	const rewardStages: PipelineStage[] = useMemo(() => {
		const wasBlocked = lastResult?.result === 'blocked';
		return [
			{ id: 'request', label: 'Request' },
			{ id: 'router', label: 'Router', variant: 'active' as const },
			{
				id: 'controller',
				label: 'Controller',
				variant: 'active' as const,
			},
			{
				id: 'response',
				label: 'Response',
				sublabel: lastResult
					? wasBlocked
						? '404'
						: lastScenario?.method === 'DELETE'
							? '204'
							: '200'
					: undefined,
			},
			{
				id: 'serializer',
				label: 'Serializer',
				position: HUB_POS.serializer,
				variant: 'active' as const,
			},
			{
				id: 'model',
				label: 'Model',
				position: HUB_POS.model,
				variant: wasBlocked ? ('danger' as const) : ('active' as const),
				sublabel: wasBlocked ? '404 Not Found' : 'has_many :reviews',
				badge: wasBlocked ? 'BLOCKED' : undefined,
			},
			{
				id: 'database',
				label: 'Database',
				position: HUB_POS.database,
				variant: 'active' as const,
			},
		];
	}, [lastResult, lastScenario]);

	// ── Stage click handler (observe phase) ──
	const handleStageClick = useCallback(
		(stageId: string) => {
			if (phase !== 'observe') return;

			const data = STAGE_INSPECTOR_MAP[stageId];
			if (!data) return;

			setInspectorData(data);
			setInspectedStages((prev) => {
				if (prev.has(stageId)) return prev;
				const next = new Set(prev);
				next.add(stageId);
				return next;
			});

			// Trigger discovery if this stage has one
			const discoveryId = STAGE_DISCOVERY_MAP[stageId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[phase, discoveryGating],
	);

	// ── Probe handler (observe phase) ──
	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveryId = PROBE_DISCOVERY_MAP[probeId];
			if (discoveryId) {
				discoveryGating.discover(discoveryId);
			}
		},
		[discoveryGating],
	);

	// ── OptionCard step handler ──
	const handleOptionClick = useCallback(
		(option: StepOption) => {
			if (option.correct) {
				stepper.completeStep();
			} else if (option.feedback) {
				stepper.recordWrongAttempt(option.feedback);
			}
		},
		[stepper],
	);

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	// ── Stress test fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
		},
		[stressTest],
	);

	// ── Completion ──
	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Associations configured correctly!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentStepType = STEP_TYPES[stepper.currentStep];
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];
	const shuffledOptions = useMemo(
		() =>
			currentOptionConfig
				? shuffleOptions(currentOptionConfig.options, stepper.currentStep)
				: [],
		[currentOptionConfig, stepper.currentStep],
	);

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Product API works end-to-end: model (L3), CRUD (L4), routes
							(L5), controller (L6), serializer (L7). But products exist in
							isolation: no reviews, no likes, no tags.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Try accessing reviews on a product and see what happens. Rails{' '}
							<span className="text-foreground font-medium">associations</span>{' '}
							(has_many, belongs_to) connect models and provide query methods.
						</p>
					</div>

					{/* Observe phase: discovery checklist */}
					{phase === 'observe' && (
						<div className="p-4 border-b border-border">
							<DiscoveryChecklist
								discoveredCount={discoveryGating.discoveredCount}
								discoveries={discoveryGating.discoveries}
								minRequired={discoveryGating.minRequired}
							/>
						</div>
					)}

					{/* Build phase: step progress */}
					{phase === 'build' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Steps
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{/* Reward phase: legend + counters */}
					{phase === 'reward' && (
						<>
							<PipelineLegend />

							<div className="p-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="bg-success/20 rounded-lg p-3 text-center">
										<div className="text-2xl font-bold text-success">
											{stressTest.allowedCount}
										</div>
										<div className="text-xs text-success/70">Allowed</div>
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
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Associations"
					levelNumber={8}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Observe (WHY) ── */}
					{phase === 'observe' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={OBSERVE_CONNECTIONS}
									onNodeClick={handleStageClick}
									stages={observeStages}
								/>
								{inspectorData && (
									<StageInspector
										data={inspectorData}
										onClose={() => setInspectorData(null)}
									/>
								)}
							</div>

							{/* Probe terminal */}
							<div className="px-6 pb-2">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="API Probe"
								/>
							</div>

							{/* Build the Fix button (discovery gated) */}
							{discoveryGating.isUnlocked && (
								<div className="p-4 flex justify-center animate-in fade-in duration-500">
									<Button
										className="gap-2"
										onClick={handleStartBuild}
										size="lg"
									>
										Build the Fix
										<ArrowRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								{/* Step 0: Generate Review (Terminal) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 0 && (
										<TerminalChoiceStep
											commands={generateCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													In Level 3, you generated Product with{' '}
													<span className="font-mono text-primary">
														rails generate model
													</span>
													. Review follows the same pattern, but needs a field
													that links it back to Product.
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
											outputLines={generateOutput}
											stepKey={stepper.currentStep}
											title="Generate Review Model"
										/>
									)}

								{/* Step 1: Run Migration (Terminal) */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 1 && (
										<TerminalChoiceStep
											commands={migrateCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													The migration file has been created. Now apply it to
													create the reviews table in the database.
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
											outputLines={migrateOutput}
											stepKey={stepper.currentStep}
											title="Run Migration"
										/>
									)}

								{/* Step 2: Choose Relationship (OptionCard) */}
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
												{shuffledOptions.map((opt) => (
													<OptionCard
														color="blue"
														disabled={!opt.correct}
														key={opt.id}
														mono
														name={opt.label}
														selected={opt.correct}
														size="lg"
													/>
												))}
											</div>
										) : (
											<>
												<div className="space-y-2">
													{shuffledOptions.map((opt) => (
														<OptionCard
															color="blue"
															key={opt.id}
															mono
															name={opt.label}
															onClick={() => handleOptionClick(opt)}
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

										{isViewingCompletedStep && hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={stepper.nextStep}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</>
								)}

								{/* Step 3: Auto belongs_to (Informational) */}
								{currentStepType === 'info' && stepper.currentStep === 3 && (
									<div className="space-y-4">
										<h3 className="text-lg font-semibold text-foreground">
											Auto belongs_to
										</h3>
										<div className="bg-card rounded-lg border border-border p-6 space-y-3">
											<p className="text-sm text-foreground">
												Because you used{' '}
												<span className="font-mono text-primary">
													product:references
												</span>{' '}
												in the generator, Rails automatically added:
											</p>
											<div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
												<div className="text-zinc-400">
													class Review {'<'} ApplicationRecord
												</div>
												<div className="text-emerald-400 ml-4">
													belongs_to :product
												</div>
												<div className="text-zinc-400">end</div>
											</div>
											<p className="text-sm text-muted-foreground">
												The inverse relationship is set up for free. Every
												Review knows which Product it belongs to.
											</p>
										</div>
										{!isViewingCompletedStep && (
											<div className="flex justify-center">
												<Button onClick={() => stepper.completeStep()}>
													Got It
												</Button>
											</div>
										)}
										{isViewingCompletedStep && hasNextStep && (
											<div className="flex justify-end">
												<Button
													className="gap-2"
													onClick={stepper.nextStep}
													size="sm"
												>
													Next Step
													<ArrowRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</div>
								)}

								{/* Step 5: Test It (Terminal, irb> prompt) - last step */}
								{currentStepType === 'terminal' &&
									stepper.currentStep === 5 && (
										<TerminalChoiceStep
											commands={testCommands}
											completed={isViewingCompletedStep}
											description={
												<p className="text-sm text-muted-foreground">
													Create a review through the association. How do you
													add a child record through the parent?
												</p>
											}
											hasNext
											initialHistory={buildTerminalHistory(CONSOLE_STEP_MAP, 0)}
											onCorrect={() => stepper.completeStep()}
											onNext={() => {
												setPhase('reward');
												stressTest.reset();
											}}
											onWrong={(fb) => stepper.recordWrongAttempt(fb)}
											outputLines={testOutput}
											prompt="irb>"
											stepKey={stepper.currentStep}
											terminalTitle="Rails Console"
											title="Test It"
										/>
									)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Reward (ADVANTAGE) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col">
							<div className="flex-1 relative">
								<PipelineFlow
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
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
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						stepper.isCurrentStepCompleted
							? stepper.currentStep
							: stepper.currentStep - 1,
					)}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level8Associations;
