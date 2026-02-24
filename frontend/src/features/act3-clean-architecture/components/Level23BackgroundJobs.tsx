/**
 * Level 21: Background Jobs
 *
 * Move slow operations to background workers.
 * Teaches: Solid Queue (Rails 8 default), perform_later, queue_as
 */

import {
	BarChart3,
	FileText,
	Image,
	Link2,
	type LucideIcon,
	Mail,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface SlowOperation {
	id: string;
	name: string;
	description: string;
	duration: number;
	icon: LucideIcon;
	isBackground: boolean;
	isRunning: boolean;
	progress: number;
}

const INITIAL_OPERATIONS: SlowOperation[] = [
	{
		id: 'email',
		name: 'Send Email',
		description: 'Send welcome email to user',
		duration: 2000,
		icon: Mail,
		isBackground: false,
		isRunning: false,
		progress: 0,
	},
	{
		id: 'pdf',
		name: 'Generate PDF',
		description: 'Create invoice PDF',
		duration: 5000,
		icon: FileText,
		isBackground: false,
		isRunning: false,
		progress: 0,
	},
	{
		id: 'image',
		name: 'Process Image',
		description: 'Resize and optimize avatar',
		duration: 3000,
		icon: Image,
		isBackground: false,
		isRunning: false,
		progress: 0,
	},
	{
		id: 'webhook',
		name: 'Call Webhook',
		description: 'Notify external service',
		duration: 1500,
		icon: Link2,
		isBackground: false,
		isRunning: false,
		progress: 0,
	},
	{
		id: 'import',
		name: 'Import CSV',
		description: 'Process uploaded data file',
		duration: 8000,
		icon: BarChart3,
		isBackground: false,
		isRunning: false,
		progress: 0,
	},
];

interface QueuedJob {
	id: number;
	operationId: string;
	operationName: string;
	status: 'queued' | 'running' | 'completed';
	progress: number;
}

export function Level23BackgroundJobs({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [operations, setOperations] =
		useState<SlowOperation[]>(INITIAL_OPERATIONS);
	const [requestTime, setRequestTime] = useState<number | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([]);
	const [jobIdCounter, setJobIdCounter] = useState(1);

	const backgroundOps = operations.filter((op) => op.isBackground);
	const syncOps = operations.filter((op) => !op.isBackground);

	// Process queued jobs
	useEffect(() => {
		const interval = setInterval(() => {
			setQueuedJobs((prev) => {
				const updated = [...prev];
				const runningJob = updated.find((j) => j.status === 'running');

				if (runningJob) {
					runningJob.progress += 10;
					if (runningJob.progress >= 100) {
						runningJob.status = 'completed';
					}
				} else {
					const nextJob = updated.find((j) => j.status === 'queued');
					if (nextJob) {
						nextJob.status = 'running';
					}
				}

				return updated;
			});
		}, 200);

		return () => clearInterval(interval);
	}, []);

	const toggleBackground = (operationId: string) => {
		setOperations((prev) =>
			prev.map((op) =>
				op.id === operationId ? { ...op, isBackground: !op.isBackground } : op,
			),
		);
	};

	const simulateRequest = () => {
		setIsProcessing(true);

		// Calculate total sync time
		const syncTime = syncOps.reduce((sum, op) => sum + op.duration, 0);

		// Add background jobs to queue
		const newJobs: QueuedJob[] = backgroundOps.map((op) => ({
			id: jobIdCounter + backgroundOps.indexOf(op),
			operationId: op.id,
			operationName: op.name,
			status: 'queued' as const,
			progress: 0,
		}));

		setJobIdCounter((prev) => prev + newJobs.length);
		setQueuedJobs((prev) => [...prev, ...newJobs]);

		// Simulate sync operations
		let elapsed = 0;
		const interval = setInterval(() => {
			elapsed += 100;
			setRequestTime(elapsed);

			if (elapsed >= syncTime) {
				clearInterval(interval);
				setIsProcessing(false);
			}
		}, 100);
	};

	const validateSolution = (): ValidationResult => {
		if (backgroundOps.length < 3) {
			return {
				valid: false,
				message: 'Move more operations to background!',
				details: ['At least 3 slow operations should be backgrounded'],
			};
		}
		if (syncOps.some((op) => op.duration > 1000)) {
			return {
				valid: false,
				message: 'Request still too slow!',
				details: ['Move operations over 1 second to background'],
			};
		}
		return {
			valid: true,
			message: 'Fast responses with background processing!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level23-background-jobs', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const totalSyncTime = syncOps.reduce((sum, op) => sum + op.duration, 0);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Keep requests fast by moving slow operations to background workers."
					instructions={[
						'Identify operations that can run later',
						'Move them to background workers',
						'Return response immediately',
						'Process jobs asynchronously',
					]}
					scenario="Users are waiting 15+ seconds for their signup to complete. Emails, PDFs, images... all blocking the request. Time to move slow work to background jobs!"
				/>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Background Jobs"
					levelNumber={23}
					onComplete={handleComplete}
					onReset={() => {
						setOperations(INITIAL_OPERATIONS);
						setQueuedJobs([]);
						setRequestTime(null);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Request Time + Simulate */}
						<div className="flex items-center gap-4 mb-6">
							<div className="flex items-center gap-3 flex-1">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Request Time:
								</div>
								<div
									className={`text-2xl font-bold ${
										totalSyncTime < 500
											? 'text-success'
											: totalSyncTime < 2000
												? 'text-warning'
												: 'text-destructive'
									}`}
								>
									{(totalSyncTime / 1000).toFixed(1)}s
								</div>
								<div className="text-xs text-muted-foreground">
									{totalSyncTime < 500
										? 'Fast!'
										: totalSyncTime < 2000
											? 'Acceptable'
											: 'Too slow!'}
								</div>
							</div>
							<div className="text-xs text-muted-foreground">
								{backgroundOps.length}/{operations.length} backgrounded
							</div>
							<Button
								className={isProcessing ? 'cursor-not-allowed' : ''}
								disabled={isProcessing}
								onClick={simulateRequest}
								variant={isProcessing ? 'secondary' : 'default'}
							>
								{isProcessing
									? `Processing... ${requestTime}ms`
									: 'Simulate Request'}
							</Button>
						</div>

						{/* Operations List */}
						<div className="grid grid-cols-2 gap-6 mb-6">
							{/* Synchronous */}
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-destructive/20 px-4 py-3 border-b border-border">
									<div className="text-destructive font-semibold">
										Synchronous (Blocking)
									</div>
									<div className="text-xs text-muted-foreground">
										Runs during request, user waits
									</div>
								</div>
								<div className="p-4 space-y-2 min-h-[200px]">
									{syncOps.map((op) => (
										<Button
											className="w-full p-3 h-auto rounded-lg bg-destructive/10 border border-destructive hover:bg-destructive/20 text-left justify-start"
											key={op.id}
											onClick={() => toggleBackground(op.id)}
											variant="outline"
										>
											<div className="flex items-center gap-3 w-full">
												{(() => {
													const Icon = op.icon;
													return <Icon className="w-5 h-5 shrink-0" />;
												})()}
												<div className="flex-1">
													<div className="text-foreground text-sm font-medium">
														{op.name}
													</div>
													<div className="text-xs text-muted-foreground">
														{op.description}
													</div>
												</div>
												<div className="text-destructive text-sm font-bold">
													{(op.duration / 1000).toFixed(1)}s
												</div>
											</div>
										</Button>
									))}
									{syncOps.length === 0 && (
										<div className="text-center py-8 text-muted-foreground">
											All operations moved to background!
										</div>
									)}
								</div>
							</div>

							{/* Background */}
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-success/20 px-4 py-3 border-b border-border">
									<div className="text-success font-semibold">
										Background (Async)
									</div>
									<div className="text-xs text-muted-foreground">
										Runs after response, user doesn't wait
									</div>
								</div>
								<div className="p-4 space-y-2 min-h-[200px]">
									{backgroundOps.map((op) => (
										<Button
											className="w-full p-3 h-auto rounded-lg bg-success/10 border border-success hover:bg-success/20 text-left justify-start"
											key={op.id}
											onClick={() => toggleBackground(op.id)}
											variant="default"
										>
											<div className="flex items-center gap-3 w-full">
												{(() => {
													const Icon = op.icon;
													return <Icon className="w-5 h-5 shrink-0" />;
												})()}
												<div className="flex-1">
													<div className="text-foreground text-sm font-medium">
														{op.name}
													</div>
													<div className="text-xs text-muted-foreground">
														{op.description}
													</div>
												</div>
												<div className="text-success text-sm font-bold">
													{(op.duration / 1000).toFixed(1)}s
												</div>
											</div>
										</Button>
									))}
									{backgroundOps.length === 0 && (
										<div className="text-center py-8 text-muted-foreground">
											Click operations to move them here
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Job Queue */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex justify-between items-center">
								<div>
									<div className="text-foreground font-semibold">
										Solid Queue
									</div>
									<div className="text-xs text-muted-foreground">
										Rails 8 default: DB-backed job queue
									</div>
								</div>
								<div className="flex gap-2">
									<span className="text-xs px-2 py-1 rounded bg-warning/20 text-warning">
										Queued:{' '}
										{queuedJobs.filter((j) => j.status === 'queued').length}
									</span>
									<span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
										Running:{' '}
										{queuedJobs.filter((j) => j.status === 'running').length}
									</span>
									<span className="text-xs px-2 py-1 rounded bg-success/20 text-success">
										Done:{' '}
										{queuedJobs.filter((j) => j.status === 'completed').length}
									</span>
								</div>
							</div>

							<div className="p-4 h-32 overflow-y-auto space-y-2">
								{queuedJobs.length === 0 ? (
									<div className="text-center py-4 text-muted-foreground">
										No jobs in queue. Simulate a request to enqueue background
										jobs.
									</div>
								) : (
									queuedJobs
										.slice(-10)
										.reverse()
										.map((job) => (
											<div
												className="flex items-center gap-3 text-sm"
												key={job.id}
											>
												<span
													className={`w-2 h-2 rounded-full ${
														job.status === 'queued'
															? 'bg-warning'
															: job.status === 'running'
																? 'bg-primary animate-pulse'
																: 'bg-success'
													}`}
												/>
												<span className="text-muted-foreground font-mono">
													#{job.id}
												</span>
												<span className="text-foreground">
													{job.operationName}
												</span>
												{job.status === 'running' && (
													<div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
														<div
															className="h-full bg-primary transition-all"
															style={{ width: `${job.progress}%` }}
														/>
													</div>
												)}
												<span
													className={`text-xs ${
														job.status === 'queued'
															? 'text-warning'
															: job.status === 'running'
																? 'text-primary'
																: 'text-success'
													}`}
												>
													{job.status}
												</span>
											</div>
										))
								)}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/jobs/send_email_job.rb',
							language: 'ruby',
							code: `class SendEmailJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find(user_id)
    UserMailer.welcome(user).deliver_now
  end
end

# Enqueue from controller:
SendEmailJob.perform_later(user.id)

# Runs async via Solid Queue!`,
							highlight: [2, 11],
						},
						{
							filename: 'config/queue.yml',
							language: 'yaml',
							code: `# Rails 8 uses Solid Queue by default
# DB-backed: no Redis needed

production:
  dispatchers:
    - polling_interval: 1
      batch_size: 500
  workers:
    - queues: "*"
      threads: 5
      processes: 2

# Run with: bin/jobs`,
							highlight: [],
						},
					]}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							When to Background
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ Sending emails</li>
							<li>+ Processing uploads</li>
							<li>+ External API calls</li>
							<li>+ Report generation</li>
							<li>+ Data imports/exports</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Solid Queue (Rails 8)
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ DB-backed (no Redis needed)</li>
							<li>+ Built into Rails 8</li>
							<li>+ Recurring jobs via YAML</li>
							<li>+ Mission Queue for Mission Critical</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level23BackgroundJobs;
