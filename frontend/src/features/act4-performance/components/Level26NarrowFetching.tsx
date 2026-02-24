/**
 * Level 26: Narrow Fetching
 *
 * Teaches pluck vs select vs find_in_batches for memory-efficient data fetching.
 * Player picks the right fetching strategy across 4 scenarios.
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
	StepProgress,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating, type StepDef } from '@/hooks/useStepGating';
import {
	ArrowRight,
	Database,
	FileDown,
	HardDrive,
	Layers,
	Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_DEFS: StepDef[] = [
	{ id: 'csv-export', title: 'CSV Export Strategy' },
	{ id: 'dropdown', title: 'Dropdown Data' },
	{ id: 'batch', title: 'Batch Processing' },
	{ id: 'api-response', title: 'API Response Building' },
];

// ---------------------------------------------------------------------------
// Scenario data
// ---------------------------------------------------------------------------

interface Option {
	id: string;
	code: string;
	correct: boolean;
	feedback?: string;
}

interface Scenario {
	id: string;
	title: string;
	description: string;
	codeContext: string;
	icon: 'file-down' | 'layers' | 'database' | 'zap';
	options: Option[];
}

const SCENARIOS: Scenario[] = [
	{
		id: 'csv-export',
		title: 'CSV Export',
		description:
			'Admin dashboard exports 50K user records to CSV. Only id and email are needed. The users table has 30 columns including a 75KB TEXT column (bio).',
		codeContext: `# Current implementation (slow, high memory)
def export_csv
  users = User.all
  CSV.generate do |csv|
    users.each { |u| csv << [u.id, u.email] }
  end
end`,
		icon: 'file-down',
		options: [
			{
				id: 'map-all',
				code: 'User.all.map { |u| [u.id, u.email] }',
				correct: false,
				feedback:
					'This loads full ActiveRecord objects with all 30 columns including the 75KB bio field. Massive memory waste when you only need two columns.',
			},
			{
				id: 'pluck',
				code: 'User.pluck(:id, :email)',
				correct: true,
			},
			{
				id: 'select-with-bio',
				code: 'User.select(:id, :email, :bio)',
				correct: false,
				feedback:
					'This still loads the bio column, the very column causing the memory problem. Check which columns you actually need.',
			},
		],
	},
	{
		id: 'dropdown',
		title: 'Dropdown Populate',
		description:
			'A dropdown needs [id, name] pairs for 10K category records. No model methods are needed, just raw data for the UI.',
		codeContext: `# Populate a <select> dropdown
def category_options
  # Need: [[1, "Tech"], [2, "Science"], ...]
  categories = Category.all
  categories.map { |c| [c.id, c.name] }
end`,
		icon: 'layers',
		options: [
			{
				id: 'all',
				code: 'Category.all',
				correct: false,
				feedback:
					'Loading full ActiveRecord objects for a simple dropdown is wasteful. You instantiate AR overhead for each of 10K records when you only need two plain values.',
			},
			{
				id: 'select',
				code: 'Category.select(:id, :name)',
				correct: false,
				feedback:
					'This creates ActiveRecord objects when you only need plain data. For simple key-value pairs without model methods, there is a lighter approach.',
			},
			{
				id: 'pluck',
				code: 'Category.pluck(:id, :name)',
				correct: true,
			},
		],
	},
	{
		id: 'batch',
		title: 'Batch Processing',
		description:
			'Processing 50K records for a nightly data sync. Each record needs model validations run on it, so you need full AR objects.',
		codeContext: `# Nightly sync job
def sync_all_users
  User.all.each do |user|
    SyncService.process(user)  # needs validations
  end
end`,
		icon: 'database',
		options: [
			{
				id: 'all-each',
				code: 'User.all.each { |u| process(u) }',
				correct: false,
				feedback:
					'This loads ALL 50K records into memory at once. With large datasets this will exhaust memory and crash the process.',
			},
			{
				id: 'find-in-batches',
				code: 'User.find_in_batches(batch_size: 1000) { |batch| batch.each { |u| process(u) } }',
				correct: true,
			},
			{
				id: 'pluck-find',
				code: 'User.pluck(:id).each { |id| process(User.find(id)) }',
				correct: false,
				feedback:
					'This plucks all IDs then does an individual database query for each one, a classic N+1 problem that makes 50K extra queries.',
			},
		],
	},
	{
		id: 'api-response',
		title: 'API Response with Model Methods',
		description:
			'Building an API response that needs user.full_name, a model method that combines first_name and last_name. The table also has large TEXT columns.',
		codeContext: `class User < ApplicationRecord
  def full_name
    "#{first_name} #{last_name}"
  end
end

# API endpoint
def index
  users = User.all
  render json: users.map { |u|
    { id: u.id, name: u.full_name }
  }
end`,
		icon: 'zap',
		options: [
			{
				id: 'pluck-manual',
				code: 'User.pluck(:first_name, :last_name).map { |f,l| "#{f} #{l}" }',
				correct: false,
				feedback:
					'This reimplements the full_name logic in the query layer. If the model method changes, you have to update it in two places. Keep model logic in the model.',
			},
			{
				id: 'all',
				code: 'User.all',
				correct: false,
				feedback:
					'This loads every column when you only need names. Wasteful, especially with large TEXT columns bloating memory.',
			},
			{
				id: 'select',
				code: 'User.select(:id, :first_name, :last_name)',
				correct: true,
			},
		],
	},
];

// ---------------------------------------------------------------------------
// Icon helper
// ---------------------------------------------------------------------------

function ScenarioIcon({
	icon,
	className,
}: { icon: Scenario['icon']; className?: string }) {
	const props = { className: className ?? 'w-5 h-5' };
	switch (icon) {
		case 'file-down':
			return <FileDown {...props} />;
		case 'layers':
			return <Layers {...props} />;
		case 'database':
			return <Database {...props} />;
		case 'zap':
			return <Zap {...props} />;
	}
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level26NarrowFetching({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const [selectedOptions, setSelectedOptions] = useState<
		Record<string, string>
	>({});

	const scenario = SCENARIOS[stepper.currentStep] ?? SCENARIOS[0];
	const isStepDone = stepper.isCurrentStepCompleted;

	// -----------------------------------------------------------------------
	// Handlers
	// -----------------------------------------------------------------------

	const handleOptionClick = (option: Option) => {
		if (isStepDone) return;

		if (option.correct) {
			setSelectedOptions((prev) => ({
				...prev,
				[scenario.id]: option.id,
			}));
			stepper.completeStep();
		} else {
			stepper.recordWrongAttempt(option.feedback ?? 'Not the best choice for this scenario.');
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act4-level26-narrow-fetching', {
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
				message: 'Complete all steps!',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: 'All scenarios mastered!' };
	};

	// -----------------------------------------------------------------------
	// Code preview files
	// -----------------------------------------------------------------------

	const getCodeFiles = () => {
		return [
			{
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
			},
		];
	};

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Choose the right fetching strategy for each scenario to minimize memory usage."
					instructions={[
						'pluck: returns plain arrays, skips AR objects entirely',
						'select: returns AR objects with only specified columns',
						'find_in_batches: processes large datasets in chunks',
						'Match the strategy to what the code actually needs',
					]}
					scenario="Your Rails app is running out of memory in production. Wide fetches load entire rows when you only need a few columns. Pick the narrowest fetch for each situation."
				>
					{/* Step Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Scenarios
						</div>
						<StepProgress
							currentStep={stepper.currentStep}
							onStepClick={stepper.goToStep}
							steps={stepper.steps}
						/>
					</div>

					{/* Memory comparison panel */}
					<div className="p-4 border-t border-border">
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

					{/* Progress bar */}
					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Scenarios completed</span>
							<span
								className={
									stepper.isComplete ? 'text-success' : 'text-foreground'
								}
							>
								{stepper.steps.filter((s) => s.status === 'completed').length} /{' '}
								{STEP_DEFS.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{
									width: `${(stepper.steps.filter((s) => s.status === 'completed').length / STEP_DEFS.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Narrow Fetching"
					levelNumber={26}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-3xl mx-auto space-y-6">
						{/* Scenario description card */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<ScenarioIcon
									className="w-4 h-4 text-primary"
									icon={scenario.icon}
								/>
								<div>
									<div className="text-foreground font-semibold">
										{scenario.title}
									</div>
									<div className="text-xs text-muted-foreground">
										Step {stepper.currentStep + 1} of {STEP_DEFS.length}
									</div>
								</div>
							</div>
							<div className="p-4">
								<p className="text-sm text-muted-foreground leading-relaxed">
									{scenario.description}
								</p>
							</div>
						</div>

						{/* Code context block */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-2 border-b border-border">
								<span className="text-muted-foreground text-sm font-medium">
									Current Code
								</span>
							</div>
							<pre className="p-4 text-sm overflow-x-auto">
								<code className="text-muted-foreground">
									{scenario.codeContext}
								</code>
							</pre>
						</div>

						{/* Options */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Choose the Best Fetching Strategy
								</div>
								<div className="text-xs text-muted-foreground">
									Pick the approach that minimizes memory while meeting the
									requirements
								</div>
							</div>

							<div className="p-4 space-y-3">
								{scenario.options.map((option) => {
									const isSelected =
										selectedOptions[scenario.id] === option.id;
									const isCorrectAndSelected =
										isSelected && option.correct;

									return (
										<Button
											className={`w-full p-4 h-auto rounded-lg text-left justify-start flex-col items-start border-2 transition-all ${
												isCorrectAndSelected
													? 'border-success bg-success/10'
													: isStepDone && !isSelected
														? 'border-border bg-secondary/30 opacity-60'
														: 'border-border bg-secondary/50 hover:border-primary/50 hover:bg-secondary'
											}`}
											disabled={isStepDone}
											key={option.id}
											onClick={() => handleOptionClick(option)}
											variant="outline"
										>
											<pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-all">
												<code>{option.code}</code>
											</pre>
											{isCorrectAndSelected && (
												<div className="mt-2 text-xs text-success flex items-center gap-1.5">
													<Zap className="w-3.5 h-3.5" />
													Optimal choice for this scenario!
												</div>
											)}
										</Button>
									);
								})}
							</div>
						</div>

						{/* Error feedback */}
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

						{/* Completion message */}
						{stepper.isComplete && (
							<div className="bg-success/10 border border-success/30 rounded-xl p-4">
								<div className="flex items-center gap-2 text-success font-semibold mb-1">
									<Database className="w-4 h-4" />
									All Scenarios Complete!
								</div>
								<p className="text-sm text-muted-foreground">
									You chose the right fetching strategy for every scenario.
									Click <span className="text-foreground font-medium">Submit</span> to finish the level.
								</p>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="Use pluck for plain data, select when you need model methods, and find_in_batches for large dataset processing."
				>
					{/* Quick reference */}
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

					{/* Decision tree */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							Decision Tree
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-3 rounded overflow-x-auto leading-relaxed">
							{`Need model methods?
├─ No  → pluck (lightest)
└─ Yes
   ├─ Few records → select
   └─ 10K+ records
      └─ find_in_batches + select`}
						</pre>
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

export default Level26NarrowFetching;
