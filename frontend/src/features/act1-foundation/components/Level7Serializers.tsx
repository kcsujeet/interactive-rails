/**
 * Level 7: Serializers
 *
 * 4-step progression to add a JSON:API serializer to the API.
 * Steps: Choose Gem → Install Gem → Define Attributes → Update Controller
 */

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
	type TerminalOutputLine,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { ArrowRight, Check, Package, Shield, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_DEFS: StepDef[] = [
	{ id: 'choose-gem', title: 'Choose Gem' },
	{ id: 'install-gem', title: 'Install Gem' },
	{ id: 'define-attributes', title: 'Define Attributes' },
	{ id: 'update-controller', title: 'Update Controller' },
];

// ---------------------------------------------------------------------------
// Step 1: Gem options (correct answer NOT first)
// ---------------------------------------------------------------------------

interface GemOption {
	id: string;
	name: string;
	description: string;
	correct: boolean;
	feedback: string;
}

const GEM_OPTIONS: GemOption[] = [
	{
		id: 'ams',
		name: 'ActiveModelSerializers',
		description: 'Classic Rails serializer',
		correct: false,
		feedback:
			'ActiveModelSerializers is unmaintained and significantly slower. The community has moved on to faster alternatives.',
	},
	{
		id: 'jsonapi-serializer',
		name: 'jsonapi-serializer',
		description: 'Fast JSON:API serializer',
		correct: true,
		feedback: '',
	},
	{
		id: 'jbuilder',
		name: 'Jbuilder',
		description: 'Template-based JSON builder',
		correct: false,
		feedback:
			'Jbuilder uses view templates for JSON. It adds rendering overhead and is not well-suited for a pure REST API.',
	},
	{
		id: 'blueprinter',
		name: 'Blueprinter',
		description: 'Simple flat JSON serializer',
		correct: false,
		feedback:
			'Blueprinter produces flat JSON, not the JSON:API standard. For public APIs, a standards-compliant format is preferred.',
	},
];

// ---------------------------------------------------------------------------
// Step 2: Install commands (correct answer NOT first)
// ---------------------------------------------------------------------------

const installCommands = [
	{
		id: 'gem-install',
		label: 'gem install jsonapi-serializer',
		command: 'gem install jsonapi-serializer',
		correct: false,
		feedback:
			'That installs the gem system-wide, not in your project. Bundler manages per-project dependencies.',
	},
	{
		id: 'bundle-install',
		label: 'bundle install',
		command: 'bundle install',
		correct: true,
	},
	{
		id: 'generate',
		label: 'rails generate serializer Post',
		command: 'rails generate serializer Post',
		correct: false,
		feedback:
			'No generator is available yet. The gem must be installed first.',
	},
];

const installOutput: TerminalOutputLine[] = [
	{ text: 'Fetching gem metadata from https://rubygems.org/...', color: 'muted' },
	{ text: 'Resolving dependencies...', color: 'muted' },
	{ text: 'Installing jsonapi-serializer 2.2.0', color: 'green' },
	{ text: 'Bundle complete! 42 Gemfile dependencies, 78 gems now installed.', color: 'green' },
];

// ---------------------------------------------------------------------------
// Step 3: Attribute selection
// ---------------------------------------------------------------------------

interface AttributeOption {
	id: string;
	name: string;
	safe: boolean;
	feedback: string;
}

const ATTRIBUTES: AttributeOption[] = [
	{ id: 'title', name: 'title', safe: true, feedback: '' },
	{
		id: 'created_at',
		name: 'created_at',
		safe: false,
		feedback:
			'Serializers are about choosing what your API exposes. created_at is bookkeeping, not domain data clients need.',
	},
	{ id: 'body', name: 'body', safe: true, feedback: '' },
	{
		id: 'updated_at',
		name: 'updated_at',
		safe: false,
		feedback:
			'updated_at tracks internal record changes. Expose domain-relevant fields instead.',
	},
	{ id: 'published_at', name: 'published_at', safe: true, feedback: '' },
	{
		id: 'id',
		name: 'id',
		safe: false,
		feedback:
			'JSON:API puts the id in the top-level data object, not inside attributes. The serializer handles this automatically.',
	},
];

const SAFE_ATTRIBUTES = ATTRIBUTES.filter((a) => a.safe).map((a) => a.id);

// ---------------------------------------------------------------------------
// Step 4: Controller update options (correct answer NOT first)
// ---------------------------------------------------------------------------

interface RenderOption {
	id: string;
	code: string;
	correct: boolean;
	feedback: string;
}

const RENDER_OPTIONS: RenderOption[] = [
	{
		id: 'raw-json',
		code: 'render json: post',
		correct: false,
		feedback:
			'That renders the raw model as flat JSON. Every column is dumped with no structure or formatting.',
	},
	{
		id: 'to-json',
		code: 'render json: post.to_json',
		correct: false,
		feedback:
			'to_json also dumps all model attributes. You need to route through the serializer to control the output.',
	},
	{
		id: 'serializer',
		code: 'render json: PostSerializer.new(post).serializable_hash.to_json',
		correct: true,
		feedback: '',
	},
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level7Serializers({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;

	// Step 1: selected gem
	const [selectedGem, setSelectedGem] = useState<string | null>(null);

	// Step 3: selected attributes
	const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);

	// Step 4: selected render option
	const [selectedRender, setSelectedRender] = useState<string | null>(null);

	// Step 1: Gem selection
	const handleSelectGem = (gem: GemOption) => {
		if (isViewingCompletedStep) return;
		if (gem.correct) {
			setSelectedGem(gem.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(gem.feedback);
		}
	};

	// Step 3: Attribute selection
	const handleToggleAttr = (attr: AttributeOption) => {
		if (isViewingCompletedStep) return;

		if (attr.safe) {
			if (!selectedAttrs.includes(attr.id)) {
				const newAttrs = [...selectedAttrs, attr.id];
				setSelectedAttrs(newAttrs);

				// Check if all safe attributes are selected
				if (SAFE_ATTRIBUTES.every((id) => newAttrs.includes(id))) {
					stepper.completeStep();
				}
			}
		} else {
			stepper.recordWrongAttempt(attr.feedback);
		}
	};

	// Step 4: Render option selection
	const handleSelectRender = (option: RenderOption) => {
		if (isViewingCompletedStep) return;
		if (option.correct) {
			setSelectedRender(option.id);
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// Completion (parent handles API call + guest fallback)
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
		return { valid: true, message: 'Serializer is ready!' };
	};

	// Terminal step data for building history (only step 1 is a terminal step)
	const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
		null, // step 0: Choose Gem (click-to-select)
		{ commands: installCommands, outputLines: installOutput },
		null, // step 2: Define Attributes (click-to-select)
		null, // step 3: Update Controller (click-to-select)
	];

	// Code preview that evolves with progress
	const getCodeFiles = () => {
		const files = [];

		// Before any progress: show broken controller
		if (stepper.furthestStep === 0) {
			files.push({
				filename: 'app/controllers/api/v1/posts_controller.rb',
				language: 'ruby',
				code: `class Api::V1::PostsController < ApplicationController
  def show
    post = Post.find(params[:id])
    render json: post  # Dumps everything!
  end
end`,
				highlight: [4],
			});
		}

		// After step 1: Gemfile
		if (stepper.furthestStep >= 1) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `source "https://rubygems.org"

gem "rails", "~> 8.0"
gem "pg"
gem "puma"
gem "jsonapi-serializer"`,
				highlight: [6],
			});
		}

		// After step 3: Serializer class
		if (stepper.furthestStep >= 3) {
			const attrLines =
				selectedAttrs.length > 0
					? selectedAttrs
							.map((a) => {
								if (a === 'published_at') {
									return `  attribute :published_at do |post|\n    post.published_at&.strftime("%B %d, %Y")\n  end`;
								}
								return `  attribute :${a}`;
							})
							.join('\n')
					: '  # attributes...';

			files.push({
				filename: 'app/serializers/post_serializer.rb',
				language: 'ruby',
				code: `class PostSerializer < BaseSerializer
${attrLines}
end`,
				highlight: selectedAttrs.map((_, i) => i + 2),
			});
		}

		// After step 4: Updated controller
		if (stepper.furthestStep >= 4) {
			files.push({
				filename: 'app/controllers/api/v1/posts_controller.rb',
				language: 'ruby',
				code: `class Api::V1::PostsController < ApplicationController
  def show
    post = Post.find(params[:id])
    render json: PostSerializer.new(post)
                   .serializable_hash.to_json
  end
end`,
				highlight: [4, 5],
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
							In Level 6, your controller returns{' '}
							<span className="font-mono text-primary">render json: post</span>,
							which dumps every column as flat JSON. Add a serializer
							to shape the output into the JSON:API standard.
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
					levelName="Serializers"
					levelNumber={7}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Step 1: Choose Gem */}
						{stepper.currentStep === 0 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Choose Serializer Gem
								</h3>
								<p className="text-sm text-muted-foreground">
									Your API needs a serialization layer. Pick the gem that
									gives you JSON:API compliance, speed, and active
									maintenance.
								</p>

								<div className="grid gap-2">
									{GEM_OPTIONS.map((gem) => (
										<OptionCard
											color="blue"
											description={gem.description}
											disabled={isViewingCompletedStep}
											icon={Package}
											key={gem.id}
											name={gem.name}
											onClick={() => handleSelectGem(gem)}
											selected={selectedGem === gem.id}
										/>
									))}
								</div>

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

						{/* Step 2: Install Gem */}
						{stepper.currentStep === 1 && (
							<TerminalChoiceStep
								commands={installCommands}
								completed={stepper.currentStep < stepper.furthestStep}
								description={
									<p className="text-sm text-muted-foreground">
										The gem is in your Gemfile. Now install it so it's
										available in your Rails app.
									</p>
								}
								hasNext={stepper.currentStep < STEP_DEFS.length - 1}
								initialHistory={buildTerminalHistory(
									TERMINAL_STEP_MAP,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={installOutput}
								stepKey={stepper.currentStep}
								title="Install the Gem"
							/>
						)}

						{/* Step 3: Define Attributes */}
						{stepper.currentStep === 2 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Define Attributes
								</h3>
								<p className="text-sm text-muted-foreground">
									Your Post model has {ATTRIBUTES.length} columns. Pick the
									domain attributes clients need. Skip bookkeeping columns
									and anything JSON:API handles automatically.
								</p>

								{/* Attribute grid */}
								<div className="grid grid-cols-2 gap-2">
									{ATTRIBUTES.map((attr) => {
										const isSelected = selectedAttrs.includes(attr.id);
										return (
											<Button
												className={`flex items-center justify-start gap-2 px-3 py-2.5 rounded-lg border text-sm font-mono transition-all ${
													isSelected
														? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
														: 'border-border bg-card hover:border-blue-500/40 text-foreground'
												} ${isViewingCompletedStep ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
												disabled={isSelected || isViewingCompletedStep}
												key={attr.id}
												onClick={() => handleToggleAttr(attr)}
											>
												{isSelected ? (
													<Check className="w-4 h-4 text-emerald-400 shrink-0" />
												) : (
													<div className="w-4 h-4 rounded border border-muted-foreground/30 shrink-0" />
												)}
												{attr.name}
											</Button>
										);
									})}
								</div>

								{/* Live serializer preview */}
								<div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
									<div className="text-zinc-400">
										class PostSerializer {'<'} BaseSerializer
									</div>
									<div className="mt-2">
										{selectedAttrs.length > 0 ? (
											selectedAttrs.map((attrId) => (
												<div className="ml-4 text-emerald-400" key={attrId}>
													attribute :{attrId}
												</div>
											))
										) : (
											<div className="ml-4 text-zinc-600 animate-pulse">
												# select attributes above...
											</div>
										)}
									</div>
									<div className="text-zinc-400">end</div>
								</div>

								<div className="text-xs text-muted-foreground">
									{selectedAttrs.length} / {SAFE_ATTRIBUTES.length} domain
									attributes selected
								</div>

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

						{/* Step 4: Update Controller */}
						{stepper.currentStep === 3 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Update Controller
								</h3>
								<p className="text-sm text-muted-foreground">
									Replace the raw{' '}
									<span className="font-mono text-primary">
										render json: post
									</span>{' '}
									call in your controller. Pick the correct render
									statement.
								</p>

								<div className="grid gap-2">
									{RENDER_OPTIONS.map((option) => (
										<OptionCard
											color="blue"
											disabled={isViewingCompletedStep}
											key={option.id}
											mono
											name={option.code}
											onClick={() => handleSelectRender(option)}
											selected={selectedRender === option.id}
										/>
									))}
								</div>

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

						{/* Completion: ADVANTAGE phase with before/after */}
						{stepper.isComplete && (
							<div className="space-y-6 py-6">
								<div className="text-center space-y-2">
									<div className="text-4xl">
										{'★'.repeat(stepper.starRating)}
										{'☆'.repeat(3 - stepper.starRating)}
									</div>
									<h3 className="text-xl font-bold text-foreground">
										Serializer Added!
									</h3>
								</div>

								{/* Before / After comparison */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-red-400">
											<X className="w-4 h-4" />
											Before
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">{'{'}</div>
											<div className="ml-2 text-zinc-300">
												"id": 1,
											</div>
											<div className="ml-2 text-zinc-300">
												"title": "Hello",
											</div>
											<div className="ml-2 text-zinc-300">
												"body": "World",
											</div>
											<div className="ml-2 text-zinc-300">
												"published_at": "2024-01-01T00:00:00.000Z",
											</div>
											<div className="ml-2 text-zinc-500">
												"created_at": "2024-01-01T00:00:00.000Z",
											</div>
											<div className="ml-2 text-zinc-500">
												"updated_at": "2024-01-01T00:00:00.000Z"
											</div>
											<div className="text-zinc-400">{'}'}</div>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
											<Shield className="w-4 h-4" />
											After (JSON:API)
										</div>
										<div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs leading-relaxed">
											<div className="text-zinc-400">{'{'}</div>
											<div className="ml-2 text-zinc-300">
												"data": {'{'}
											</div>
											<div className="ml-4 text-zinc-300">
												"id": "1",
											</div>
											<div className="ml-4 text-zinc-300">
												"type": "posts",
											</div>
											<div className="ml-4 text-zinc-300">
												"attributes": {'{'}
											</div>
											<div className="ml-6 text-emerald-400">
												"title": "Hello",
											</div>
											<div className="ml-6 text-emerald-400">
												"body": "World",
											</div>
											<div className="ml-6 text-emerald-400">
												"published_at": "January 01, 2024"
											</div>
											<div className="ml-4 text-zinc-300">{'}'}</div>
											<div className="ml-2 text-zinc-300">{'}'}</div>
											<div className="text-zinc-400">{'}'}</div>
										</div>
									</div>
								</div>

								<p className="text-sm text-muted-foreground text-center">
									Only domain attributes are exposed. The response follows
									the JSON:API standard with typed, structured output.
								</p>

								<div className="flex justify-center">
									<Button onClick={handleComplete}>
										Complete Level
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()}>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							JSON:API Standard
						</div>
						<div className="text-xs text-muted-foreground space-y-1">
							<div>
								<span className="text-emerald-400 font-mono">data</span>:
								Resource envelope
							</div>
							<div>
								<span className="text-emerald-400 font-mono">type</span>:
								Resource name (plural)
							</div>
							<div>
								<span className="text-blue-400 font-mono">attributes</span>:
								Only safe fields
							</div>
							<div>
								<span className="text-amber-400 font-mono">
									relationships
								</span>
								: Linked resources
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level7Serializers;
