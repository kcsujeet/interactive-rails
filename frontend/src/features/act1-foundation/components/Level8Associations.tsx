/**
 * Level 7: Associations
 *
 * 5-step progression to create the Comment model and associate it with Post.
 * Steps: Generate Comment → Choose Relationship → Auto belongs_to → Set Dependent → Test It
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
	RightPanel,
	SimulatedTerminal,
	StepProgress,
	type TerminalHistoryEntry,
	type TerminalOutputLine,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-comment', title: 'Generate Comment' },
	{ id: 'choose-relationship', title: 'Choose Relationship' },
	{ id: 'auto-belongs-to', title: 'Auto belongs_to' },
	{ id: 'set-dependent', title: 'Set Dependent' },
	{ id: 'test-it', title: 'Test It' },
];

export function Level8Associations({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);
	const [relationshipType, setRelationshipType] = useState<string | null>(null);
	const [dependentOption, setDependentOption] = useState<string | null>(null);

	// Step 1: Generate Comment model
	const generateCommands = [
		{
			id: 'wrong-integer',
			label: 'rails generate model Comment body:text post_id:integer',
			command: 'rails generate model Comment body:text post_id:integer',
			correct: false,
			feedback:
				'"post:references" adds the foreign key, index, AND the belongs_to association automatically. "post_id:integer" only adds the column.',
		},
		{
			id: 'correct',
			label: 'rails generate model Comment body:text post:references',
			command: 'rails generate model Comment body:text post:references',
			correct: true,
		},
		{
			id: 'wrong-missing-post',
			label: 'rails generate model Comment body:text',
			command: 'rails generate model Comment body:text',
			correct: false,
			feedback:
				'Comment needs a "post:references" to link to Post. Otherwise there\'s no relationship.',
		},
	];

	const generateOutput: TerminalOutputLine[] = [
		{ text: '      invoke  active_record', color: 'green' },
		{
			text: '      create    db/migrate/20240101000001_create_comments.rb',
			color: 'green',
		},
		{ text: '      create    app/models/comment.rb', color: 'green' },
		{ text: '      invoke    test_unit', color: 'muted' },
	];

	// Step 2: Relationship options
	const RELATIONSHIP_OPTIONS = [
		{
			id: 'has_one',
			label: 'has_one',
			description: 'Only one comment per post',
			correct: false,
			feedback:
				'"has_one" means only one comment per post. Use "has_many" so posts can have unlimited comments.',
		},
		{
			id: 'has_many',
			label: 'has_many',
			description: 'Posts can have unlimited comments',
			correct: true,
			feedback: '',
		},
		{
			id: 'belongs_to',
			label: 'belongs_to',
			description: 'Post belongs to a Comment',
			correct: false,
			feedback:
				'"belongs_to" goes on the child side (Comment). Post is the parent and "has_many" comments.',
		},
		{
			id: 'habtm',
			label: 'has_and_belongs_to_many',
			description: 'Comments shared between posts',
			correct: false,
			feedback:
				'"has_and_belongs_to_many" creates a many-to-many relationship. Comments belong to one post, not shared across many.',
		},
	];

	// Step 4: Dependent options
	const DEPENDENT_OPTIONS = [
		{
			id: 'nullify',
			label: 'dependent: :nullify',
			description: 'Set post_id to NULL on comments',
			correct: false,
			feedback:
				'Orphaned comments with NULL post_id would break your API. Use :destroy to clean them up.',
		},
		{
			id: 'destroy',
			label: 'dependent: :destroy',
			description: 'Delete all comments when the post is deleted',
			correct: true,
			feedback: '',
		},
		{
			id: 'restrict',
			label: 'dependent: :restrict_with_error',
			description: 'Prevent deleting posts that have comments',
			correct: false,
			feedback:
				'For a blog API, cleaning up comments on delete is better than preventing deletion.',
		},
		{
			id: 'nothing',
			label: 'No dependent option',
			description: 'Do nothing when post is deleted',
			correct: false,
			feedback:
				'Orphaned comments would break your API. Add "dependent: :destroy" to clean up.',
		},
	];

	// Step 5: Test
	const testCommands = [
		{
			id: 'create-comment',
			label: 'post.comments.create(body: "Nice!")',
			command: 'post.comments.create(body: "Nice!")',
			correct: true,
		},
	];

	const testOutput: TerminalOutputLine[] = [
		{ text: '=> #<Comment id: 1, body: "Nice!", post_id: 1>', color: 'green' },
		{ text: '', color: 'muted' },
		{ text: '> post.comments.count', color: 'yellow' },
		{ text: '=> 1', color: 'cyan' },
		{ text: '', color: 'muted' },
		{ text: '> post.destroy', color: 'yellow' },
		{
			text: '  Comment Destroy (0.1ms)  DELETE FROM "comments" WHERE "comments"."post_id" = 1',
			color: 'red',
		},
		{
			text: '  Post Destroy (0.1ms)  DELETE FROM "posts" WHERE "posts"."id" = 1',
			color: 'red',
		},
		{ text: '=> #<Post id: 1> (destroyed with 1 comment)', color: 'green' },
	];

	const handleComplete = async () => {
		const success = await completeLevel('act1-level8-associations', {
			stars: stepper.starRating,
			decisions: { relationship: 'has_many', dependent: 'destroy' },
		});
		if (success) {
			onComplete({
				stars: stepper.starRating,
				decisions: { relationship: 'has_many', dependent: 'destroy' },
			});
		}
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'Associations configured correctly!' };
	};

	// Build history from completed prior terminal steps
	const terminalSteps: {
		stepIndex: number;
		commands: { command: string; correct: boolean }[];
		output: TerminalOutputLine[];
	}[] = [
		{ stepIndex: 0, commands: generateCommands, output: generateOutput },
		{ stepIndex: 4, commands: testCommands, output: testOutput },
	];

	const getInitialHistory = (): TerminalHistoryEntry[] => {
		const history: TerminalHistoryEntry[] = [];
		for (const ts of terminalSteps) {
			if (ts.stepIndex >= stepper.currentStep) break;
			const correctCmd = ts.commands.find((c) => c.correct);
			if (correctCmd) {
				history.push({
					command: correctCmd.command,
					output: ts.output,
					isError: false,
				});
			}
		}
		return history;
	};

	const getCodeFiles = () => {
		const files = [];

		// Post model
		const postHasMany = relationshipType === 'has_many';
		const depLine = dependentOption ? `, dependent: :${dependentOption}` : '';
		files.push({
			filename: 'app/models/post.rb',
			language: 'ruby',
			code:
				stepper.currentStep >= 2
					? `class Post < ApplicationRecord
  ${relationshipType || 'has_many'} :comments${postHasMany ? depLine : ''}
end`
					: `class Post < ApplicationRecord
  # No associations yet
end`,
			highlight: stepper.currentStep >= 2 ? [2] : [],
		});

		// Comment model (after step 1)
		if (stepper.currentStep >= 1) {
			files.push({
				filename: 'app/models/comment.rb',
				language: 'ruby',
				code: `class Comment < ApplicationRecord
  belongs_to :post
end`,
				highlight: [2],
			});
		}

		// Migration (after step 1)
		if (stepper.currentStep >= 1) {
			files.push({
				filename: 'db/migrate/create_comments.rb',
				language: 'ruby',
				code: `class CreateComments < ActiveRecord::Migration[8.0]
  def change
    create_table :comments do |t|
      t.text :body
      t.references :post, null: false, foreign_key: true

      t.timestamps
    end
  end
end`,
				highlight: [5],
			});
		}

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Posts need comments! Add a Comment model and connect it to Post
							with the correct relationship.
						</p>
					</div>

					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Associations"
					levelNumber={8}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Generate Comment */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Generate Comment Model
								</h3>
								<p className="text-sm text-muted-foreground">
									Generate the Comment model with a body and a link to Post.
								</p>
								<SimulatedTerminal
									commands={generateCommands}
									initialHistory={getInitialHistory()}
									key={stepper.currentStep}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={generateOutput}
								/>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 2: Choose Relationship */}
						{stepper.currentStep === 1 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Relationship
								</h3>
								<p className="text-sm text-muted-foreground">
									A Post _____ Comments. What relationship type?
								</p>
								<div className="space-y-3">
									{RELATIONSHIP_OPTIONS.map((opt) => (
										<Button
											className="w-full h-auto py-3 text-left"
											key={opt.id}
											onClick={() => {
												if (opt.correct) {
													setRelationshipType(opt.id);
													stepper.completeStep();
												} else {
													stepper.recordWrongAttempt(opt.feedback);
												}
											}}
											variant="outline"
										>
											<div className="w-full">
												<span className="font-mono text-primary">
													{opt.label}
												</span>
												<div className="text-xs text-muted-foreground mt-1">
													{opt.description}
												</div>
											</div>
										</Button>
									))}
								</div>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 3: Auto belongs_to (informational) */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Auto belongs_to
								</h3>
								<div className="bg-card rounded-lg border border-border p-6 space-y-3">
									<p className="text-sm text-foreground">
										Because you used{' '}
										<span className="font-mono text-primary">
											post:references
										</span>{' '}
										in the generator, Rails automatically added:
									</p>
									<div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
										<div className="text-zinc-400">
											class Comment {'<'} ApplicationRecord
										</div>
										<div className="text-emerald-400 ml-4">
											belongs_to :post
										</div>
										<div className="text-zinc-400">end</div>
									</div>
									<p className="text-sm text-muted-foreground">
										The inverse relationship is set up for free. Every Comment
										knows which Post it belongs to.
									</p>
								</div>
								<div className="flex justify-center">
									<Button onClick={() => stepper.completeStep()}>Got It</Button>
								</div>
							</div>
						)}

						{/* Step 4: Set Dependent */}
						{stepper.currentStep === 3 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Set Dependent
								</h3>
								<p className="text-sm text-muted-foreground">
									When a Post is destroyed, what should happen to its comments?
								</p>
								<div className="space-y-3">
									{DEPENDENT_OPTIONS.map((opt) => (
										<Button
											className="w-full h-auto py-3 text-left"
											key={opt.id}
											onClick={() => {
												if (opt.correct) {
													setDependentOption(opt.id);
													stepper.completeStep();
												} else {
													stepper.recordWrongAttempt(opt.feedback);
												}
											}}
											variant="outline"
										>
											<div className="w-full">
												<span className="font-mono text-primary">
													{opt.label}
												</span>
												<div className="text-xs text-muted-foreground mt-1">
													{opt.description}
												</div>
											</div>
										</Button>
									))}
								</div>
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
							</div>
						)}

						{/* Step 5: Test It */}
						{stepper.currentStep === 4 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Test It
								</h3>
								<p className="text-sm text-muted-foreground">
									Create a comment through the association, then destroy the
									post to verify cascade.
								</p>
								<SimulatedTerminal
									commands={testCommands}
									initialHistory={getInitialHistory()}
									key={stepper.currentStep}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={testOutput}
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
									Associations Configured!
								</h3>
								<p className="text-muted-foreground">
									Post has_many :comments, dependent: :destroy. Comment
									belongs_to :post.
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
							<li>
								<span className="font-mono text-primary">has_many</span>: one
								Post has many Comments
							</li>
							<li>
								<span className="font-mono text-primary">belongs_to</span>: one
								Comment belongs to one Post
							</li>
							<li>
								<span className="font-mono text-primary">
									dependent: :destroy
								</span>{' '}
								= cascade delete
							</li>
							<li>
								<span className="font-mono text-primary">post:references</span>{' '}
								= auto FK + index + belongs_to
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level8Associations;
