/**
 * Level 25: Narrow Fetching
 *
 * Sequential phase flow: intro -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Static visualization of memory-wasteful endpoints.
 *   Three annotated code blocks show wide fetches bleeding memory.
 *   Memory bar chart highlights the waste.
 *
 * Phase 2 (HOW - build): 4 OptionCard steps. Pick the right fetching strategy
 *   (pluck, select, find_in_batches) for each scenario.
 *
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Savings" button
 * Phase 4 (ADVANTAGE - reward): Before/after memory benchmarks + problems-solved
 *
 * Teaches: pluck, select, find_in_batches for memory-efficient data fetching
 */

import { ArrowRight, Database, HardDrive, Layers, Play, Star, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
	StepProgress,
	type ValidationResult,
} from '@/components/levels';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Annotated endpoint sections (intro phase)
// ──────────────────────────────────────────────

interface AnnotatedEndpoint {
	id: string;
	label: string;
	description: string;
	code: string;
	memoryWaste: string;
}

const ANNOTATED_ENDPOINTS: AnnotatedEndpoint[] = [
	{
		id: 'csv-export',
		label: 'CSV Export',
		description: 'Loads all 30 columns for 50K users, only needs id and email',
		code: `users = User.all  # SELECT * FROM users
CSV.generate { |csv| users.each { |u| csv << [u.id, u.email] } }`,
		memoryWaste: '681 MB for 2 columns',
	},
	{
		id: 'dropdown',
		label: 'Dropdown',
		description: 'Creates 10K AR objects for simple key-value pairs',
		code: `categories = Category.all
categories.map { |c| [c.id, c.name] }`,
		memoryWaste: '10K objects for 2 values',
	},
	{
		id: 'nightly-sync',
		label: 'Nightly Sync',
		description: 'Loads 50K records into memory simultaneously',
		code: `User.all.each do |user|
  SyncService.process(user)
end`,
		memoryWaste: 'All 50K records at once',
	},
];

// ──────────────────────────────────────────────
// Step definitions (4 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'csv-export', title: 'CSV Export Strategy' },
	{ id: 'dropdown', title: 'Dropdown Data' },
	{ id: 'batch', title: 'Batch Processing' },
	{ id: 'api-response', title: 'API Response Building' },
];

// ──────────────────────────────────────────────
// OptionCard step data
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const OPTION_STEP_CONFIG: Record<
	number,
	{ title: string; description: string; codeContext: string; options: StepOption[] }
