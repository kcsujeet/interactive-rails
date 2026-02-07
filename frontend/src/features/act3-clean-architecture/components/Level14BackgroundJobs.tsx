/**
 * Level 14: Background Jobs
 *
 * Move long-running tasks to background workers.
 * Shows Redis queue + Sidekiq worker pattern.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
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

interface Job {
	id: number;
	type: string;
	status: 'queued' | 'processing' | 'completed';
	progress: number;
}

export function Level14BackgroundJobs({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [workerEnabled, setWorkerEnabled] = useState(false);
	const [isBlocking, setIsBlocking] = useState(false);
	const [blockingProgress, setBlockingProgress] = useState(0);
	const [jobs, setJobs] = useState<Job[]>([]);
	const [completedJobs, setCompletedJobs] = useState(0);
	const [requestTime, setRequestTime] = useState<number | null>(null);
	const [experiencedBlocking, setExperiencedBlocking] = useState(false);

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (!experiencedBlocking) {
			errors.push(
				'Generate a PDF WITHOUT the worker first to see the blocking behavior',
			);
		}

		if (!workerEnabled) {
			errors.push('Enable the Background Worker');
		}

		if (completedJobs < 2) {
			errors.push(
				`Complete at least 2 background jobs (currently ${completedJobs})`,
			);
		}

		if (workerEnabled && requestTime !== null && requestTime > 500) {
			errors.push(
				'Response time too slow - background jobs should return instantly',
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Background processing not complete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Jobs now process in the background!',
		};
	};

	// Process background jobs
	useEffect(() => {
		if (!workerEnabled) return;

		const interval = setInterval(() => {
			setJobs((prev) =>
				prev.map((job) => {
					if (job.status === 'queued') {
						return { ...job, status: 'processing', progress: 0 };
					}
					if (job.status === 'processing') {
						const newProgress = job.progress + 10;
						if (newProgress >= 100) {
							setCompletedJobs((c) => c + 1);
							return { ...job, status: 'completed', progress: 100 };
						}
						return { ...job, progress: newProgress };
					}
					return job;
				}),
			);
		}, 300);

		return () => clearInterval(interval);
	}, [workerEnabled]);

	const triggerBlockingRequest = () => {
		setIsBlocking(true);
		setBlockingProgress(0);
		setExperiencedBlocking(true);

		const startTime = Date.now();
		const interval = setInterval(() => {
			setBlockingProgress((prev) => {
				if (prev >= 100) {
					clearInterval(interval);
					setIsBlocking(false);
					setRequestTime(Date.now() - startTime);
					return 100;
				}
				return prev + 2;
			});
		}, 100);
	};

	const triggerBackgroundJob = () => {
		const id = Date.now();
		setJobs((prev) => [
			...prev.slice(-5),
			{
				id,
				type: 'GeneratePdfJob',
				status: 'queued',
				progress: 0,
			},
		]);
		// Instant response
		setRequestTime(15 + Math.random() * 10);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level14-background-jobs', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn to offload long-running tasks to background workers with Sidekiq."
					instructions={[
						'Click "Generate PDF" to see the blocking behavior',
						'Enable the background worker',
						'Generate PDFs without blocking - they process in background',
					]}
					scenario="Generating a PDF report takes 5 seconds. During this time, the user's browser shows a loading spinner and they can't do anything else."
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${workerEnabled ? 'bg-success text-success-foreground cursor-default' : ''}`}
							disabled={workerEnabled}
							onClick={() => setWorkerEnabled(true)}
							variant={workerEnabled ? 'secondary' : 'default'}
						>
							{workerEnabled ? 'Worker Enabled' : 'Enable Background Worker'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								isBlocking
									? 'bg-secondary text-muted-foreground cursor-not-allowed'
									: 'bg-purple-600 hover:bg-purple-500 text-foreground'
							}`}
							disabled={isBlocking}
							onClick={
								workerEnabled ? triggerBackgroundJob : triggerBlockingRequest
							}
							variant="secondary"
						>
							{isBlocking ? 'Generating...' : 'Generate PDF Report'}
						</Button>

						{requestTime !== null && (
							<div
								className={`mt-3 p-2 rounded-lg text-center text-sm ${
									requestTime > 1000
										? 'bg-destructive/20 text-destructive'
										: 'bg-success/20 text-success'
								}`}
							>
								Response time: {Math.round(requestTime)}ms
							</div>
						)}
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Background Jobs"
					levelNumber={14}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setWorkerEnabled(false);
						setIsBlocking(false);
						setBlockingProgress(0);
						setJobs([]);
						setCompletedJobs(0);
						setRequestTime(null);
						setExperiencedBlocking(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture */}
					<div className="flex items-start justify-center gap-6 mb-8">
						{/* Web Server */}
						<div className="bg-card border border-border rounded-xl p-4 w-48">
							<div className="text-primary font-mono text-sm mb-2">
								Web Server
							</div>
							<div className="text-muted-foreground text-xs mb-4">
								Handles HTTP requests
							</div>

							{isBlocking && (
								<div className="bg-destructive/20 border border-destructive rounded-lg p-3">
									<div className="text-destructive text-xs mb-2">BLOCKING!</div>
									<div className="bg-secondary rounded-full h-2 overflow-hidden">
										<div
											className="bg-destructive h-full transition-all"
											style={{ width: `${blockingProgress}%` }}
										/>
									</div>
									<div className="text-destructive text-xs mt-1 text-center">
										{Math.round(blockingProgress * 50)}ms
									</div>
								</div>
							)}

							{!isBlocking && !workerEnabled && (
								<div className="text-muted-foreground text-xs text-center py-4">
									Click Generate PDF
								</div>
							)}

							{workerEnabled && !isBlocking && (
								<div className="bg-success/20 border border-success rounded-lg p-3">
									<div className="text-success text-xs">
										Responds immediately!
									</div>
									<div className="text-success/80 text-xs mt-1">
										Job queued in Redis
									</div>
								</div>
							)}
						</div>

						{/* Redis Queue */}
						{workerEnabled && (
							<>
								<svg
									className="w-8 h-8 text-muted-foreground mt-12"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M14 5l7 7m0 0l-7 7m7-7H3"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>

								<div className="bg-destructive/20 border border-destructive rounded-xl p-4 w-48">
									<div className="text-destructive font-mono text-sm mb-2">
										Redis Queue
									</div>
									<div className="space-y-2 max-h-32 overflow-y-auto">
										{jobs
											.filter((j) => j.status === 'queued')
											.map((job) => (
												<div
													className="bg-destructive/20 rounded p-2 text-xs text-destructive/80"
													key={job.id}
												>
													{job.type}
												</div>
											))}
										{jobs.filter((j) => j.status === 'queued').length === 0 && (
											<div className="text-muted-foreground text-xs text-center py-2">
												Queue empty
											</div>
										)}
									</div>
								</div>

								<svg
									className="w-8 h-8 text-muted-foreground mt-12"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M14 5l7 7m0 0l-7 7m7-7H3"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>

								<div className="bg-purple-900/40 border border-purple-600 rounded-xl p-4 w-48">
									<div className="text-purple-400 font-mono text-sm mb-2">
										Sidekiq Worker
									</div>
									<div className="space-y-2">
										{jobs
											.filter((j) => j.status === 'processing')
											.map((job) => (
												<div
													className="bg-purple-900/40 rounded p-2"
													key={job.id}
												>
													<div className="text-xs text-purple-300 mb-1">
														{job.type}
													</div>
													<div className="bg-secondary rounded-full h-2 overflow-hidden">
														<div
															className="bg-purple-500 h-full transition-all"
															style={{ width: `${job.progress}%` }}
														/>
													</div>
												</div>
											))}
										{jobs.filter((j) => j.status === 'processing').length ===
											0 && (
											<div className="text-muted-foreground text-xs text-center py-2">
												Waiting for jobs...
											</div>
										)}
									</div>
								</div>
							</>
						)}
					</div>

					{/* Completed jobs */}
					{workerEnabled && completedJobs > 0 && (
						<div className="max-w-md mx-auto bg-card rounded-xl p-4">
							<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
								Completed Jobs
							</div>
							<div className="flex flex-wrap gap-2">
								{jobs
									.filter((j) => j.status === 'completed')
									.map((job) => (
										<div
											className="bg-success/20 border border-success rounded px-3 py-1 text-success text-sm"
											key={job.id}
										>
											PDF Generated
										</div>
									))}
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/jobs/generate_pdf_job.rb',
							language: 'ruby',
							code: `class GeneratePdfJob < ApplicationJob
  queue_as :default

  def perform(report_id)
    report = Report.find(report_id)

    # This takes 5 seconds!
    pdf = PdfGenerator.new(report).generate

    report.update!(
      pdf_url: upload_to_s3(pdf),
      status: 'completed'
    )

    # Notify user when done
    ReportMailer.ready(report).deliver_later
  end
end

# In controller - returns immediately:
class ReportsController < ApplicationController
  def create
    report = Report.create!(status: 'processing')
    GeneratePdfJob.perform_later(report.id)

    render json: { id: report.id, status: 'processing' }
  end
end`,
							highlight: [1, 2, 7, 23, 24],
						},
					]}
					learningGoal="Background jobs keep your web requests fast. Use Sidekiq + Redis to process long-running tasks asynchronously."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level14BackgroundJobs;
