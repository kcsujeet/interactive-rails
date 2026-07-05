/**
 * Level 5: Associations
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Interactive exploration of two Active Record models.
 *   At L5 the player has the Product model from L3 and console CRUD from L4.
 *   No controllers, no routes, no API exist yet (those are L6, L7, L8).
 *   Probes are console commands the player runs against the existing app.
 *   They reveal that Product is an island: the Review model does not exist,
 *   the has_many association does not exist, and the foreign key linking
 *   Review back to Product does not exist either.
 * Phase 2 (HOW - build): 6 steps (3 terminal + 1 informational + 2 OptionCard)
 *   Step 0: Generate Review model with product:references (terminal)
 *   Step 1: Run migration (terminal)
 *   Step 2: Choose relationship type for Product model (OptionCard)
 *   Step 3: Auto belongs_to explanation (informational, "Got It" button)
 *   Step 4: Set dependent option (OptionCard)
 *   Step 5: Test the association in Rails console (terminal, irb> prompt)
 * Phase 3 (ADVANTAGE - reward): Stress test. The same console probes the
 *   player ran in observe now succeed because the association exists.
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

registerLevelCode('act1-level5-associations', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
//
// L5 has Active Record models and console CRUD skills at this point.
// No controllers, routes, or API exist yet (those land in L6-L8).
// Each discovery corresponds to one console probe.
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'no-reviews-method', label: 'Product has no .reviews method' },
	{ id: 'no-review-model', label: 'Review model does not exist' },
	{ id: 'no-product-id-column', label: 'No foreign key links the two tables' },
];

// ──────────────────────────────────────────────
// Probe configurations (observe phase)
//
// Every probe is a `bin/rails console` command the player can actually
// type at L5. No HTTP requests, no routes, no controllers.
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'reviews-on-product',
		label: 'product.reviews',
		story: [
			'You open the Rails console and create a product, the skill from L4.',
			'You type product.reviews to see what reviews it has.',
			'Rails raises NoMethodError. Product has no .reviews method.',
			'Without an association, the parent model has no way to ask for its children.',
		],
		command: 'rails c -> product.reviews',
		responseLines: [
			{
				text: 'product = Product.create!(name: "Laptop Pro", price: 1299)',
				color: 'muted',
			},
			{
				text: '=> #<Product id: 1, name: "Laptop Pro">',
				color: 'green',
			},
			{ text: 'product.reviews', color: 'muted' },
			{
				text: "NoMethodError: undefined method `reviews' for #<Product>",
				color: 'red',
			},
			{
				text: 'Product has no association declaration.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'review-model-exists',
		label: 'Review.count',
		story: [
			'You try to query the Review model directly to see if any rows exist.',
			'Rails cannot find a constant named Review.',
			'No app/models/review.rb file exists. The class has never been defined.',
			'There is no Review model and no reviews table. Just Product.',
		],
		command: 'rails c -> Review.count',
		responseLines: [
			{ text: 'Review.count', color: 'muted' },
			{
				text: 'NameError: uninitialized constant Review',
				color: 'red',
			},
			{
				text: 'No Review model exists. Only Product is defined.',
				color: 'yellow',
			},
		],
	},
	{
		id: 'inspect-product-columns',
		label: 'Product.columns_hash.keys',
		story: [
			'You list the columns on the products table.',
			'You see name, description, price -- the three columns from L3.',
			'There is no product_id column anywhere because the reviews table itself does not exist.',
			'Without a foreign key, there is no way to remember which review belongs to which product.',
		],
		command: 'rails c -> Product.columns_hash.keys',
		responseLines: [
			{ text: 'Product.columns_hash.keys', color: 'muted' },
			{
				text: '=> ["id", "name", "description", "price", "created_at", "updated_at"]',
				color: 'green',
			},
			{
				text: 'No reviews table, no product_id foreign key. Two records cannot link.',
				color: 'yellow',
			},
		],
	},
];

// Map probe IDs to discovery IDs they trigger (1:1)
const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'reviews-on-product': 'no-reviews-method',
	'review-model-exists': 'no-review-model',
	'inspect-product-columns': 'no-product-id-column',
};

// Map probe IDs to per-probe pipeline node display during observe.
// Each probe lights up a different aspect of the missing relationship.
interface ProbePipelineDisplay {
	productSublabel?: string;
	productBadge?: string;
	productVariant?: PipelineStage['variant'];
	reviewSublabel?: string;
	reviewBadge?: string;
	reviewVariant?: PipelineStage['variant'];
}

const PROBE_PIPELINE_MAP: Record<string, ProbePipelineDisplay> = {
	'reviews-on-product': {
		productSublabel: 'no .reviews method',
		productBadge: 'NoMethodError',
		productVariant: 'danger',
		reviewSublabel: 'never declared',
		reviewVariant: 'inactive',
	},
	'review-model-exists': {
		productSublabel: 'no associations',
		productVariant: 'danger',
		reviewSublabel: 'class missing',
		reviewBadge: 'NameError',
		reviewVariant: 'inactive',
	},
	'inspect-product-columns': {
		productSublabel: 'name, description, price',
		productVariant: 'danger',
		reviewSublabel: 'no reviews table',
		reviewBadge: 'no FK',
		reviewVariant: 'inactive',
	},
};

// ──────────────────────────────────────────────
// Stage inspector data (observe phase)
//
// Inspectors describe the two model files and the schema. No router,
// controller, or serializer cards -- those concepts do not exist yet.
// ──────────────────────────────────────────────

const STAGE_INSPECTOR_MAP: Record<string, StageInspectorData> = {
	product: {
		stageId: 'product',
		title: 'Product Model',
		description:
			'The Product model from L3. It has a name, description, and price column. There are no associations on it yet, so it cannot ask for related records.',
		code: `# app/models/product.rb
class Product < ApplicationRecord
  # No associations defined.
end`,
	},
	review: {
		stageId: 'review',
		title: 'Review Model (does not exist)',
		description:
			'There is no app/models/review.rb file. No reviews table either. The build phase will generate the Review model, the migration, and the foreign key all at once.',
	},
	schema: {
		stageId: 'schema',
		title: 'Database Schema',
		description:
			'Postgres only has a products table. No reviews table, no product_id foreign key, no index. Two unrelated tables would still leave the data unlinked at the database level.',
		code: `# db/schema.rb (current)
create_table "products" do |t|
  t.string   "name"
  t.text     "description"
  t.decimal  "price"
  t.datetime "created_at"
  t.datetime "updated_at"
end
# (no reviews table)`,
	},
};

// Map stage IDs to discovery IDs they trigger.
// Stage clicks do NOT duplicate probe-triggered discoveries -- the schema
// inspector only opens the inspector card. Discoveries are probe-driven.
const STAGE_DISCOVERY_MAP: Record<string, string> = {};

// ──────────────────────────────────────────────
// Pipeline visualization configs
//
// Two-node, model-only layout. Product on the left, Review on the right,
// with a single bidirectional edge between them representing the
// missing has_many / belongs_to relationship.
// ──────────────────────────────────────────────

const NODE_POS = {
	product: { x: 200, y: 200 },
	review: { x: 700, y: 200 },
} as const;

const OBSERVE_CONNECTIONS: PipelineConnection[] = [
	{
		from: 'product',
		to: 'review',
		dots: 'mixed',
	},
];

const REWARD_CONNECTIONS: PipelineConnection[] = [
	{
		from: 'product',
		to: 'review',
		bidirectional: true,
		dots: 'clean',
	},
];

// Per-probe edge activation. Each probe lights the (broken) link between
// the two models in single-pass mode so the player sees a one-shot dot
// flow that stops at the missing target.
const PROBE_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'reviews-on-product': ['product-review'],
	'review-model-exists': ['product-review'],
	'inspect-product-columns': ['product-review'],
};

// Per-scenario edge activation in reward. Same console probes, but now
// the link works, so dots reach Review and the return path animates too.
const SCENARIO_ACTIVE_CONNECTIONS: Record<string, string[]> = {
	'reviews-on-product': ['product-review', 'review-product'],
	'review-model-exists': ['product-review', 'review-product'],
	'inspect-product-columns': ['product-review', 'review-product'],
	'create-review-through-association': ['product-review', 'review-product'],
	'cascade-on-destroy': ['product-review', 'review-product'],
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
//
// First three scenarios mirror the observe probes 1:1 (same id, same
// label, same console command). The next two are reward-only scenarios
// that demonstrate capabilities the build introduces: creating a review
// through the association, and the destroy cascade.
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'reviews-on-product',
		label: 'Product.first.reviews',
		description: 'Same console command, but now the association exists',
		method: 'GET',
		path: 'rails c',
		actor: 'developer',
		expectedResult: 'allowed',
		story: [
			'Same developer doing the same thing in the Rails console.',
			'They load the first product and call product.reviews.',
			'Rails uses the has_many declaration to issue a SELECT on the reviews table.',
			'An empty array comes back -- no errors, just no rows yet.',
		],
	},
	{
		id: 'review-model-exists',
		label: 'Review.count',
		description: 'The Review model and reviews table now exist',
		method: 'GET',
		path: 'rails c',
		actor: 'developer',
		expectedResult: 'allowed',
		story: [
			'Same developer asking the same question.',
			'They run Review.count to confirm the model loads.',
			'Rails finds app/models/review.rb and runs SELECT COUNT(*) on the reviews table.',
			'It returns 0 (an empty table) without raising.',
		],
	},
	{
		id: 'inspect-product-columns',
		label: 'Review.columns_hash.keys',
		description: 'The reviews table now has a product_id foreign key',
		method: 'GET',
		path: 'rails c',
		actor: 'developer',
		expectedResult: 'allowed',
		story: [
			'Same developer inspecting the schema, but this time on the reviews table.',
			'They see id, body, product_id, created_at, updated_at.',
			'product_id is the foreign key the migration added via t.references.',
			'An index on product_id and a database-level FK constraint come along for free.',
		],
	},
	{
		id: 'create-review-through-association',
		label: 'product.reviews.create(body: "Nice!")',
		description: 'Add a review through the association',
		method: 'POST',
		path: 'rails c',
		actor: 'developer',
		expectedResult: 'allowed',
		story: [
			'A developer wants to attach a review to a product in the console.',
			'They call product.reviews.create(body: "Nice!").',
			'Rails sets product_id on the new Review record automatically.',
			'A new row lands in the reviews table, linked to this product.',
		],
	},
	{
		id: 'cascade-on-destroy',
		label: 'Product.first.destroy',
		description: 'Destroy a product and cascade-delete its reviews',
		method: 'DELETE',
		path: 'rails c',
		actor: 'developer',
		expectedResult: 'allowed',
		story: [
			'A developer destroys a product that already has reviews attached.',
			'Without dependent: :destroy, the reviews would be left orphaned.',
			'With dependent: :destroy, Rails calls .destroy on each review first.',
			'Both the product row and its reviews are gone in a single transaction.',
		],
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
		text: '      create    db/migrate/<timestamp>_create_reviews.rb',
		color: 'green',
	},
	{ text: '      create    app/models/review.rb', color: 'green' },
	{ text: '      invoke    test_unit', color: 'muted' },
	{ text: '      create      test/models/review_test.rb', color: 'muted' },
	{ text: '      create      test/fixtures/reviews.yml', color: 'muted' },
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
		text: '== <timestamp> CreateReviews: migrating ====================================',
		color: 'muted',
	},
	{
		text: '-- create_table(:reviews)',
		color: 'green',
	},
	{
		text: '   -> 0.0186s',
		color: 'muted',
	},
	{
		text: '== <timestamp> CreateReviews: migrated (0.0186s) ===========================',
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
			'`:nullify` sets product_id to NULL on each review and leaves the review row behind. A review without a product is meaningless to the storefront and clutters reports. Pick the option that handles deletion the way "this review only exists because of this product" implies.',
	},
	{
		id: 'restrict',
		label: 'dependent: :restrict_with_error',
		correct: false,
		feedback:
			'`:restrict_with_error` blocks the parent delete entirely if any reviews exist. Useful when orphans would corrupt invariants, but here a deleted product should not be undeletable -- choose the option that handles deletion through the association instead.',
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
  # No associations defined.
end`,
			highlight: [2],
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
			filename: 'db/migrate/<timestamp>_create_reviews.rb',
			language: 'ruby',
			code: `class CreateReviews < ActiveRecord::Migration[8.1]
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
				Console Probe Legend
			</div>
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<Check className="w-4 h-4 text-success" />
					<span className="text-foreground">Console call returns a value</span>
				</div>
				<div className="flex items-center gap-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-foreground">Console call raises an error</span>
				</div>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level5Associations({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
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
				id: 'product',
				label: 'Product Model',
				position: NODE_POS.product,
				sublabel: probeDisplay?.productSublabel ?? 'name, description, price',
				badge: probeDisplay?.productBadge,
				variant: probeDisplay?.productVariant ?? 'default',
				inspectable: true,
				inspected: inspectedStages.has('product'),
			},
			{
				id: 'review',
				label: 'Review Model',
				position: NODE_POS.review,
				sublabel: probeDisplay?.reviewSublabel ?? 'does not exist',
				badge: probeDisplay?.reviewBadge,
				variant: probeDisplay?.reviewVariant ?? 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('review'),
			},
			{
				id: 'schema',
				label: 'Database Schema',
				position: { x: 450, y: 380 },
				sublabel: 'products table only',
				variant: 'inactive',
				inspectable: true,
				inspected: inspectedStages.has('schema'),
			},
		],
		[inspectedStages, probeDisplay],
	);

	// Per-probe edge activation. Default to [] so edges are dormant until
	// the player fires a probe.
	const observeActiveConnections = useMemo(
		() => (lastProbeId ? (PROBE_ACTIVE_CONNECTIONS[lastProbeId] ?? []) : []),
		[lastProbeId],
	);

	// ── Build reward stages dynamically (reacts to latest stress test result) ──
	const lastResult = stressTest.results[stressTest.results.length - 1];

	const rewardActiveConnections = useMemo(
		() =>
			lastResult
				? (SCENARIO_ACTIVE_CONNECTIONS[lastResult.scenarioId] ?? [])
				: [],
		[lastResult],
	);

	const rewardStages: PipelineStage[] = useMemo(() => {
		// Per-scenario reward display: each scenario shows the same console
		// command from observe, but now it succeeds. The two new scenarios
		// (create + cascade) demonstrate capabilities the build introduced.
		const display: Record<
			string,
			{
				productSublabel: string;
				reviewSublabel: string;
				reviewVariant: PipelineStage['variant'];
				reviewBadge?: string;
			}
		> = {
			'reviews-on-product': {
				productSublabel: 'has_many :reviews',
				reviewSublabel: 'returns []',
				reviewVariant: 'active',
			},
			'review-model-exists': {
				productSublabel: 'has_many :reviews',
				reviewSublabel: 'class loaded, table empty',
				reviewVariant: 'active',
			},
			'inspect-product-columns': {
				productSublabel: 'has_many :reviews',
				reviewSublabel: 'product_id + index + FK',
				reviewVariant: 'active',
			},
			'create-review-through-association': {
				productSublabel: 'product.reviews.create',
				reviewSublabel: 'new row, product_id set',
				reviewVariant: 'active',
				reviewBadge: '+1',
			},
			'cascade-on-destroy': {
				productSublabel: 'destroy cascades',
				reviewSublabel: 'reviews destroyed too',
				reviewVariant: 'active',
				reviewBadge: 'CASCADE',
			},
		};

		const current = lastResult ? display[lastResult.scenarioId] : null;
		return [
			{
				id: 'product',
				label: 'Product Model',
				position: NODE_POS.product,
				sublabel: current?.productSublabel ?? 'has_many :reviews',
				variant: 'active' as const,
			},
			{
				id: 'review',
				label: 'Review Model',
				position: NODE_POS.review,
				sublabel: current?.reviewSublabel ?? 'belongs_to :product',
				badge: current?.reviewBadge,
				variant: current?.reviewVariant ?? ('active' as const),
			},
			{
				id: 'schema',
				label: 'Database Schema',
				position: { x: 450, y: 380 },
				sublabel: 'products + reviews (FK)',
				variant: 'active' as const,
			},
		];
	}, [lastResult]);

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

			// Stage clicks no longer drive discoveries (probes do that 1:1).
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
							You have a Product model from L3 and a Rails console open. The
							storefront wants reviews attached to each product, but right now
							Product is alone: no second model, no foreign key, no way for one
							record to ask for the other.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Try a few console calls to see exactly what is missing. Rails{' '}
							<span className="text-foreground font-medium">associations</span>{' '}
							are how two models declare that they belong together.
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
					levelNumber={5}
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
									activeConnections={observeActiveConnections}
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
							<div className="px-6 pb-4">
								<ProbeTerminal
									onProbe={handleProbe}
									probes={PROBES}
									title="Rails Console Probe"
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
									activeConnections={rewardActiveConnections}
									connections={REWARD_CONNECTIONS}
									stages={rewardStages}
								/>
							</div>

							{/* Stress test controls below pipeline */}
							<div className="px-6 pb-4">
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

export default Level5Associations;