> = {
	0: {
		title: 'CSV Export Strategy',
		description:
			'Admin dashboard exports 50K user records to CSV. Only id and email are needed. The users table has 30 columns including a 75KB TEXT column (bio).',
		codeContext: `# Current implementation (slow, high memory)
def export_csv
  users = User.all
  CSV.generate do |csv|
    users.each { |u| csv << [u.id, u.email] }
  end
end`,
		options: [
			{
				id: 'map-all',
				label: 'User.all.map { |u| [u.id, u.email] }',
				correct: false,
				feedback:
					'This loads full ActiveRecord objects with all 30 columns including the 75KB bio field. Massive memory waste when you only need two columns.',
			},
			{
				id: 'pluck',
				label: 'User.pluck(:id, :email)',
				correct: true,
			},
			{
				id: 'select-with-bio',
				label: 'User.select(:id, :email, :bio)',
				correct: false,
				feedback:
					'This still loads the bio column, the very column causing the memory problem. Check which columns you actually need.',
			},
		],
	},
	1: {
		title: 'Dropdown Data',
		description:
			'A dropdown needs [id, name] pairs for 10K category records. No model methods are needed, just raw data for the UI.',
		codeContext: `# Populate a <select> dropdown
def category_options
  # Need: [[1, "Tech"], [2, "Science"], ...]
  categories = Category.all
  categories.map { |c| [c.id, c.name] }
end`,
		options: [
			{
				id: 'all',
				label: 'Category.all',
				correct: false,
				feedback:
					'Loading full ActiveRecord objects for a simple dropdown is wasteful. You instantiate AR overhead for each of 10K records when you only need two plain values.',
			},
			{
				id: 'select',
				label: 'Category.select(:id, :name)',
				correct: false,
				feedback:
					'This creates ActiveRecord objects when you only need plain data. For simple key-value pairs without model methods, there is a lighter approach.',
			},
			{
				id: 'pluck',
				label: 'Category.pluck(:id, :name)',
				correct: true,
			},
		],
	},
	2: {
		title: 'Batch Processing',
		description:
			'Processing 50K records for a nightly data sync. Each record needs model validations run on it, so you need full AR objects.',
		codeContext: `# Nightly sync job
def sync_all_users
  User.all.each do |user|
    SyncService.process(user)  # needs validations
  end
end`,
		options: [
			{
				id: 'all-each',
				label: 'User.all.each { |u| process(u) }',
				correct: false,
				feedback:
					'This loads ALL 50K records into memory at once. With large datasets this will exhaust memory and crash the process.',
			},
			{
				id: 'find-in-batches',
				label: 'User.find_in_batches(batch_size: 1000) { |batch| batch.each { |u| process(u) } }',
				correct: true,
			},
			{
				id: 'pluck-find',
				label: 'User.pluck(:id).each { |id| process(User.find(id)) }',
				correct: false,
				feedback:
					'This plucks all IDs then does an individual database query for each one, a classic N+1 problem that makes 50K extra queries.',
			},
		],
	},
	3: {
		title: 'API Response with Model Methods',
		description:
			'Building an API response that needs user.full_name, a model method that combines first_name and last_name. The table also has large TEXT columns.',
		codeContext: `class User < ApplicationRecord
  def full_name
    "\#{first_name} \#{last_name}"
  end
end

# API endpoint
def index
  users = User.all
  render json: users.map { |u|
    { id: u.id, name: u.full_name }
  }
end`,
		options: [
			{
				id: 'pluck-manual',
				label: 'User.pluck(:first_name, :last_name).map { |f,l| "\#{f} \#{l}" }',
				correct: false,
				feedback:
					'This reimplements the full_name logic in the query layer. If the model method changes, you have to update it in two places. Keep model logic in the model.',
			},
			{
				id: 'all',
				label: 'User.all',
				correct: false,
				feedback:
					'This loads every column when you only need names. Wasteful, especially with large TEXT columns bloating memory.',
			},
			{
				id: 'select',
				label: 'User.select(:id, :first_name, :last_name)',
				correct: true,
			},
		],
	},
};

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	if (phase === 'intro') {
		files.push({
			filename: 'app/controllers/api/v1/users_controller.rb',
			language: 'ruby',
			code: `class Api::V1::UsersController < ApplicationController
  # CSV export: loads ALL 30 columns for 50K users
  def export_csv
    users = User.all  # SELECT * FROM users
    CSV.generate do |csv|
      users.each { |u| csv << [u.id, u.email] }
    end
  end

  # API index: loads ALL columns for full_name
  def index
    users = User.all  # SELECT * FROM users
    render json: users.map { |u|
      { id: u.id, name: u.full_name }
    }
  end
end`,
			highlight: [4, 12],
		});
		return files;
	}

	// Build phase: show the current scenario's context code
	if (phase === 'build') {
		const stepConfig = OPTION_STEP_CONFIG[Math.min(furthestStep, 3)];
		if (stepConfig) {
			files.push({
				filename: 'current_endpoint.rb',
				language: 'ruby',
				code: stepConfig.codeContext,
				highlight: [],
			});
		}
		files.push({
			filename: 'benchmark_comparison.rb',
			language: 'ruby',
			code: `# Memory benchmarks (100K posts, 30 columns)

# Wide fetch: loads everything
Post.all
#=> 681 MB, 149K objects allocated

# Select: partial AR objects
Post.select(:id, :title)
#=> 12.1 MB, 107K objects  (56x less)

# Pluck: plain Ruby arrays
Post.pluck(:id, :title)
#=> 2.35 MB, 45K objects   (290x less)

# Batch: constant memory
Post.find_in_batches(batch_size: 1000) { |batch|
  # ~50 MB per batch regardless of total
}`,
			highlight: [4, 8, 12, 16],
		});
		return files;
	}

	// Activate / reward: show the fixed code
	files.push({
		filename: 'app/controllers/api/v1/users_controller.rb',
		language: 'ruby',
		code: `class Api::V1::UsersController < ApplicationController
  # CSV export: pluck returns plain arrays
  def export_csv
    rows = User.pluck(:id, :email)
    CSV.generate { |csv| rows.each { |r| csv << r } }
  end

  # Dropdown: pluck for raw key-value pairs
  def category_options
    Category.pluck(:id, :name)
  end

  # API index: select for model methods
  def index
    users = User.select(:id, :first_name, :last_name)
    render json: users.map { |u|
      { id: u.id, name: u.full_name }
    }
  end
end`,
		highlight: [4, 10, 15],
	});
	files.push({
		filename: 'app/jobs/nightly_sync_job.rb',
		language: 'ruby',
		code: `class NightlySyncJob < ApplicationJob
  def perform
    User.find_in_batches(batch_size: 1000) do |batch|
      batch.each { |u| SyncService.process(u) }
    end
  end
end`,
		highlight: [3],
	});

	return files;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level25NarrowFetching({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('intro');

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

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

	const handleActivateSavings = () => {
		setPhase('reward');
	};

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
		return { valid: true, message: 'All scenarios mastered!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Rails app is running out of memory in production. Multiple
							endpoints use{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								SELECT *
							</code>{' '}
							when they only need a few columns. A CSV export, a dropdown, and a
							nightly sync are all loading far more data than necessary.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							{phase === 'intro'
								? 'The annotated endpoints below show three different memory waste patterns. Each one needs a different fetching strategy.'
								: 'Choose the right strategy for each scenario: pluck for raw values, select for model methods, find_in_batches for huge datasets.'}
						</p>
					</div>

					{/* Build / activate phases: step progress */}
					{(phase === 'build' || phase === 'activate') && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Scenarios
							</div>
							<StepProgress
								currentStep={stepper.currentStep}
								onStepClick={stepper.goToStep}
								steps={stepper.steps}
							/>
						</div>
					)}

					{/* Memory comparison (visible in all phases) */}
					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							<div className="flex items-center gap-1.5">
								<HardDrive className="w-3.5 h-3.5" />
								Memory Comparison
							</div>
						</div>
						<div className="space-y-2 text-xs font-mono">
							<div className="flex justify-between items-center">
								<span className="text-destructive">Post.all</span>
								<span className="text-destructive">681 MB</span>
							</div>
							<div className="h-2 bg-secondary rounded-full overflow-hidden">
								<div className="h-full bg-destructive rounded-full w-full" />
							</div>

							<div className="flex justify-between items-center">
								<span className="text-warning">select(...</span>
								<span className="text-warning">12.1 MB</span>
							</div>
							<div className="h-2 bg-secondary rounded-full overflow-hidden">
								<div className="h-full bg-warning rounded-full w-[1.8%]" />
							</div>

							<div className="flex justify-between items-center">
								<span className="text-success">pluck(...</span>
								<span className="text-success">2.35 MB</span>
							</div>
							<div className="h-2 bg-secondary rounded-full overflow-hidden">
								<div className="h-full bg-success rounded-full w-[0.35%]" />
							</div>

							<div className="flex justify-between items-center">
								<span className="text-primary">find_in_batches</span>
								<span className="text-primary">~50 MB</span>
							</div>
							<div className="h-2 bg-secondary rounded-full overflow-hidden">
								<div className="h-full bg-primary rounded-full w-[7.3%]" />
							</div>
						</div>
					</div>

					{/* Decision tree (visible in build+) */}
					{phase !== 'intro' && (
						<div className="p-4 border-b border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Decision Tree
							</div>
							<pre className="text-xs text-muted-foreground bg-secondary p-3 rounded overflow-x-auto leading-relaxed">
								{`Need model methods?
\u251C\u2500 No  \u2192 pluck (lightest)
\u2514\u2500 Yes
   \u251C\u2500 Few records \u2192 select
   \u2514\u2500 10K+ records
      \u2514\u2500 find_in_batches + select`}
							</pre>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Narrow Fetching"
					levelNumber={25}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Intro (WHY) ── */}
					{phase === 'intro' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									The Problem: SELECT * Everywhere
								</div>
								<span className="text-xs font-mono text-destructive font-bold">
									3 endpoints, 3 memory leaks
								</span>
							</div>

							{/* Annotated endpoint sections */}
							<div className="px-6 py-2">
								<div className="max-w-lg mx-auto space-y-3">
									{ANNOTATED_ENDPOINTS.map((endpoint) => (
										<div
											key={endpoint.id}
											className="border-l-2 border-l-destructive bg-destructive/5 dark:bg-destructive/5 rounded-r-md px-3 py-2"
										>
											<div className="flex items-center gap-2 mb-1">
												<Badge
													variant="outline"
													className="text-[10px] px-1.5 py-0 border-destructive/50 text-destructive"
												>
													{endpoint.label}
												</Badge>
												<span className="text-[10px] text-destructive font-mono">
													{endpoint.memoryWaste}
												</span>
											</div>
											<p className="text-xs text-muted-foreground mb-1.5">
												{endpoint.description}
											</p>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
												{endpoint.code}
											</pre>
										</div>
									))}
								</div>
							</div>

							{/* Callout */}
							<div className="px-6 py-3">
								<div className="max-w-lg mx-auto">
									<div className="border border-destructive/30 bg-destructive/5 dark:bg-destructive/5 rounded-lg p-3 text-sm text-foreground">
										<strong>Every endpoint uses SELECT *.</strong>{' '}
										Wide fetches load entire rows (including large TEXT columns)
										when the code only reads 2-3 fields. Memory usage is 56x to 290x
										higher than necessary.
									</div>
								</div>
							</div>

							{/* Build the Fix button */}
							<div className="p-4 flex justify-center">
								<Button
									className="gap-2"
									onClick={handleStartBuild}
									size="lg"
								>
									Build the Fix
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								{isViewingCompletedStep ? (
									<div className="space-y-2">
										{currentOptionConfig.options.map((opt) => (
											<OptionCard
												color="violet"
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
											{currentOptionConfig.options.map((opt) => (
												<OptionCard
													color="violet"
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
							</div>
						</div>
					)}

					{/* ── Phase 3: Activate ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex items-center justify-center p-6">
							<div className="max-w-md text-center space-y-6">
								<div className="flex justify-center gap-1">
									{[1, 2, 3].map((s) => (
										<Star
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
											key={s}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Every endpoint is now using the narrowest fetch possible.
									See the memory savings in action.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateSavings}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Savings
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col overflow-auto">
							{/* Header */}
							<div className="px-6 pt-4 pb-2 flex items-center justify-between">
								<div className="text-sm font-semibold text-foreground">
									The Fix: Narrow Fetching Applied
								</div>
							</div>

							{/* Before / After comparison */}
							<div className="px-6 py-2">
								<div className="max-w-lg mx-auto space-y-4">
									{/* Before */}
									<div>
										<div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">
											Before (SELECT *)
										</div>
										<div className="bg-destructive/5 dark:bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
											<div className="grid grid-cols-3 gap-2 text-xs font-mono">
												<div className="text-center">
													<div className="text-destructive font-bold text-lg">681 MB</div>
													<div className="text-muted-foreground">Memory</div>
												</div>
												<div className="text-center">
													<div className="text-destructive font-bold text-lg">149K</div>
													<div className="text-muted-foreground">Objects</div>
												</div>
												<div className="text-center">
													<div className="text-destructive font-bold text-lg">212ms</div>
													<div className="text-muted-foreground">Time</div>
												</div>
											</div>
										</div>
									</div>

									{/* After */}
									<div>
										<div className="text-xs font-semibold text-success uppercase tracking-wider mb-2">
											After (Narrow Fetching)
										</div>
										<div className="bg-success/5 dark:bg-success/5 border border-success/20 rounded-lg p-3 space-y-3">
											<div className="space-y-2">
												<div className="flex items-center justify-between text-xs">
													<span className="font-mono text-foreground">
														CSV: User.pluck(:id, :email)
													</span>
													<span className="text-success font-bold">2.35 MB (290x less)</span>
												</div>
												<div className="flex items-center justify-between text-xs">
													<span className="font-mono text-foreground">
														Dropdown: Category.pluck(:id, :name)
													</span>
													<span className="text-success font-bold">Plain arrays</span>
												</div>
												<div className="flex items-center justify-between text-xs">
													<span className="font-mono text-foreground">
														API: User.select(:id, :first_name, :last_name)
													</span>
													<span className="text-success font-bold">12.1 MB (56x less)</span>
												</div>
												<div className="flex items-center justify-between text-xs">
													<span className="font-mono text-foreground">
														Sync: User.find_in_batches(batch_size: 1000)
													</span>
													<span className="text-success font-bold">~50 MB constant</span>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Problems solved checklist */}
							<div className="px-6 py-3">
								<div className="max-w-lg mx-auto">
									<div className="border border-success/30 bg-success/5 dark:bg-success/5 rounded-lg p-3 space-y-2">
										<div className="text-xs font-semibold text-success uppercase tracking-wider">
											Problems Solved
										</div>
										<div className="space-y-1.5 text-sm text-foreground">
											<div className="flex items-start gap-2">
												<span className="text-success shrink-0 mt-0.5">&#10003;</span>
												<span><strong>CSV export:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">pluck</code> returns plain arrays. No AR objects, 290x less memory.</span>
											</div>
											<div className="flex items-start gap-2">
												<span className="text-success shrink-0 mt-0.5">&#10003;</span>
												<span><strong>Dropdown:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">pluck</code> skips object creation entirely. Raw values for the UI.</span>
											</div>
											<div className="flex items-start gap-2">
												<span className="text-success shrink-0 mt-0.5">&#10003;</span>
												<span><strong>API response:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">select</code> loads only needed columns while keeping model methods.</span>
											</div>
											<div className="flex items-start gap-2">
												<span className="text-success shrink-0 mt-0.5">&#10003;</span>
												<span><strong>Nightly sync:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">find_in_batches</code> processes 1K at a time. Constant memory regardless of total.</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
				>
					{/* Quick reference (visible in all phases) */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							When to Use Each
						</div>
						<div className="space-y-3 text-xs">
							<div>
								<div className="flex items-center gap-1.5 text-success font-medium mb-1">
									<Zap className="w-3 h-3" />
									pluck
								</div>
								<p className="text-muted-foreground">
									Need raw values (dropdowns, CSV, IDs). No model methods needed.
									Returns plain Ruby arrays.
								</p>
							</div>
							<div>
								<div className="flex items-center gap-1.5 text-warning font-medium mb-1">
									<Database className="w-3 h-3" />
									select
								</div>
								<p className="text-muted-foreground">
									Need model methods or associations but not all columns.
									Returns lightweight AR objects.
								</p>
							</div>
							<div>
								<div className="flex items-center gap-1.5 text-primary font-medium mb-1">
									<Layers className="w-3 h-3" />
									find_in_batches
								</div>
								<p className="text-muted-foreground">
									Processing huge datasets. Loads fixed-size chunks so memory
									stays constant regardless of total rows.
								</p>
							</div>
						</div>
					</div>

					{/* Memory savings summary */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Memory Savings
						</div>
						<div className="space-y-1.5 text-xs font-mono">
							<div className="flex justify-between text-muted-foreground">
								<span className="text-destructive">Post.all</span>
								<span>681 MB</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span className="text-warning">select(...)</span>
								<span>12.1 MB (56x less)</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span className="text-success">pluck(...)</span>
								<span>2.35 MB (290x less)</span>
							</div>
							<div className="flex justify-between text-muted-foreground">
								<span className="text-primary">find_in_batches</span>
								<span>~50 MB constant</span>
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level25NarrowFetching;
