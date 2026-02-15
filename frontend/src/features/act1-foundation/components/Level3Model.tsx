/**
 * Level 2: The Model
 *
 * 4-step progression to create the Post model.
 * Steps: Name the Model → Define Attributes → Run Generator → Run Migration
 */

import { useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	SimulatedTerminal,
	StepProgress,
	useLevelCompletion,
	type TerminalOutputLine,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating, type StepDef } from '@/hooks/useStepGating';

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
		field: 'title',
		description: 'Short post title',
		correctType: 'string',
		assignedType: null,
	},
	{
		field: 'body',
		description: 'Long-form content',
		correctType: 'text',
		assignedType: null,
	},
	{
		field: 'published',
		description: 'Visibility flag',
		correctType: 'boolean',
		assignedType: null,
	},
];

const AVAILABLE_TYPES = ['string', 'text', 'boolean', 'integer', 'datetime'];

const MODEL_NAME_OPTIONS = [
	{ label: 'Post', correct: true },
	{ label: 'Posts', correct: false, feedback: 'Rails models are singular PascalCase — "Post" maps to the "posts" table automatically.' },
	{ label: 'post', correct: false, feedback: 'Rails models use PascalCase — "Post", not "post".' },
	{ label: 'posts_table', correct: false, feedback: 'Just use the model name "Post" — Rails infers the table name "posts" automatically.' },
];

