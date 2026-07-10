/**
 * Level 3: The Model
 *
 * 4-step progression to create the Product model.
 * Steps: Name the Model -> Define Attributes -> Run Generator -> Run Migration
 */

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';

registerLevelCode('act1-level3-model', () => [
	{
		filename: 'app/models/product.rb',
		language: 'ruby',
		code: `class Product < ApplicationRecord
end`,
	},
	{
		filename: 'db/migrate/<timestamp>_create_products.rb',
		language: 'ruby',
		code: `class CreateProducts < ActiveRecord::Migration[8.1]
  def change
    create_table :products do |t|
      t.string :name
      t.text :description
      t.decimal :price

      t.timestamps
    end
  end
end`,
	},
	{
		filename: 'db/schema.rb',
		language: 'ruby',
		code: `ActiveRecord::Schema[8.1].define(version: 2026_05_02_000000) do
  enable_extension "pg_catalog.plpgsql"

  create_table "products", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name"
    t.decimal "price"
    t.datetime "updated_at", null: false
  end
end`,
	},
]);

const STEP_DEFS: StepDef[] = [
	{ id: 'name-model', title: 'Name the Model' },
	{ id: 'define-attrs', title: 'Define Attributes' },
	{ id: 'run-generator', title: 'Run Generator' },
	{ id: 'run-migration', title: 'Run Migration' },
];

interface AttributeSlot {
	field: string;
	description: string;
	correctType: string;
	assignedType: string | null;
}

const ATTRIBUTE_SLOTS: AttributeSlot[] = [
	{
		field: 'name',
		description: 'Short product name',
		correctType: 'string',
		assignedType: null,
	},
	{
		field: 'description',
		description: 'Long-form product details',
		correctType: 'text',
		assignedType: null,
	},
	{
		field: 'price',
		description: 'Monetary value with exact precision',
		correctType: 'decimal',
		assignedType: null,
	},
];

const AVAILABLE_TYPES = [
	'string',
	'text',
	'integer',
	'decimal',
	'boolean',
	'datetime',
];

const MODEL_NAME_OPTIONS = [
	{
		label: 'Products',
		correct: false,
		feedback:
			'Rails models are singular, not plural. Rails auto-pluralizes the table name for you.',
	},
	{ label: 'Product', correct: true },
	{
		label: 'product',
		correct: false,
		feedback:
			'Rails models use PascalCase. Check the capitalization convention.',
	},
	{
		label: 'products_table',
		correct: false,
		feedback:
			"You don't need to specify the table name. Rails infers it from a singular PascalCase model name.",
	},
];

// Step 3: Generator commands
const generatorCommands: TerminalCommand[] = [
	{
		id: 'wrong-types',
		label:
			'rails generate model Product name:text description:string price:integer',
		command:
			'rails generate model Product name:text description:string price:integer',
		correct: false,
		feedback:
			'The types are swapped around. Think about which fields are short vs. long, and which stores money with exact precision.',
	},
	{
		id: 'correct',
		label:
			'rails generate model Product name:string description:text price:decimal',
		command:
			'rails generate model Product name:string description:text price:decimal',
		correct: true,
	},
	{
		id: 'wrong-missing',
		label: 'rails generate model Product name:string description:text',
		command: 'rails generate model Product name:string description:text',
		correct: false,
		feedback:
			'Missing an attribute. The Product model has three fields, not two.',
	},
];

const generatorOutput: TerminalOutputLine[] = [
	{ text: '      invoke  active_record', color: 'green' },
	{
		text: '      create    db/migrate/<timestamp>_create_products.rb',
		color: 'green',
	},
	{ text: '      create    app/models/product.rb', color: 'green' },
	{ text: '      invoke    test_unit', color: 'muted' },
	{ text: '      create      test/models/product_test.rb', color: 'muted' },
	{ text: '      create      test/fixtures/products.yml', color: 'muted' },
];

// Step 4: Migration command
const migrationCommands: TerminalCommand[] = [
	{
		id: 'wrong-rollback',
		label: 'rails db:rollback',
		command: 'rails db:rollback',
		correct: false,
		feedback:
			'Rollback undoes migrations. You need to apply them, not reverse them.',
	},
	{
		id: 'correct',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
];

const migrationOutput: TerminalOutputLine[] = [
	{
		text: '== <timestamp> CreateProducts: migrating ===================================',
		color: 'green',
	},
	{ text: '-- create_table(:products)', color: 'cyan' },
	{ text: '   -> 0.0123s', color: 'muted' },
	{
		text: '== <timestamp> CreateProducts: migrated (0.0123s) ==========================',
		color: 'green',
	},
];

// Terminal step data for building history (steps 0-1 are non-terminal)
const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	null, // step 0: Name Model (click-to-select)
	null, // step 1: Define Attributes (drag-and-drop)
	{ commands: generatorCommands, outputLines: generatorOutput },
	{ commands: migrationCommands, outputLines: migrationOutput },
];

