/**
 * Level 45: Data Lifecycle
 *
 * Hot/warm/cold data classification, archiving strategies,
 * and data destruction. 4-step click-to-select progression.
 */

import {
	Archive,
	Database,
	Flame,
	HardDrive,
	Thermometer,
	Trash2,
} from 'lucide-react';
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

// ── Step definitions ────────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'classify-hot', title: 'Identify Hot Data' },
	{ id: 'archive-warm', title: 'Warm Data Strategy' },
	{ id: 'cold-data', title: 'Cold Data Destination' },
	{ id: 'destruction', title: 'Data Destruction' },
];

// ── Scenario & option data ──────────────────────────────────────────

interface StepScenario {
	title: string;
	context: string;
	codeSnippet: string;
	options: {
		id: string;
		label: string;
		correct: boolean;
		feedback: string;
	}[];
}

const SCENARIOS: StepScenario[] = [
	{
		title: 'Classify Hot Data',
		context:
			'The orders table has 50M rows. Performance is degrading. You need to classify which data is "hot": accessed frequently, needs full read/write access.',
		codeSnippet: `# orders table: 50,000,000 rows
# Average query time: 2.3s (was 200ms)
# Daily active queries hit orders table 15K times/hour
# Support team searches recent orders constantly
# Dashboard shows real-time order metrics`,
		options: [
			{
				id: 'all-5-years',
				label: 'All orders from the past 5 years',
				correct: false,
				feedback:
					'Five years of data is far too broad. Most daily operations only touch recent orders. Keeping everything "hot" defeats the purpose of data classification.',
			},
			{
				id: 'older-than-1yr',
				label: 'Orders older than 1 year',
				correct: false,
				feedback:
					'Old orders are almost never accessed for daily operations. They belong in a colder tier, not the hot tier.',
			},
			{
				id: 'last-30-days',
				label: 'Orders from the last 30 days',
				correct: true,
				feedback: '',
			},
		],
	},
	{
		title: 'Warm Data Strategy',
		context:
			'Orders from 30-365 days ago are read-only (no updates). Your reports team still needs SQL query access for monthly analytics.',
		codeSnippet: `# Warm data characteristics:
# - 12.5M rows (30-365 days old)
# - Read-only: no updates or deletes
# - Monthly report queries need SQL access
# - Current location: same orders table as hot data`,
		options: [
			{
				id: 'export-s3-json',
				label: 'Export to S3 as JSON files',
				correct: false,
				feedback:
					"S3 files aren't directly queryable with SQL. You'd need an additional query engine. That's overkill for data your reports team needs regular SQL access to.",
			},
			{
				id: 'same-table-status',
				label: 'Keep in the same table, add a status column',
				correct: false,
				feedback:
					'Keeping warm data in the same table means 50M rows still slow every query. Adding a column does nothing to reduce the table size that causes the performance problem.',
			},
			{
				id: 'separate-table',
				label: 'Move to a separate archived_orders table',
				correct: true,
				feedback: '',
			},
		],
	},
	{
		title: 'Cold Data Destination',
		context:
			'Orders older than 1 year are rarely accessed. The only requirement: compliance audits need this data once per year.',
		codeSnippet: `# Cold data characteristics:
# - 35M rows (older than 1 year)
# - Accessed ~1 time per year for audits
# - Must be retained for compliance
# - Currently: bloating the database at $$$`,
		options: [
			{
				id: 'keep-archived',
				label: 'Keep in the archived_orders table',
				correct: false,
				feedback:
					'The archived_orders table holds warm data that needs regular SQL access. Storing years of cold data in the database wastes expensive database storage for data accessed once a year.',
			},
			{
				id: 'export-parquet',
				label: 'Export to S3 as compressed Parquet files',
				correct: true,
				feedback: '',
			},
			{
				id: 'delete-immediately',
				label: 'Delete immediately',
				correct: false,
				feedback:
					'Compliance requires retaining order data for a minimum number of years. Deleting this data could violate legal retention requirements.',
			},
		],
	},
	{
		title: 'Data Destruction',
		context:
			'Session logs table: 200M rows. Average age: 18 months. Only the last 7 days are used for debugging. There is no compliance requirement for session logs.',
		codeSnippet: `# session_logs table: 200,000,000 rows
# Used for: debugging (last 7 days only)
# Compliance requirement: NONE
# Storage cost: $1,200/month growing 15%/month
# Backup time: 45 min (was 5 min)`,
		options: [
			{
				id: 'archive-all-s3',
				label: 'Archive all to S3, keep DB empty',
				correct: false,
				feedback:
					'Session logs have no long-term value and no compliance requirement. Archiving 200M rows of debugging data wastes storage for data nobody will ever read again.',
			},
			{
				id: 'keep-add-index',
				label: 'Keep all logs, add an index on created_at',
				correct: false,
				feedback:
					"An index helps query speed but doesn't solve the core problem. 200M rows of stale logs still consume disk space, slow backups, and bloat migrations.",
			},
			{
				id: 'delete-old',
				label: 'Delete logs older than 30 days',
				correct: true,
				feedback: '',
			},
		],
	},
];

