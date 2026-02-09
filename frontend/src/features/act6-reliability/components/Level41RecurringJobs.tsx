/**
 * Level 41: Recurring Jobs & Scheduling
 *
 * Build a recurring job schedule to automate maintenance tasks.
 * Teaches: Solid Queue recurring.yml, queue_as, cron scheduling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Calendar,
	CheckCircle,
	Clock,
	Database,
	type LucideIcon,
	Mail,
	Play,
	RefreshCw,
	Timer,
	Trash2,
} from 'lucide-react';
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

// ── Types ──────────────────────────────────────────────────────────────

type Schedule = 'every 15 minutes' | 'every hour' | 'daily at 2am' | 'weekly';
type QueueName = 'default' | 'maintenance';

interface JobDefinition {
	id: string;
	name: string;
	className: string;
	description: string;
	icon: LucideIcon;
	recommendedSchedule: Schedule;
	requiresMaintenanceQueue: boolean;
	recordsPerRun: number;
}

interface ScheduledJob {
	jobId: string;
	schedule: Schedule;
	queue: QueueName;
}

interface TimelineEvent {
	hour: number;
	minute: number;
	jobId: string;
	status: 'pending' | 'running' | 'completed';
	recordsCleaned: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const SCHEDULE_OPTIONS: { value: Schedule; label: string; cron: string }[] = [
	{
		value: 'every 15 minutes',
		label: 'Every 15 min',
		cron: '*/15 * * * *',
	},
	{ value: 'every hour', label: 'Every hour', cron: '0 * * * *' },
	{ value: 'daily at 2am', label: 'Daily at 2 AM', cron: '0 2 * * *' },
	{ value: 'weekly', label: 'Weekly (Sun 3 AM)', cron: '0 3 * * 0' },
];

const JOB_DEFINITIONS: JobDefinition[] = [
	{
		id: 'cleanup_sessions',
		name: 'CleanupSessions',
		className: 'CleanupExpiredSessionsJob',
		description: 'Delete sessions expired over 24 hours ago',
		icon: Trash2,
		recommendedSchedule: 'every hour',
		requiresMaintenanceQueue: true,
		recordsPerRun: 85_000,
	},
	{
		id: 'cleanup_tokens',
		name: 'CleanupTokens',
		className: 'CleanupRevokedTokensJob',
		description: 'Purge revoked OAuth & API tokens',
		icon: Trash2,
		recommendedSchedule: 'daily at 2am',
		requiresMaintenanceQueue: true,
		recordsPerRun: 25_000,
	},
	{
		id: 'archive_audit_logs',
		name: 'ArchiveAuditLogs',
		className: 'ArchiveAuditLogsJob',
		description: 'Move audit logs older than 90 days to cold storage',
		icon: Database,
		recommendedSchedule: 'daily at 2am',
		requiresMaintenanceQueue: true,
		recordsPerRun: 120_000,
	},
	{
		id: 'refresh_analytics',
		name: 'RefreshAnalytics',
		className: 'RefreshAnalyticsJob',
		description: 'Rebuild materialized views for dashboards',
		icon: RefreshCw,
		recommendedSchedule: 'every 15 minutes',
		requiresMaintenanceQueue: false,
		recordsPerRun: 0,
	},
	{
		id: 'send_weekly_digest',
		name: 'SendWeeklyDigest',
		className: 'SendWeeklyDigestJob',
		description: 'Email weekly activity summary to all users',
		icon: Mail,
		recommendedSchedule: 'weekly',
		requiresMaintenanceQueue: false,
		recordsPerRun: 0,
	},
];

const CLEANUP_JOB_IDS = new Set([
	'cleanup_sessions',
	'cleanup_tokens',
	'archive_audit_logs',
]);

// ── Helpers ────────────────────────────────────────────────────────────

function getScheduleFireTimes(schedule: Schedule): { hour: number; minute: number }[] {
	const times: { hour: number; minute: number }[] = [];
	switch (schedule) {
		case 'every 15 minutes':
			for (let h = 0; h < 24; h++) {
				for (const m of [0, 15, 30, 45]) {
					times.push({ hour: h, minute: m });
				}
			}
			break;
		case 'every hour':
			for (let h = 0; h < 24; h++) {
				times.push({ hour: h, minute: 0 });
			}
			break;
		case 'daily at 2am':
			times.push({ hour: 2, minute: 0 });
			break;
		case 'weekly':
			times.push({ hour: 3, minute: 0 });
			break;
	}
	return times;
}

