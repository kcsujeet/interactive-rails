/**
 * Level 42: Error Monitoring
 *
 * Structured error monitoring dashboard simulation.
 * Player configures monitoring features and observes how
 * grouped, contextual, alerting errors improve observability.
 */

import {
	Activity,
	AlertTriangle,
	BarChart3,
	Bell,
	BellOff,
	Bug,
	Eye,
	Layers,
	Play,
	ShieldAlert,
	Tags,
	Trash2,
	User,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
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

// --- Types ---

interface MonitoringConfig {
	grouping: boolean;
	context: boolean;
	alerts: boolean;
	budgets: boolean;
}

interface ErrorEntry {
	id: string;
	exceptionClass: string;
	controller: string;
	userId: number;
	requestId: string;
	ip: string;
	path: string;
	message: string;
	timestamp: number;
}

interface ErrorGroup {
	key: string;
	exceptionClass: string;
	count: number;
	lastSeen: number;
	controller: string;
}

// --- Sample data generators ---

const EXCEPTION_CLASSES = [
	'ActiveRecord::RecordNotFound',
	'ActionController::ParameterMissing',
	'NoMethodError',
	'ActiveRecord::RecordInvalid',
	'Redis::ConnectionError',
];

const CONTROLLERS = [
	'UsersController#show',
	'OrdersController#create',
	'PaymentsController#process',
	'ProductsController#index',
	'SessionsController#create',
];

const PATHS = [
	'/api/v1/users/999',
	'/api/v1/orders',
	'/api/v1/payments/charge',
	'/api/v1/products',
	'/api/v1/sessions',
];

let errorIdCounter = 0;

function generateError(): ErrorEntry {
	const idx = Math.floor(Math.random() * EXCEPTION_CLASSES.length);
	errorIdCounter += 1;
	return {
		id: `err-${errorIdCounter}`,
		exceptionClass: EXCEPTION_CLASSES[idx],
		controller: CONTROLLERS[idx],
		userId: Math.floor(Math.random() * 1000) + 1,
		requestId: `req-${Math.random().toString(36).slice(2, 10)}`,
		ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
		path: PATHS[idx],
		message: `${EXCEPTION_CLASSES[idx]}: Something went wrong in ${CONTROLLERS[idx]}`,
		timestamp: Date.now(),
	};
}

// --- Component ---

export function Level46ErrorMonitoring({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	const [config, setConfig] = useState<MonitoringConfig>({
		grouping: false,
		context: false,
		alerts: false,
		budgets: false,
	});

	const [errors, setErrors] = useState<ErrorEntry[]>([]);
	const [alertFired, setAlertFired] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Derived state
	const totalRequests = 1000; // Simulated total requests in window
	const errorRate =
		errors.length > 0 ? (errors.length / totalRequests) * 100 : 0;
	const budgetRemaining = Math.max(0, 0.1 - errorRate); // SLO: 99.9% => 0.1% error budget
	const overBudget = errorRate > 0.1;

	const enabledCount = [
		config.grouping,
		config.context,
		config.alerts,
		config.budgets,
	].filter(Boolean).length;

	// Group errors by exception class
	const errorGroups: ErrorGroup[] = errors.reduce<ErrorGroup[]>(
		(groups, err) => {
			const existing = groups.find(
				(g) => g.exceptionClass === err.exceptionClass,
			);
			if (existing) {
				existing.count += 1;
				existing.lastSeen = Math.max(existing.lastSeen, err.timestamp);
			} else {
				groups.push({
					key: err.exceptionClass,
					exceptionClass: err.exceptionClass,
					count: 1,
					lastSeen: err.timestamp,
					controller: err.controller,
				});
			}
			return groups;
		},
		[],
	);

	// Generate errors in bursts
	const generateErrors = () => {
		if (isGenerating) {
			// Stop generating
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			setIsGenerating(false);
			return;
		}

		setIsGenerating(true);
		// Immediate batch
		const batch = Array.from({ length: 5 }, () => generateError());
		setErrors((prev) => [...prev, ...batch]);

		// Check alert threshold
		if (config.alerts) {
			const newTotal = errors.length + batch.length;
			if ((newTotal / totalRequests) * 100 > 0.1) {
				setAlertFired(true);
			}
		}

		// Continue generating every second
		intervalRef.current = setInterval(() => {
			const newErrors = Array.from(
				{ length: Math.floor(Math.random() * 3) + 1 },
				() => generateError(),
			);
			setErrors((prev) => {
				const updated = [...prev, ...newErrors];
				// Check alert threshold
				if (config.alerts && (updated.length / totalRequests) * 100 > 0.1) {
					setAlertFired(true);
				}
				return updated;
			});
		}, 1000);
	};

	const clearErrors = () => {
		setErrors([]);
		setAlertFired(false);
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setIsGenerating(false);
	};

	const toggleFeature = (feature: keyof MonitoringConfig) => {
		setConfig((prev) => ({ ...prev, [feature]: !prev[feature] }));
	};

	const validateSolution = useCallback((): ValidationResult => {
		if (enabledCount < 3) {
			return {
				valid: false,
				message: 'Enable more monitoring features!',
				details: [
					`You enabled ${enabledCount}/4 features. Enable at least 3.`,
					'Toggle grouping, context, alerts, or budgets.',
				],
			};
		}
		if (errors.length === 0) {
			return {
				valid: false,
				message: 'Generate some errors first!',
				details: ['Click "Generate Errors" to simulate production errors.'],
			};
		}
		return {
			valid: true,
			message: 'Structured error monitoring configured!',
		};
	}, [enabledCount, errors.length]);

	const handleComplete = async () => {
		const success = await completeLevel('act6-level46-error-monitoring', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		clearErrors();
		setConfig({
			grouping: false,
			context: false,
			alerts: false,
			budgets: false,
		});
		errorIdCounter = 0;
	};

	// Format time ago
	const timeAgo = (ts: number) => {
		const diff = Math.floor((Date.now() - ts) / 1000);
		if (diff < 5) return 'just now';
		if (diff < 60) return `${diff}s ago`;
		return `${Math.floor(diff / 60)}m ago`;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Set up structured error monitoring so your team gets alerted before users complain on Twitter."
					instructions={[
						'Enable at least 3 of 4 monitoring features',
						'Generate errors to see the dashboard in action',
						'Compare the "before" wall of text vs. grouped view',
						'Watch the alert fire when error rate exceeds budget',
					]}
					scenario="500 errors are happening in production, but nobody notices until Twitter complaints roll in. You need structured error tracking with grouping, context, alerts, and error budgets."
				>
					{/* Feature Toggles */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Monitoring Features ({enabledCount}/4)
						</div>
						<div className="space-y-2">
							<button
								className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
									config.grouping
										? 'border-success bg-success/10'
										: 'border-border bg-secondary hover:border-muted-foreground'
								}`}
								onClick={() => toggleFeature('grouping')}
								type="button"
							>
								<Layers
									className={`w-4 h-4 shrink-0 ${config.grouping ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<div>
									<div
										className={`text-sm font-medium ${config.grouping ? 'text-success' : 'text-foreground'}`}
									>
										Error Grouping
									</div>
									<div className="text-xs text-muted-foreground">
										Group by exception class
									</div>
								</div>
							</button>

							<button
								className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
									config.context
										? 'border-success bg-success/10'
										: 'border-border bg-secondary hover:border-muted-foreground'
								}`}
								onClick={() => toggleFeature('context')}
								type="button"
							>
								<Tags
									className={`w-4 h-4 shrink-0 ${config.context ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<div>
									<div
										className={`text-sm font-medium ${config.context ? 'text-success' : 'text-foreground'}`}
									>
										Context Enrichment
									</div>
									<div className="text-xs text-muted-foreground">
										user_id, request_id, IP, path
									</div>
								</div>
							</button>

							<button
								className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
									config.alerts
										? 'border-success bg-success/10'
										: 'border-border bg-secondary hover:border-muted-foreground'
								}`}
								onClick={() => toggleFeature('alerts')}
								type="button"
							>
								<Bell
									className={`w-4 h-4 shrink-0 ${config.alerts ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<div>
									<div
										className={`text-sm font-medium ${config.alerts ? 'text-success' : 'text-foreground'}`}
									>
										Alert Thresholds
									</div>
									<div className="text-xs text-muted-foreground">
										Fire when error rate {'>'} 0.1%
									</div>
								</div>
							</button>

							<button
								className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
									config.budgets
										? 'border-success bg-success/10'
										: 'border-border bg-secondary hover:border-muted-foreground'
								}`}
								onClick={() => toggleFeature('budgets')}
								type="button"
							>
								<ShieldAlert
									className={`w-4 h-4 shrink-0 ${config.budgets ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<div>
									<div
										className={`text-sm font-medium ${config.budgets ? 'text-success' : 'text-foreground'}`}
									>
										Error Budgets
									</div>
									<div className="text-xs text-muted-foreground">
										SLO: 99.9% uptime
									</div>
								</div>
							</button>
						</div>
					</div>

					{/* Actions */}
					<div className="p-4 border-t border-border space-y-2">
						<Button
							className="w-full"
							color={isGenerating ? 'destructive' : 'primary'}
							onClick={generateErrors}
						>
							{isGenerating ? (
								<>
									<Activity className="w-4 h-4 mr-2 animate-pulse" />
									Stop Generating
								</>
							) : (
								<>
									<Play className="w-4 h-4 mr-2" />
									Generate Errors
								</>
							)}
						</Button>
						{errors.length > 0 && (
							<Button
								className="w-full"
								onClick={clearErrors}
								variant="outline"
							>
								<Trash2 className="w-4 h-4 mr-2" />
								Clear Errors
							</Button>
						)}
					</div>

					{/* Stats */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Current Stats
						</div>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Total Errors:</span>
								<span className="text-foreground font-medium">
									{errors.length}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Error Rate:</span>
								<span
									className={`font-medium ${overBudget ? 'text-destructive' : 'text-success'}`}
								>
									{errorRate.toFixed(3)}%
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Groups:</span>
								<span className="text-foreground font-medium">
									{errorGroups.length}
								</span>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Error Monitoring"
					levelNumber={46}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto space-y-6">
						{/* Alert Status Bar */}
						{config.alerts && (
							<div
								className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
									alertFired
										? 'border-destructive bg-destructive/10'
										: 'border-success bg-success/10'
								}`}
							>
								{alertFired ? (
									<>
										<AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
										<div>
											<div className="text-destructive font-semibold text-sm">
												ALERT FIRING: Error rate exceeds 0.1% threshold
											</div>
											<div className="text-destructive/70 text-xs">
												Current rate: {errorRate.toFixed(3)}% | {errors.length}{' '}
												errors / {totalRequests} requests
											</div>
										</div>
										<Bell className="w-5 h-5 text-destructive ml-auto animate-bounce" />
									</>
								) : (
									<>
										<BellOff className="w-5 h-5 text-success" />
										<div>
											<div className="text-success font-semibold text-sm">
												Alert Status: OK
											</div>
											<div className="text-success/70 text-xs">
												Threshold: error rate {'>'} 0.1% | Current:{' '}
												{errorRate.toFixed(3)}%
											</div>
										</div>
									</>
								)}
							</div>
						)}

						{/* Error Budget Gauge */}
						{config.budgets && (
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
									<BarChart3 className="w-4 h-4 text-foreground" />
									<span className="text-foreground font-semibold">
										Error Budget (SLO: 99.9%)
									</span>
								</div>
								<div className="p-4">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm text-muted-foreground">
											Budget Remaining
										</span>
										<span
											className={`text-sm font-bold ${overBudget ? 'text-destructive' : 'text-success'}`}
										>
											{overBudget
												? 'EXHAUSTED'
												: `${budgetRemaining.toFixed(4)}%`}
										</span>
									</div>
									<div className="h-4 bg-secondary rounded-full overflow-hidden">
										<div
											className={`h-full transition-all rounded-full ${
												overBudget
													? 'bg-destructive'
													: errorRate > 0.05
														? 'bg-warning'
														: 'bg-success'
											}`}
											style={{
												width: `${Math.min(100, (errorRate / 0.1) * 100)}%`,
											}}
										/>
									</div>
									<div className="flex justify-between mt-1 text-xs text-muted-foreground">
										<span>0%</span>
										<span>0.05%</span>
										<span className="text-destructive font-medium">
											0.1% (limit)
										</span>
									</div>
								</div>
							</div>
						)}

						{/* Main Dashboard Area: Before vs After */}
						<div className="grid grid-cols-1 gap-6">
							{/* WITHOUT monitoring: raw error wall */}
							{!config.grouping && errors.length > 0 && (
								<div className="bg-card rounded-xl border border-border overflow-hidden">
									<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
										<Bug className="w-4 h-4 text-destructive" />
										<span className="text-foreground font-semibold">
											Raw Error Log (No Monitoring)
										</span>
									</div>
									<div className="p-4 max-h-64 overflow-y-auto">
										<pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
											{errors
												.slice(-20)
												.reverse()
												.map(
													(err) =>
														`[ERROR] ${new Date(err.timestamp).toISOString()} ${err.message}\n`,
												)
												.join('')}
										</pre>
										{errors.length > 20 && (
											<div className="text-xs text-muted-foreground mt-2 text-center">
												... and {errors.length - 20} more errors buried in the
												log
											</div>
										)}
									</div>
								</div>
							)}

							{/* WITH grouping: organized error groups */}
							{config.grouping && errors.length > 0 && (
								<div className="bg-card rounded-xl border border-border overflow-hidden">
									<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
										<Layers className="w-4 h-4 text-primary" />
										<span className="text-foreground font-semibold">
											Error Groups
										</span>
										<span className="ml-auto text-xs text-muted-foreground">
											{errorGroups.length} groups from {errors.length} errors
										</span>
									</div>
									<div className="divide-y divide-border">
										{errorGroups
											.sort((a, b) => b.count - a.count)
											.map((group) => (
												<div
													className="p-4 hover:bg-secondary/50 transition-colors"
													key={group.key}
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-3">
															<div
																className={`w-2 h-2 rounded-full ${
																	group.count > 5
																		? 'bg-destructive'
																		: group.count > 2
																			? 'bg-warning'
																			: 'bg-success'
																}`}
															/>
															<div>
																<div className="text-sm font-medium text-foreground">
																	{group.exceptionClass}
																</div>
																<div className="text-xs text-muted-foreground">
																	{group.controller}
																</div>
															</div>
														</div>
														<div className="text-right">
															<div
																className={`text-lg font-bold ${
																	group.count > 5
																		? 'text-destructive'
																		: 'text-foreground'
																}`}
															>
																{group.count}
															</div>
															<div className="text-xs text-muted-foreground">
																{timeAgo(group.lastSeen)}
															</div>
														</div>
													</div>
												</div>
											))}
									</div>
								</div>
							)}

							{/* WITH context: recent errors with context attached */}
							{config.context && errors.length > 0 && (
								<div className="bg-card rounded-xl border border-border overflow-hidden">
									<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
										<Eye className="w-4 h-4 text-primary" />
										<span className="text-foreground font-semibold">
											Recent Errors (with Context)
										</span>
									</div>
									<div className="divide-y divide-border max-h-64 overflow-y-auto">
										{errors
											.slice(-8)
											.reverse()
											.map((err) => (
												<div
													className="p-3 hover:bg-secondary/50 transition-colors"
													key={err.id}
												>
													<div className="flex items-start justify-between mb-2">
														<div className="text-sm font-medium text-foreground">
															{err.exceptionClass}
														</div>
														<div className="text-xs text-muted-foreground">
															{timeAgo(err.timestamp)}
														</div>
													</div>
													<div className="flex flex-wrap gap-2">
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
															<User className="w-3 h-3" />
															user:{err.userId}
														</span>
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">
															req:{err.requestId}
														</span>
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">
															{err.ip}
														</span>
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">
															{err.path}
														</span>
													</div>
												</div>
											))}
									</div>
								</div>
							)}

							{/* Empty state */}
							{errors.length === 0 && (
								<div className="bg-card rounded-xl border border-border p-12 text-center">
									<Bug className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
									<div className="text-foreground font-medium mb-2">
										No errors yet
									</div>
									<div className="text-sm text-muted-foreground mb-4">
										Enable monitoring features, then click "Generate Errors" to
										simulate production errors.
									</div>
									<div className="text-xs text-muted-foreground">
										Toggle features in the left panel to see the difference
										between raw logs and structured monitoring.
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'config/initializers/error_subscriber.rb',
							language: 'ruby',
							code: `# Rails 8 Error Reporter
Rails.error.subscribe(ErrorSubscriber.new)

class ErrorSubscriber
  def report(error, handled:, severity:, context:, source:)
    Sentry.capture_exception(error, extra: context)

    ErrorTracker.record(
      exception_class: error.class.name,
      message: error.message,
      severity: severity,
      user_id: context[:user_id],
      request_id: context[:request_id],
      handled: handled
    )
  end
end`,
							highlight: [1, 2, 5, 6, 8, 9, 10, 11, 12, 13, 14],
						},
						{
							filename: 'app/controllers/application_controller.rb',
							language: 'ruby',
							code: `class ApplicationController < ActionController::API
  before_action :set_error_context

  rescue_from ActiveRecord::RecordNotFound do |e|
    render json: { error: "Not found" }, status: :not_found
  end

  private
  def set_error_context
    Rails.error.set_context(
      user_id: current_user&.id,
      request_id: request.request_id
    )
  end
end

# Usage in any service/model:
Rails.error.handle(fallback: nil) do
  risky_operation
end

Rails.error.record(severity: :error) do
  critical_operation
end`,
							highlight: [2, 9, 10, 11, 12, 18, 22],
						},
					]}
					learningGoal="Rails.error provides a unified error reporting interface. Subscribe to errors, enrich context, and route to services like Sentry for grouping, alerts, and budgets."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<Layers className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">Grouping:</span> Deduplicate
									identical errors into groups
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Tags className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">Context:</span> Attach user_id,
									request_id for debugging
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Bell className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">Alerts:</span> Get notified
									before users complain
								</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldAlert className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">Budgets:</span> SLO-based error
									budgets track reliability
								</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Rails.error Methods
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<code className="text-primary">.handle</code> - Swallow errors,
								return fallback
							</li>
							<li>
								<code className="text-primary">.record</code> - Report but
								re-raise
							</li>
							<li>
								<code className="text-primary">.set_context</code> - Enrich
								error data
							</li>
							<li>
								<code className="text-primary">.subscribe</code> - Add error
								reporters
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level46ErrorMonitoring;