// Terminal step titles and descriptions
const TERMINAL_STEPS: {
	stepIndex: number;
	title: string;
	description: React.ReactNode;
	commands: TerminalCommand[];
	outputLines: TerminalOutputLine[];
}[] = [
	{
		stepIndex: 2,
		title: 'Run Generator',
		description: (
			<p className="text-sm text-muted-foreground">
				Pick the correct{' '}
				<span className="font-mono text-primary">rails generate model</span>{' '}
				command with all three attributes.
			</p>
		),
		commands: generatorCommands,
		outputLines: generatorOutput,
	},
	{
		stepIndex: 3,
		title: 'Run Migration',
		description: (
			<p className="text-sm text-muted-foreground">
				The generator created a migration file. Run it to create the products
				table in the database.
			</p>
		),
		commands: migrationCommands,
		outputLines: migrationOutput,
	},
];

export function Level3Model({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [slots, setSlots] = useState<AttributeSlot[]>(ATTRIBUTE_SLOTS);
	const [draggedType, setDraggedType] = useState<string | null>(null);

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Step 2: Drag types onto field slots
	const allSlotsCorrect = slots.every((s) => s.assignedType === s.correctType);

	const handleTypeDragStart = (e: React.DragEvent, type: string) => {
		e.dataTransfer.setData('attrType', type);
		setDraggedType(type);
	};

	const handleTypeDrop = (field: string, e: React.DragEvent) => {
		e.preventDefault();
		const type = e.dataTransfer.getData('attrType');
		setDraggedType(null);

		const slot = slots.find((s) => s.field === field);
		if (!slot) return;

		if (type === slot.correctType) {
			setSlots((prev) =>
				prev.map((s) => (s.field === field ? { ...s, assignedType: type } : s)),
			);
		} else {
			// Wrong type feedback
			const feedbackMap: Record<string, Record<string, string>> = {
				name: {
					text: '"text" is for long-form content. "name" is a short field (under 255 characters).',
					boolean: '"name" stores text, not true/false.',
					integer: '"name" stores text, not numbers.',
					decimal: '"name" stores text, not monetary values.',
					datetime: '"name" stores text, not timestamps.',
				},
				description: {
					string:
						'"string" maxes out at 255 characters. "description" needs to hold full product details and paragraphs.',
					boolean: '"description" stores content, not true/false.',
					integer: '"description" stores content, not numbers.',
					decimal: '"description" stores content, not monetary values.',
					datetime: '"description" stores content, not timestamps.',
				},
				price: {
					string:
						'"price" stores money. Use a numeric type with exact precision.',
					text: '"price" stores money, not long content.',
					integer:
						'"price" needs cents and fractions. integer rounds to whole numbers, which loses every value below the dollar.',
					boolean: '"price" stores money, not true/false.',
					datetime: '"price" stores money, not a timestamp.',
				},
			};
			const fb = feedbackMap[field]?.[type] || `Wrong type for ${field}.`;
			stepper.recordWrongAttempt(fb);
		}
	};

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
		return { valid: true, message: 'Your Product model is ready!' };
	};

	// Code preview - each completed step adds its output
	// furthestStep: 0=start, 1=named model, 2=defined attrs, 3=ran generator, 4=ran migration
	const getCodeFiles = () => {
		const files = [];

		// After naming the model (step 0) - show the generator command being built
		if (stepper.furthestStep >= 1) {
			const attrArgs = slots
				.filter((s) => s.assignedType)
				.map((s) => `${s.field}:${s.assignedType}`)
				.join(' ');
			files.push({
				filename: 'Generator Command',
				language: 'bash',
				code: `$ rails generate ${stepper.furthestStep >= 3 ? 'model' : '<which generator?>'} Product${attrArgs ? ` ${attrArgs}` : ' ...'}`,
				highlight: [1],
			});
		}

		// After defining attributes (step 1) - update the command with all types
		// (already reflected above via slots state)

		// After running generator (step 2) - show generated files
		if (stepper.furthestStep >= 3) {
			files.push({
				filename: 'app/models/product.rb',
				language: 'ruby',
				code: `class Product < ApplicationRecord
end`,
				highlight: [1],
			});

			files.push({
				filename: 'db/migrate/<timestamp>_create_products.rb',
				language: 'ruby',
				code: `class CreateProducts < ActiveRecord::Migration[8.1]
  def change
    create_table :products do |t|
      t.string :name
      t.text :description
      t.decimal :price

      t.timestamps
    end
  end
end`,
				highlight: [4, 5, 6],
			});
		}

		// After running migration (step 3) - show schema
		if (stepper.furthestStep >= 4) {
			files.push({
				filename: 'db/schema.rb',
				language: 'ruby',
				code: `ActiveRecord::Schema[8.1].define(version: 2026_05_02_000000) do
  enable_extension "pg_catalog.plpgsql"

  create_table "products", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name"
    t.decimal "price"
    t.datetime "updated_at", null: false
  end
end`,
				highlight: [4, 5, 6, 7, 8],
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'Generator Command',
				language: 'bash',
				code: `# Name your model first.`,
				highlight: [],
			});
		}

		return files;
	};

	// Find current terminal step config (if viewing a terminal step)
	const currentTerminalStep = TERMINAL_STEPS.find(
		(ts) => ts.stepIndex === stepper.currentStep,
	);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario */}
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							You&apos;re building an e-commerce API. Before writing endpoints,
							you need to define what a &quot;Product&quot; looks like. In
							Rails, this is a Model.
						</p>
					</div>

					{/* Step Progress */}
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
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="The Model"
					levelNumber={3}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Name the Model */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Name the Model
								</h3>
								<p className="text-sm text-muted-foreground">
									What should the model for a single product be called?
								</p>
								{isViewingCompletedStep ? (
									<div className="grid grid-cols-2 gap-3">
										{MODEL_NAME_OPTIONS.map((opt) => (
											<Button
												className={`h-auto py-4 text-lg font-mono ${opt.correct ? 'border-success text-success' : 'opacity-50'}`}
												disabled
												key={opt.label}
												variant="outline"
											>
												{opt.label}
											</Button>
										))}
									</div>
								) : (
									<div className="grid grid-cols-2 gap-3">
										{MODEL_NAME_OPTIONS.map((opt) => (
											<Button
												className="h-auto py-4 text-lg font-mono"
												key={opt.label}
												onClick={() => {
													if (opt.correct) {
														stepper.completeStep();
													} else {
														stepper.recordWrongAttempt(opt.feedback ?? '');
													}
												}}
												variant="outline"
											>
												{opt.label}
											</Button>
										))}
									</div>
								)}
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Step 2: Define Attributes */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Define Attributes
								</h3>
								<p className="text-sm text-muted-foreground">
									Drag the correct data type onto each field. Think about what
									kind of data each field stores.
								</p>

								{!isViewingCompletedStep && (
									<div>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
											Data Types
										</div>
										<div className="flex flex-wrap gap-2">
											{AVAILABLE_TYPES.map((type) => (
												<OptionCard
													color="primary"
													dragData={type}
													draggable
													dragType="attrType"
													isDragging={draggedType === type}
													key={type}
													mono
													name={`:${type}`}
													onDragEnd={() => setDraggedType(null)}
													onDragStart={(e) => handleTypeDragStart(e, type)}
													selected={draggedType === type}
													size="sm"
												/>
											))}
										</div>
										<p className="text-xs text-muted-foreground mt-2">
											Drag a type onto each field slot
										</p>
									</div>
								)}

								<div className="space-y-3">
									{slots.map((slot) => (
										// biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop drop zone
										<div
											className={`p-4 rounded-lg border-2 transition-all ${
												slot.assignedType === slot.correctType
													? 'border-success bg-success/5'
													: 'border-dashed border-border bg-card'
											}`}
											key={slot.field}
											onDragOver={
												isViewingCompletedStep
													? undefined
													: (e) => e.preventDefault()
											}
											onDrop={
												isViewingCompletedStep
													? undefined
													: (e) => handleTypeDrop(slot.field, e)
											}
										>
											<div className="flex items-center justify-between">
												<div>
													<span className="font-mono text-foreground font-medium">
														{slot.field}
													</span>
													<span className="text-xs text-muted-foreground ml-2">
														({slot.description})
													</span>
												</div>
												{slot.assignedType ? (
													<span className="px-3 py-1 rounded-md bg-success/10 text-success text-xs font-mono border border-success/30">
														:{slot.assignedType}
													</span>
												) : (
													<span className="px-3 py-1 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground">
														drop type here
													</span>
												)}
											</div>
										</div>
									))}
								</div>

								{allSlotsCorrect && !isViewingCompletedStep && (
									<div className="flex justify-end pt-4">
										<Button onClick={() => stepper.completeStep()}>
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Steps 3-4: Terminal choice steps */}
						{currentTerminalStep && (
							<TerminalChoiceStep
								commands={currentTerminalStep.commands}
								completed={isViewingCompletedStep}
								description={currentTerminalStep.description}
								hasNext={hasNextStep}
								initialHistory={buildTerminalHistory(
									TERMINAL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={currentTerminalStep.outputLines}
								stepKey={stepper.currentStep}
								title={currentTerminalStep.title}
							/>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level3Model;