export function Level3Model({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);
	const [slots, setSlots] = useState<AttributeSlot[]>(ATTRIBUTE_SLOTS);
	const [draggedType, setDraggedType] = useState<string | null>(null);

	// Step 2: Drag types onto field slots
	const allSlotsCorrect = slots.every(
		(s) => s.assignedType === s.correctType,
	);

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
				prev.map((s) =>
					s.field === field ? { ...s, assignedType: type } : s,
				),
			);
		} else {
			// Wrong type feedback
			const feedbackMap: Record<string, Record<string, string>> = {
				title: {
					text: '"title" is short — use "string", not "text".',
					boolean: '"title" stores text, not true/false.',
					integer: '"title" stores text, not numbers.',
					datetime: '"title" stores text, not timestamps.',
				},
				body: {
					string: '"body" stores long content — use "text", not "string". "string" is limited to 255 characters.',
					boolean: '"body" stores content, not true/false.',
					integer: '"body" stores content, not numbers.',
					datetime: '"body" stores content, not timestamps.',
				},
				published: {
					string: '"published" is true/false — use "boolean".',
					text: '"published" is true/false — use "boolean".',
					integer: '"published" is true/false — use "boolean".',
					datetime: '"published" is true/false — use "boolean".',
				},
			};
			const fb = feedbackMap[field]?.[type] || `Wrong type for ${field}.`;
			stepper.recordWrongAttempt(fb);
		}
	};

	// Step 3: Generator commands
	const generatorCommands = [
		{
			id: 'correct',
			label: 'rails generate model Post title:string body:text published:boolean',
			command: 'rails generate model Post title:string body:text published:boolean',
			correct: true,
		},
		{
			id: 'wrong-types',
			label: 'rails generate model Post title:text body:string published:integer',
			command: 'rails generate model Post title:text body:string published:integer',
			correct: false,
			feedback: 'Wrong types — title is string (short text), body is text (long content), published is boolean.',
		},
		{
			id: 'wrong-missing',
			label: 'rails generate model Post title:string body:text',
			command: 'rails generate model Post title:string body:text',
			correct: false,
			feedback: 'Missing the "published" field — include all three attributes.',
		},
	];

	const generatorOutput: TerminalOutputLine[] = [
		{ text: '      invoke  active_record', color: 'green' },
		{ text: '      create    db/migrate/20240101000000_create_posts.rb', color: 'green' },
		{ text: '      create    app/models/post.rb', color: 'green' },
		{ text: '      invoke    test_unit', color: 'muted' },
		{ text: '      create      test/models/post_test.rb', color: 'muted' },
	];

	// Step 4: Migration command
	const migrationCommands = [
		{
			id: 'correct',
			label: 'rails db:migrate',
			command: 'rails db:migrate',
			correct: true,
		},
		{
			id: 'wrong-rollback',
			label: 'rails db:rollback',
			command: 'rails db:rollback',
			correct: false,
			feedback: 'Rollback undoes migrations — you want to run them with db:migrate.',
		},
	];

	const migrationOutput: TerminalOutputLine[] = [
		{ text: '== CreatePosts: migrating ====================================', color: 'green' },
		{ text: '-- create_table(:posts)', color: 'cyan' },
		{ text: '   -> 0.0012s', color: 'muted' },
		{ text: '== CreatePosts: migrated (0.0013s) ===========================', color: 'green' },
	];

	const handleComplete = async () => {
		const success = await completeLevel('act1-level3-model', {
			stars: stepper.starRating,
		});
		if (success) {
			onComplete({ stars: stepper.starRating });
		}
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
		return { valid: true, message: 'Your Post model is ready!' };
	};

	// Code preview updates per step
	const getCodeFiles = () => {
		const files = [];

		if (stepper.currentStep >= 1) {
			files.push({
				filename: 'app/models/post.rb',
				language: 'ruby',
				code: `class Post < ApplicationRecord
  # Attributes:
  # - title   (string)
  # - body    (text)
  # - published (boolean)
  #
  # Auto-generated:
  # - id         (integer, primary key)
  # - created_at (datetime)
  # - updated_at (datetime)
end`,
				highlight: [1],
			});
		}

		if (stepper.currentStep >= 3) {
			files.push({
				filename: 'db/migrate/create_posts.rb',
				language: 'ruby',
				code: `class CreatePosts < ActiveRecord::Migration[8.0]
  def change
    create_table :posts do |t|
      t.string :title
      t.text :body
      t.boolean :published

      t.timestamps
    end
  end
end`,
				highlight: [4, 5, 6],
			});
		}

		if (stepper.currentStep >= 4) {
			files.push({
				filename: 'db/schema.rb',
				language: 'ruby',
				code: `ActiveRecord::Schema[8.0].define(version: 2024_01_01_000000) do
  create_table "posts", force: :cascade do |t|
    t.string "title"
    t.text "body"
    t.boolean "published"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end
end`,
				highlight: [3, 4, 5],
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'app/models/post.rb',
				language: 'ruby',
				code: `# Choose the correct model name first`,
				highlight: [],
			});
		}

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario */}
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							You&apos;re building a blog API. Before writing endpoints, you
							need to define what a &quot;Post&quot; looks like. In Rails, this
							is a Model.
						</p>
					</div>

					{/* Step Progress */}
					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>

					{/* Type palette for step 2 */}
					{stepper.currentStep === 1 && (
						<div className="p-4">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Data Types
							</div>
							<div className="flex flex-wrap gap-2">
								{AVAILABLE_TYPES.map((type) => (
									<OptionCard
										color="primary"
										dragData={type}
										dragType="attrType"
										draggable
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
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="The Model"
					levelNumber={3}
					onComplete={handleComplete}
					onExit={onExit}
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
									What should the model for a blog post be called?
								</p>
								<div className="grid grid-cols-2 gap-3">
									{MODEL_NAME_OPTIONS.map((opt) => (
										<Button
											className="h-auto py-4 text-lg font-mono"
											key={opt.label}
											onClick={() => {
												if (opt.correct) {
													stepper.completeStep();
												} else {
													stepper.recordWrongAttempt(opt.feedback!);
												}
											}}
											variant="outline"
										>
											{opt.label}
										</Button>
									))}
								</div>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
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

								<div className="space-y-3">
									{slots.map((slot) => (
										<div
											className={`p-4 rounded-lg border-2 transition-all ${
												slot.assignedType === slot.correctType
													? 'border-success bg-success/5'
													: 'border-dashed border-border bg-card'
											}`}
											key={slot.field}
											onDragOver={(e) => e.preventDefault()}
											onDrop={(e) => handleTypeDrop(slot.field, e)}
										>
											<div className="flex items-center justify-between">
												<div>
													<span className="font-mono text-foreground font-medium">
														{slot.field}
													</span>
													<span className="text-xs text-muted-foreground ml-2">
														— {slot.description}
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

								{allSlotsCorrect && (
									<div className="flex justify-center pt-4">
										<Button onClick={() => stepper.completeStep()}>
											Attributes Look Good
										</Button>
									</div>
								)}

								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 3: Run Generator */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Run Generator
								</h3>
								<p className="text-sm text-muted-foreground">
									Pick the correct{' '}
									<span className="font-mono text-primary">
										rails generate model
									</span>{' '}
									command with all three attributes.
								</p>
								<SimulatedTerminal
									commands={generatorCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={generatorOutput}
								/>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 4: Run Migration */}
						{stepper.currentStep === 3 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Run Migration
								</h3>
								<p className="text-sm text-muted-foreground">
									The generator created a migration file. Run it to create the
									posts table in the database.
								</p>
								<SimulatedTerminal
									commands={migrationCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={migrationOutput}
								/>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Complete */}
						{stepper.isComplete && (
							<div className="text-center py-12 space-y-4">
								<div className="text-4xl">
									{'★'.repeat(stepper.starRating)}
									{'☆'.repeat(3 - stepper.starRating)}
								</div>
								<h3 className="text-xl font-bold text-foreground">
									Post Model Created!
								</h3>
								<p className="text-muted-foreground">
									Your Post model is in the database with title, body, and
									published attributes.
								</p>
								<Button onClick={handleComplete}>Complete Level</Button>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()}>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li>Model names are singular PascalCase (Post, not Posts)</li>
							<li>Table names are auto-pluralized (posts)</li>
							<li>
								<span className="font-mono text-primary">string</span> = short
								text (255 chars),{' '}
								<span className="font-mono text-primary">text</span> = long
								content
							</li>
							<li>
								<span className="font-mono text-primary">id</span>,{' '}
								<span className="font-mono text-primary">created_at</span>,{' '}
								<span className="font-mono text-primary">updated_at</span> are
								automatic
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level3Model;