function formatHour(hour: number): string {
	if (hour === 0) return '12a';
	if (hour < 12) return `${hour}a`;
	if (hour === 12) return '12p';
	return `${hour - 12}p`;
}

// ── Component ──────────────────────────────────────────────────────────

export function Level41RecurringJobs({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// Scheduled jobs the player has configured
	const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);

	// Simulation state
	const [isSimulating, setIsSimulating] = useState(false);
	const [simHour, setSimHour] = useState(0);
	const [simMinute, setSimMinute] = useState(0);
	const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
	const [totalRecordsCleaned, setTotalRecordsCleaned] = useState(0);
	const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// ── Derived state ──────────────────────────────────────────────────

	const unscheduledJobs = JOB_DEFINITIONS.filter(
		(j) => !scheduledJobs.some((sj) => sj.jobId === j.id),
	);

	const dbSizeReduction = Math.min(
		100,
		Math.round((totalRecordsCleaned / 2_500_000) * 100),
	);

	// ── Job scheduling ─────────────────────────────────────────────────

	const addJob = useCallback(
		(jobId: string, schedule: Schedule, queue: QueueName) => {
			setScheduledJobs((prev) => {
				if (prev.some((sj) => sj.jobId === jobId)) return prev;
				return [...prev, { jobId, schedule, queue }];
			});
		},
		[],
	);

	const removeJob = useCallback((jobId: string) => {
		setScheduledJobs((prev) => prev.filter((sj) => sj.jobId !== jobId));
	}, []);

	const updateSchedule = useCallback((jobId: string, schedule: Schedule) => {
		setScheduledJobs((prev) =>
			prev.map((sj) => (sj.jobId === jobId ? { ...sj, schedule } : sj)),
		);
	}, []);

	const updateQueue = useCallback((jobId: string, queue: QueueName) => {
		setScheduledJobs((prev) =>
			prev.map((sj) => (sj.jobId === jobId ? { ...sj, queue } : sj)),
		);
	}, []);

	// ── Timeline events builder ────────────────────────────────────────

	const buildTimelineEvents = useCallback((): TimelineEvent[] => {
		const events: TimelineEvent[] = [];
		for (const sj of scheduledJobs) {
			const def = JOB_DEFINITIONS.find((j) => j.id === sj.jobId);
			if (!def) continue;
			const fires = getScheduleFireTimes(sj.schedule);
			for (const fire of fires) {
				events.push({
					hour: fire.hour,
					minute: fire.minute,
					jobId: sj.jobId,
					status: 'pending',
					recordsCleaned: def.recordsPerRun,
				});
			}
		}
		events.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
		return events;
	}, [scheduledJobs]);

	// ── Simulation ─────────────────────────────────────────────────────

	const startSimulation = useCallback(() => {
		const events = buildTimelineEvents();
		setTimelineEvents(events);
		setSimHour(0);
		setSimMinute(0);
		setTotalRecordsCleaned(0);
		setIsSimulating(true);
	}, [buildTimelineEvents]);

	const stopSimulation = useCallback(() => {
		setIsSimulating(false);
		if (simIntervalRef.current) {
			clearInterval(simIntervalRef.current);
			simIntervalRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (!isSimulating) return;

		simIntervalRef.current = setInterval(() => {
			setSimMinute((prevMin) => {
				const nextMin = prevMin + 15;
				if (nextMin >= 60) {
					setSimHour((prevHour) => {
						const nextHour = prevHour + 1;
						if (nextHour >= 24) {
							// Simulation complete
							stopSimulation();
							return 23;
						}
						return nextHour;
					});
					return 0;
				}
				return nextMin;
			});
		}, 150);

		return () => {
			if (simIntervalRef.current) {
				clearInterval(simIntervalRef.current);
				simIntervalRef.current = null;
			}
		};
	}, [isSimulating, stopSimulation]);

	// Update timeline event statuses as simulation clock advances
	useEffect(() => {
		if (!isSimulating) return;
		const currentTimeInMinutes = simHour * 60 + simMinute;

		setTimelineEvents((prev) => {
			let cleaned = 0;
			const updated = prev.map((ev) => {
				const evTime = ev.hour * 60 + ev.minute;
				if (evTime <= currentTimeInMinutes && ev.status === 'pending') {
					cleaned += ev.recordsCleaned;
					return { ...ev, status: 'completed' as const };
				}
				if (
					evTime <= currentTimeInMinutes + 15 &&
					evTime > currentTimeInMinutes &&
					ev.status === 'pending'
				) {
					return { ...ev, status: 'running' as const };
				}
				return ev;
			});
			if (cleaned > 0) {
				setTotalRecordsCleaned((prev) => prev + cleaned);
			}
			return updated;
		});
	}, [simHour, simMinute, isSimulating]);

	// ── Code generation ────────────────────────────────────────────────

	const generateRecurringYml = (): string => {
		if (scheduledJobs.length === 0) {
			return `# config/recurring.yml
production:
  # No jobs scheduled yet
  # Add jobs from the palette!`;
		}

		let yml = '# config/recurring.yml\nproduction:';
		for (const sj of scheduledJobs) {
			const def = JOB_DEFINITIONS.find((j) => j.id === sj.jobId);
			if (!def) continue;
			const cronInfo = SCHEDULE_OPTIONS.find(
				(s) => s.value === sj.schedule,
			);
			yml += `\n  ${sj.jobId}:`;
			yml += `\n    class: ${def.className}`;
			yml += `\n    schedule: "${cronInfo?.cron || sj.schedule}"`;
			if (sj.queue !== 'default') {
				yml += `\n    queue: ${sj.queue}`;
			}
		}
		return yml;
	};

	const generateJobClass = (): string => {
		const sessionJob = scheduledJobs.find(
			(sj) => sj.jobId === 'cleanup_sessions',
		);
		const queueLine = sessionJob
			? `  queue_as :${sessionJob.queue}`
			: '  queue_as :maintenance';

		return `# app/jobs/cleanup_expired_sessions_job.rb
class CleanupExpiredSessionsJob < ApplicationJob
${queueLine}

  def perform
    expired = Session.where(
      "expires_at < ?", 24.hours.ago
    )

    expired.in_batches(of: 10_000) do |batch|
      batch.delete_all
    end

    Rails.logger.info(
      "Cleaned #{expired.count} expired sessions"
    )
  end
end`;
	};

	// ── Validation ─────────────────────────────────────────────────────

	const validateSolution = (): ValidationResult => {
		if (scheduledJobs.length < 3) {
			return {
				valid: false,
				message: 'Schedule more jobs!',
				details: [
					`You have ${scheduledJobs.length} jobs scheduled. Need at least 3.`,
				],
			};
		}

		// Check that cleanup jobs use maintenance queue
		const misassignedJobs = scheduledJobs.filter(
			(sj) => CLEANUP_JOB_IDS.has(sj.jobId) && sj.queue !== 'maintenance',
		);
		if (misassignedJobs.length > 0) {
			const names = misassignedJobs
				.map((sj) => JOB_DEFINITIONS.find((j) => j.id === sj.jobId)?.name)
				.join(', ');
			return {
				valid: false,
				message: 'Wrong queue for cleanup jobs!',
				details: [
					`${names} should use the maintenance queue, not default.`,
					'Cleanup jobs should never compete with user-facing work.',
				],
			};
		}

		return {
			valid: true,
			message: 'Recurring jobs keep your database clean automatically!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act6-level41-recurring-jobs', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		stopSimulation();
		setScheduledJobs([]);
		setTimelineEvents([]);
		setTotalRecordsCleaned(0);
		setSimHour(0);
		setSimMinute(0);
	};

	// ── Render ─────────────────────────────────────────────────────────

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Automate database maintenance with recurring background jobs."
					instructions={[
						'Select jobs from the palette and assign schedules',
						'Cleanup jobs must use the maintenance queue',
						'Simulate 24 hours to see jobs fire on the timeline',
						'Schedule at least 3 jobs with appropriate frequencies',
					]}
					scenario="Your app has 2 million expired sessions and 500K orphaned tokens clogging the database. There is no automated cleanup -- records pile up daily, slowing queries and ballooning storage."
				>
					{/* Problem Stats */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Database Problem
						</div>
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									Expired sessions
								</span>
								<span className="text-destructive font-mono font-semibold">
									2,000,000
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									Orphaned tokens
								</span>
								<span className="text-destructive font-mono font-semibold">
									500,000
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									Automated cleanup
								</span>
								<span className="text-destructive font-semibold">
									None
								</span>
							</div>
						</div>
					</div>

					{/* Simulation Stats */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Simulation Results
						</div>
						<div className="space-y-3">
							<div>
								<div className="flex justify-between text-sm mb-1">
									<span className="text-muted-foreground">
										Records cleaned
									</span>
									<span
										className={
											totalRecordsCleaned > 0
												? 'text-success font-semibold'
												: 'text-foreground'
										}
									>
										{totalRecordsCleaned.toLocaleString()}
									</span>
								</div>
							</div>
							<div>
								<div className="flex justify-between text-sm mb-1">
									<span className="text-muted-foreground">
										DB size reduced
									</span>
									<span
										className={
											dbSizeReduction > 0
												? 'text-success font-semibold'
												: 'text-foreground'
										}
									>
										{dbSizeReduction}%
									</span>
								</div>
								<div className="h-2 bg-secondary rounded-full overflow-hidden">
									<div
										className="h-full bg-success transition-all duration-300"
										style={{ width: `${dbSizeReduction}%` }}
									/>
								</div>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									Jobs scheduled
								</span>
								<span
									className={
										scheduledJobs.length >= 3
											? 'text-success font-semibold'
											: 'text-foreground'
									}
								>
									{scheduledJobs.length} / {JOB_DEFINITIONS.length}
								</span>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Recurring Jobs"
					levelNumber={41}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto space-y-6">
						{/* ── Job Palette ────────────────────────────────────── */}
						{unscheduledJobs.length > 0 && (
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-secondary px-4 py-3 border-b border-border">
									<div className="text-foreground font-semibold">
										Available Jobs
									</div>
									<div className="text-xs text-muted-foreground">
										Click a job to add it to your schedule
									</div>
								</div>
								<div className="p-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
									{unscheduledJobs.map((job) => {
										const Icon = job.icon;
										return (
											<Button
												className="p-4 h-auto rounded-lg border-2 border-border bg-secondary hover:border-primary hover:bg-primary/10 text-left flex-col items-start transition-all"
												key={job.id}
												onClick={() =>
													addJob(
														job.id,
														job.recommendedSchedule,
														job.requiresMaintenanceQueue
															? 'maintenance'
															: 'default',
													)
												}
												variant="outline"
											>
												<div className="flex items-center gap-2 mb-1">
													<Icon className="w-4 h-4 text-primary" />
													<span className="text-sm font-semibold text-foreground">
														{job.name}
													</span>
												</div>
												<div className="text-xs text-muted-foreground mb-2">
													{job.description}
												</div>
												<div className="flex items-center gap-1 text-xs text-primary/80">
													<Clock className="w-3 h-3" />
													<span>{job.recommendedSchedule}</span>
												</div>
											</Button>
										);
									})}
								</div>
							</div>
						)}

						{/* ── Scheduled Jobs ────────────────────────────────── */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex justify-between items-center">
								<div>
									<div className="text-foreground font-semibold flex items-center gap-2">
										<Calendar className="w-4 h-4 text-primary" />
										Scheduled Jobs
									</div>
									<div className="text-xs text-muted-foreground">
										Configure schedule and queue for each job
									</div>
								</div>
								<Button
									className="flex items-center gap-2"
									disabled={
										scheduledJobs.length === 0 || isSimulating
									}
									onClick={
										isSimulating ? stopSimulation : startSimulation
									}
									size="sm"
									color={isSimulating ? 'destructive' : 'primary'}
									variant="default"
								>
									{isSimulating ? (
										<>
											<Timer className="w-4 h-4 animate-spin" />
											{formatHour(simHour)}:
											{String(simMinute).padStart(2, '0')}
										</>
									) : (
										<>
											<Play className="w-4 h-4" />
											Simulate 24h
										</>
									)}
								</Button>
							</div>

							<div className="p-4 space-y-3">
								{scheduledJobs.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										No jobs scheduled yet. Click a job above to add
										it.
									</div>
								) : (
									scheduledJobs.map((sj) => {
										const def = JOB_DEFINITIONS.find(
											(j) => j.id === sj.jobId,
										);
										if (!def) return null;
										const Icon = def.icon;
										const isCleanupJob = CLEANUP_JOB_IDS.has(
											sj.jobId,
										);
										const wrongQueue =
											isCleanupJob && sj.queue !== 'maintenance';

										return (
											<div
												className={`p-4 rounded-lg border-2 transition-all ${
													wrongQueue
														? 'border-destructive bg-destructive/5'
														: 'border-border bg-secondary/50'
												}`}
												key={sj.jobId}
											>
												<div className="flex items-start justify-between gap-4">
													<div className="flex items-center gap-3 flex-1">
														<Icon
															className={`w-5 h-5 shrink-0 ${
																wrongQueue
																	? 'text-destructive'
																	: 'text-primary'
															}`}
														/>
														<div className="flex-1 min-w-0">
															<div className="text-sm font-semibold text-foreground">
																{def.name}
															</div>
															<div className="text-xs text-muted-foreground">
																{def.description}
															</div>
															{wrongQueue && (
																<div className="text-xs text-destructive mt-1 flex items-center gap-1">
																	Cleanup jobs should use
																	the maintenance queue
																</div>
															)}
														</div>
													</div>

													<Button
														className="text-muted-foreground hover:text-destructive shrink-0"
														onClick={() =>
															removeJob(sj.jobId)
														}
														size="icon"
														variant="ghost"
													>
														<Trash2 className="w-4 h-4" />
													</Button>
												</div>

												{/* Schedule + Queue selectors */}
												<div className="mt-3 flex items-center gap-3 flex-wrap">
													<div className="flex items-center gap-2">
														<Clock className="w-3.5 h-3.5 text-muted-foreground" />
														<select
															className="text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground focus:border-primary focus:outline-none"
															onChange={(e) =>
																updateSchedule(
																	sj.jobId,
																	e.target
																		.value as Schedule,
																)
															}
															value={sj.schedule}
														>
															{SCHEDULE_OPTIONS.map(
																(opt) => (
																	<option
																		key={opt.value}
																		value={opt.value}
																	>
																		{opt.label} (
																		{opt.cron})
																	</option>
																),
															)}
														</select>
													</div>

													<div className="flex items-center gap-2">
														<Database className="w-3.5 h-3.5 text-muted-foreground" />
														<select
															className={`text-xs bg-background border rounded px-2 py-1.5 focus:outline-none ${
																wrongQueue
																	? 'border-destructive text-destructive focus:border-destructive'
																	: 'border-border text-foreground focus:border-primary'
															}`}
															onChange={(e) =>
																updateQueue(
																	sj.jobId,
																	e.target
																		.value as QueueName,
																)
															}
															value={sj.queue}
														>
															<option value="default">
																default queue
															</option>
															<option value="maintenance">
																maintenance queue
															</option>
														</select>
													</div>

													{def.recordsPerRun > 0 && (
														<span className="text-xs text-muted-foreground ml-auto">
															~{def.recordsPerRun.toLocaleString()}{' '}
															records/run
														</span>
													)}
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>

						{/* ── 24-Hour Timeline ──────────────────────────────── */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold flex items-center gap-2">
									<Timer className="w-4 h-4 text-primary" />
									24-Hour Timeline
								</div>
								<div className="text-xs text-muted-foreground">
									Visualize when each job fires throughout the day
								</div>
							</div>

							<div className="p-4">
								{/* Hour markers */}
								<div className="relative">
									{/* Simulation progress overlay */}
									{isSimulating && (
										<div
											className="absolute top-0 bottom-0 bg-primary/10 border-r-2 border-primary z-10 pointer-events-none transition-all duration-150"
											style={{
												width: `${((simHour * 60 + simMinute) / (24 * 60)) * 100}%`,
											}}
										/>
									)}

									{/* Hour labels */}
									<div className="flex text-xs text-muted-foreground mb-2">
										{Array.from({ length: 24 }).map((_, i) => (
											<div
												className="flex-1 text-center"
												key={`hour-${i}`}
											>
												{i % 3 === 0 ? formatHour(i) : ''}
											</div>
										))}
									</div>

									{/* Timeline rows per scheduled job */}
									{scheduledJobs.length === 0 ? (
										<div className="text-center py-6 text-muted-foreground text-sm">
											Schedule jobs to see the timeline
										</div>
									) : (
										<div className="space-y-2">
											{scheduledJobs.map((sj) => {
												const def = JOB_DEFINITIONS.find(
													(j) => j.id === sj.jobId,
												);
												if (!def) return null;
												const fires = getScheduleFireTimes(
													sj.schedule,
												);
												const Icon = def.icon;

												return (
													<div
														className="flex items-center gap-2"
														key={sj.jobId}
													>
														<div className="w-24 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
															<Icon className="w-3.5 h-3.5 shrink-0" />
															<span className="truncate">
																{def.name}
															</span>
														</div>
														<div className="flex-1 relative h-6 bg-secondary/50 rounded border border-border">
															{fires.map((fire) => {
																const pos =
																	((fire.hour * 60 +
																		fire.minute) /
																		(24 * 60)) *
																	100;
																const ev =
																	timelineEvents.find(
																		(e) =>
																			e.jobId ===
																				sj.jobId &&
																			e.hour ===
																				fire.hour &&
																			e.minute ===
																				fire.minute,
																	);
																const statusColor =
																	ev?.status ===
																	'completed'
																		? 'bg-success'
																		: ev?.status ===
																			  'running'
																			? 'bg-primary animate-pulse'
																			: 'bg-muted-foreground/40';
																return (
																	<div
																		className={`absolute top-1 w-2 h-4 rounded-sm ${statusColor} transition-colors`}
																		key={`${fire.hour}-${fire.minute}`}
																		style={{
																			left: `${pos}%`,
																		}}
																		title={`${String(fire.hour).padStart(2, '0')}:${String(fire.minute).padStart(2, '0')}`}
																	/>
																);
															})}
														</div>
													</div>
												);
											})}
										</div>
									)}

									{/* Legend */}
									<div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground justify-end">
										<div className="flex items-center gap-1.5">
											<div className="w-2 h-2 rounded-sm bg-muted-foreground/40" />
											<span>Pending</span>
										</div>
										<div className="flex items-center gap-1.5">
											<div className="w-2 h-2 rounded-sm bg-primary" />
											<span>Running</span>
										</div>
										<div className="flex items-center gap-1.5">
											<div className="w-2 h-2 rounded-sm bg-success" />
											<span>Completed</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'config/recurring.yml',
							language: 'yaml',
							code: generateRecurringYml(),
							highlight: [],
						},
						{
							filename:
								'app/jobs/cleanup_expired_sessions_job.rb',
							language: 'ruby',
							code: generateJobClass(),
							highlight: [3, 6, 7, 10],
						},
					]}
					learningGoal="Solid Queue recurring jobs let you schedule maintenance tasks with cron-like syntax in a simple YAML file. Always use a dedicated maintenance queue for cleanup work."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Schedule Reference
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							{SCHEDULE_OPTIONS.map((opt) => (
								<li
									className="flex justify-between"
									key={opt.value}
								>
									<span>{opt.label}</span>
									<code className="text-primary/80 font-mono">
										{opt.cron}
									</code>
								</li>
							))}
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Best Practices
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li className="flex items-start gap-1.5">
								<CheckCircle className="w-3 h-3 text-success mt-0.5 shrink-0" />
								<span>
									Use maintenance queue for cleanup jobs
								</span>
							</li>
							<li className="flex items-start gap-1.5">
								<CheckCircle className="w-3 h-3 text-success mt-0.5 shrink-0" />
								<span>
									Delete in batches (in_batches) for large
									datasets
								</span>
							</li>
							<li className="flex items-start gap-1.5">
								<CheckCircle className="w-3 h-3 text-success mt-0.5 shrink-0" />
								<span>
									Schedule heavy jobs during off-peak hours
								</span>
							</li>
							<li className="flex items-start gap-1.5">
								<CheckCircle className="w-3 h-3 text-success mt-0.5 shrink-0" />
								<span>
									Log cleanup metrics for monitoring
								</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Solid Queue (Rails 8)
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ DB-backed (no Redis needed)</li>
							<li>+ Recurring jobs via YAML config</li>
							<li>+ Cron-style scheduling</li>
							<li>+ Named queues with priorities</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level41RecurringJobs;