// ── Data volume breakdown ───────────────────────────────────────────

const DATA_TIERS = [
	{
		label: 'Hot',
		rows: '2.5M',
		pct: 5,
		color: 'bg-emerald-500',
		textColor: 'text-emerald-400',
		description: 'Last 30 days',
		icon: Flame,
	},
	{
		label: 'Warm',
		rows: '12.5M',
		pct: 25,
		color: 'bg-amber-500',
		textColor: 'text-amber-400',
		description: '30-365 days',
		icon: Thermometer,
	},
	{
		label: 'Cold',
		rows: '35M',
		pct: 70,
		color: 'bg-slate-500',
		textColor: 'text-slate-400',
		description: '1yr+',
		icon: HardDrive,
	},
];

// ── Component ───────────────────────────────────────────────────────

export function Level45DataLifecycle({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);

	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	const scenario = SCENARIOS[stepper.currentStep] ?? SCENARIOS[0];

	const handleOptionClick = (optionId: string) => {
		const option = scenario.options.find((o) => o.id === optionId);
		if (!option) return;

		setSelectedOption(optionId);

		if (option.correct) {
			stepper.completeStep();
			setSelectedOption(null);
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act6-level45-data-lifecycle', {
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
		return {
			valid: true,
			message: 'Data lifecycle strategy configured!',
		};
	};

	const handleReset = () => {
		window.location.reload();
	};

	// ── Code preview files per step ─────────────────────────────────

	const getCodeFiles = () => {
		const baseFile = {
			filename: 'data_lifecycle_strategy.rb',
			language: 'ruby',
			code: `# Data Temperature Classification
# Hot:  Last 30 days, full read/write
# Warm: 30-365 days, read-only, SQL access
# Cold: 1yr+, export-only, cheapest storage

# Archiving warm data
class ArchiveOldOrders
  def call
    Order.where('created_at < ?', 30.days.ago)
         .where('created_at > ?', 1.year.ago)
         .find_in_batches(batch_size: 1000) do |batch|
      ArchivedOrder.insert_all(batch.map(&:attributes))
      Order.where(id: batch.map(&:id)).delete_all
    end
  end
end

# Destroying cold data
class PurgeSessionLogs
  def call
    SessionLog.where('created_at < ?', 30.days.ago)
              .in_batches(of: 10_000)
              .delete_all
  end
end`,
			highlight: [1, 2, 3, 4, 9, 10, 11, 12, 13, 21, 22, 23],
		};

		if (stepper.currentStep === 0 || stepper.isComplete) {
			return [baseFile];
		}

		if (stepper.currentStep === 1) {
			return [
				baseFile,
				{
					filename: 'archive_warm_data.rb',
					language: 'ruby',
					code: `# Move warm data to a separate table
# Still queryable with SQL for reports
class ArchiveWarmOrders
  def call
    Order.where(created_at: 1.year.ago..30.days.ago)
         .find_in_batches(batch_size: 1000) do |batch|
      ArchivedOrder.insert_all(
        batch.map(&:attributes)
      )
      Order.where(id: batch.map(&:id)).delete_all
    end

    Rails.logger.info "Archived #{count} warm orders"
  end
end`,
					highlight: [5, 6, 7, 10],
				},
			];
		}

		if (stepper.currentStep === 2) {
			return [
				baseFile,
				{
					filename: 'export_cold_data.rb',
					language: 'ruby',
					code: `# Export cold data to S3 as Parquet
# Cheapest storage, loaded on-demand
class ExportColdOrders
  def call
    cold = ArchivedOrder.where(
      'created_at < ?', 1.year.ago
    )

    cold.find_in_batches(batch_size: 5000) do |batch|
      parquet = to_parquet(batch)
      S3.upload("orders/cold/#{Date.today}.parquet", parquet)
    end

    cold.delete_all  # Remove from DB
  end
end`,
					highlight: [5, 6, 9, 10, 11, 14],
				},
			];
		}

		if (stepper.currentStep === 3) {
			return [
				baseFile,
				{
					filename: 'purge_session_logs.rb',
					language: 'ruby',
					code: `# No compliance requirement = destroy safely
# "Destroying data is the most effective
#  scalability solution."
class PurgeSessionLogs
  def call
    deleted = SessionLog
      .where('created_at < ?', 30.days.ago)
      .in_batches(of: 10_000)
      .delete_all

    Rails.logger.info "Purged #{deleted} session logs"
  end
end`,
					highlight: [1, 2, 3, 6, 7, 8, 9],
				},
			];
		}

		return [baseFile];
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your orders table has 50M rows and queries are crawling. Not all
							data is accessed equally. Classify data by temperature and move
							each tier to the right storage.
						</p>
					</div>

					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>

					{/* Data volume visualization */}
					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Data Temperature Map
						</div>
						<div className="space-y-3">
							{DATA_TIERS.map((tier) => {
								const Icon = tier.icon;
								return (
									<div key={tier.label}>
										<div className="flex items-center justify-between mb-1">
											<div className="flex items-center gap-2">
												<Icon
													className={`w-3.5 h-3.5 ${tier.textColor}`}
												/>
												<span className="text-xs font-medium text-foreground">
													{tier.label}
												</span>
												<span className="text-xs text-muted-foreground">
													({tier.description})
												</span>
											</div>
											<div className="text-xs font-mono text-muted-foreground">
												{tier.rows} ({tier.pct}%)
											</div>
										</div>
										<div className="h-3 bg-secondary rounded-full overflow-hidden">
											<div
												className={`h-full ${tier.color} rounded-full transition-all duration-500`}
												style={{ width: `${tier.pct}%` }}
											/>
										</div>
									</div>
								);
							})}
						</div>
						<div className="mt-3 text-xs text-muted-foreground text-center">
							50M total rows across all temperature tiers
						</div>
					</div>

					{/* Cost summary */}
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Storage Cost Breakdown
						</div>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Database className="w-3 h-3 text-primary" />
									DB (hot + warm)
								</span>
								<span className="font-mono text-foreground">$2,400/mo</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Archive className="w-3 h-3 text-amber-400" />
									DB (archived table)
								</span>
								<span className="font-mono text-foreground">$800/mo</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<HardDrive className="w-3 h-3 text-slate-400" />
									S3 (cold/Parquet)
								</span>
								<span className="font-mono text-foreground">$12/mo</span>
							</div>
							<div className="border-t border-border pt-2 flex justify-between">
								<span className="text-muted-foreground">After lifecycle</span>
								<span className="font-mono text-success font-semibold">
									-65% cost
								</span>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Data Lifecycle"
					levelNumber={45}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Active step scenario */}
						{!stepper.isComplete && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									{scenario.title}
								</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{scenario.context}
								</p>

								{/* Code context card */}
								<div className="bg-zinc-900 rounded-lg border border-border overflow-hidden">
									<div className="px-4 py-2 bg-zinc-800 border-b border-border flex items-center gap-2">
										<Database className="w-3.5 h-3.5 text-muted-foreground" />
										<span className="text-xs text-muted-foreground font-mono">
											scenario context
										</span>
									</div>
									<pre className="p-4 text-sm font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
										{scenario.codeSnippet}
									</pre>
								</div>

								{/* Options */}
								<div className="space-y-3">
									{scenario.options.map((opt) => (
										<Button
											className={`w-full h-auto py-4 px-5 text-left text-sm leading-relaxed transition-all ${
												selectedOption === opt.id && !opt.correct
													? 'border-destructive/50'
													: ''
											}`}
											key={opt.id}
											onClick={() => handleOptionClick(opt.id)}
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

						{/* Level complete */}
						{stepper.isComplete && (
							<div className="text-center py-12 space-y-4">
								<div className="text-4xl">
									{'★'.repeat(stepper.starRating)}
									{'☆'.repeat(3 - stepper.starRating)}
								</div>
								<h3 className="text-xl font-bold text-foreground">
									Data Lifecycle Configured!
								</h3>
								<p className="text-muted-foreground max-w-md mx-auto">
									Hot data stays fast, warm data stays queryable, cold data goes
									to cheap storage, and worthless data gets destroyed.
								</p>

								{/* Before/after summary */}
								<div className="mt-6 bg-card rounded-xl border border-border overflow-hidden text-left max-w-md mx-auto">
									<div className="bg-secondary px-4 py-3 border-b border-border text-sm font-semibold text-foreground">
										Result Summary
									</div>
									<div className="divide-y divide-border">
										<div className="px-4 py-3 flex justify-between text-sm">
											<span className="text-muted-foreground">
												Orders table (before)
											</span>
											<span className="font-mono text-destructive">
												50M rows
											</span>
										</div>
										<div className="px-4 py-3 flex justify-between text-sm">
											<span className="text-muted-foreground">
												Orders table (after)
											</span>
											<span className="font-mono text-success">2.5M rows</span>
										</div>
										<div className="px-4 py-3 flex justify-between text-sm">
											<span className="text-muted-foreground">
												Query time improvement
											</span>
											<span className="font-mono text-success">~20x faster</span>
										</div>
										<div className="px-4 py-3 flex justify-between text-sm">
											<span className="text-muted-foreground">
												Storage cost reduction
											</span>
											<span className="font-mono text-success">-65%</span>
										</div>
									</div>
								</div>

								<Button className="mt-4" onClick={handleComplete}>
									Complete Level
								</Button>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="Classify data by access frequency: hot (read/write, recent), warm (read-only, SQL-queryable), cold (export to cheap storage). Destroy data with no compliance requirement. It's the most effective scalability solution."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Data Temperature Rules
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<Flame className="w-3 h-3 mt-0.5 text-emerald-400 shrink-0" />
								<span>
									<span className="text-emerald-400 font-medium">Hot:</span>{' '}
									Full read/write, same table, indexed
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Thermometer className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
								<span>
									<span className="text-amber-400 font-medium">Warm:</span>{' '}
									Read-only, separate table, SQL access
								</span>
							</li>
							<li className="flex items-start gap-2">
								<HardDrive className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
								<span>
									<span className="text-slate-400 font-medium">Cold:</span>{' '}
									Export to S3, cheapest storage, on-demand
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Trash2 className="w-3 h-3 mt-0.5 text-destructive shrink-0" />
								<span>
									<span className="text-destructive font-medium">
										Destroy:
									</span>{' '}
									No compliance = no reason to keep it
								</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Patterns
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<code className="text-primary">find_in_batches</code>: move
								data without OOM
							</li>
							<li>
								<code className="text-primary">insert_all</code>: bulk insert
								to archive table
							</li>
							<li>
								<code className="text-primary">in_batches.delete_all</code>:
								destroy without locking
							</li>
							<li>
								<code className="text-primary">Parquet + S3</code>: cheapest
								cold storage format
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							The Golden Rule
						</div>
						<p className="text-xs text-muted-foreground italic">
							"The fastest query is the one against data that doesn't exist.
							Destroying data you don't need is the most effective scalability
							solution."
						</p>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level45DataLifecycle;
