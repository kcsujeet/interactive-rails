/**
 * Level 46: Observability
 *
 * Distributed tracing with flame graph visualization.
 * Find the slow service causing latency issues.
 */

import { useCallback, useState } from 'react';
import type { ValidationResult } from '@/components/levels';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface Span {
	id: string;
	service: string;
	operation: string;
	duration: number;
	start: number;
	traced: boolean;
}

export function Level50Observability({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [tracingEnabled, setTracingEnabled] = useState(false);
	const [spans, setSpans] = useState<Span[]>([
		{
			id: 'auth',
			service: 'Auth',
			operation: 'verify_token',
			duration: 50,
			start: 0,
			traced: false,
		},
		{
			id: 'billing',
			service: 'Billing',
			operation: 'get_subscription',
			duration: 1800,
			start: 50,
			traced: false,
		},
		{
			id: 'orders',
			service: 'Orders',
			operation: 'recent_orders',
			duration: 120,
			start: 1850,
			traced: false,
		},
		{
			id: 'db',
			service: 'Database',
			operation: 'query',
			duration: 30,
			start: 1970,
			traced: false,
		},
	]);
	const [selectedSpan, setSelectedSpan] = useState<string | null>(null);
	const [problemFound, setProblemFound] = useState(false);

	const totalDuration = spans.reduce(
		(max, s) => Math.max(max, s.start + s.duration),
		0,
	);
	const handleValidate = useCallback((): ValidationResult => {
		if (!tracingEnabled) {
			return {
				valid: false,
				message: 'Enable tracing',
				details: ['Click "Enable Distributed Tracing" to instrument services'],
			};
		}
		if (!problemFound) {
			return {
				valid: false,
				message: 'Find the bottleneck',
				details: [
					'Click on spans in the flame graph to identify the slow service',
				],
			};
		}
		return {
			valid: true,
			message: 'Bottleneck identified! Billing service is the culprit.',
		};
	}, [tracingEnabled, problemFound]);

	const enableTracing = () => {
		setTracingEnabled(true);
		// Reveal spans one by one
		let index = 0;
		const interval = setInterval(() => {
			if (index >= spans.length) {
				clearInterval(interval);
				return;
			}
			setSpans((prev) =>
				prev.map((s, i) => (i === index ? { ...s, traced: true } : s)),
			);
			index++;
		}, 500);
	};

	const handleSpanClick = (spanId: string) => {
		setSelectedSpan(spanId);
		if (spanId === 'billing') {
			setProblemFound(true);
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act7-level50-observability', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getSpanColor = (service: string) => {
		const colors: Record<string, string> = {
			Auth: '#22c55e',
			Billing: '#ef4444',
			Orders: '#3b82f6',
			Database: '#a855f7',
		};
		return colors[service] || '#6b7280';
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn distributed tracing for debugging latency in microservices."
					instructions={[
						'Notice the slow 2s total request time',
						'Enable distributed tracing',
						'Click on spans to identify the bottleneck',
					]}
					scenario="Users report the checkout page takes 2+ seconds to load. But which service is causing the delay? We need distributed tracing to find out."
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								tracingEnabled
									? 'bg-success text-success-foreground cursor-default'
									: ''
							}`}
							disabled={tracingEnabled}
							onClick={enableTracing}
						>
							{tracingEnabled
								? 'Tracing Enabled'
								: 'Enable Distributed Tracing'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Request Metrics
						</div>
						<div className="space-y-2">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Total Duration:</span>
								<span
									className={`font-bold ${totalDuration > 1000 ? 'text-destructive' : 'text-success'}`}
								>
									{totalDuration}ms
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Services:</span>
								<span className="text-foreground">{spans.length}</span>
							</div>
						</div>
					</div>

					{selectedSpan && (
						<div className="p-4 border-t border-border">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Selected Span
							</div>
							{spans
								.filter((s) => s.id === selectedSpan)
								.map((span) => (
									<div
										className={`p-3 rounded-lg ${
											span.id === 'billing'
												? 'bg-destructive/20 border border-destructive'
												: 'bg-card'
										}`}
										key={span.id}
									>
										<div className="text-foreground font-medium">
											{span.service}
										</div>
										<div className="text-muted-foreground text-sm">
											{span.operation}
										</div>
										<div
											className={`text-sm mt-1 ${span.duration > 500 ? 'text-destructive' : 'text-success'}`}
										>
											{span.duration}ms
										</div>
										{span.id === 'billing' && (
											<div className="text-destructive text-xs mt-2">
												BOTTLENECK FOUND! This service is slow.
											</div>
										)}
									</div>
								))}
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Observability"
					levelNumber={50}
					onComplete={handleComplete}
					onReset={() => {
						setTracingEnabled(false);
						setSpans([
							{
								id: 'auth',
								service: 'Auth',
								operation: 'verify_token',
								duration: 50,
								start: 0,
								traced: false,
							},
							{
								id: 'billing',
								service: 'Billing',
								operation: 'get_subscription',
								duration: 1800,
								start: 50,
								traced: false,
							},
							{
								id: 'orders',
								service: 'Orders',
								operation: 'recent_orders',
								duration: 120,
								start: 1850,
								traced: false,
							},
							{
								id: 'db',
								service: 'Database',
								operation: 'query',
								duration: 30,
								start: 1970,
								traced: false,
							},
						]);
						setSelectedSpan(null);
						setProblemFound(false);
					}}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Flame Graph */}
					<div className="bg-card rounded-xl p-6">
						<div className="flex items-center justify-between mb-4">
							<div className="text-muted-foreground text-xs uppercase tracking-wider">
								Trace: checkout-request
							</div>
							<div className="text-muted-foreground text-xs">
								Total: {totalDuration}ms
							</div>
						</div>

						{/* Timeline */}
						<div className="relative mb-4">
							<div className="absolute top-0 left-0 right-0 h-px bg-border" />
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>0ms</span>
								<span>{Math.round(totalDuration / 4)}ms</span>
								<span>{Math.round(totalDuration / 2)}ms</span>
								<span>{Math.round((totalDuration * 3) / 4)}ms</span>
								<span>{totalDuration}ms</span>
							</div>
						</div>

						{/* Spans */}
						<div className="space-y-2">
							{spans.map((span) => {
								const width = (span.duration / totalDuration) * 100;
								const left = (span.start / totalDuration) * 100;

								return (
									<div className="relative h-10" key={span.id}>
										{tracingEnabled && span.traced ? (
											<Button
												className={`absolute h-full p-0 rounded transition-all hover:opacity-90 ${
													selectedSpan === span.id
														? 'ring-2 ring-foreground'
														: ''
												}`}
												onClick={() => handleSpanClick(span.id)}
												style={{
													left: `${left}%`,
													width: `${width}%`,
													backgroundColor: getSpanColor(span.service),
													minWidth: '60px',
												}}
												variant={
													selectedSpan === span.id ? 'default' : 'outline'
												}
											>
												<div className="flex items-center justify-between px-2 h-full text-foreground text-xs w-full">
													<span className="truncate">{span.service}</span>
													<span>{span.duration}ms</span>
												</div>
											</Button>
										) : (
											<div
												className="absolute h-full rounded bg-secondary"
												style={{
													left: `${left}%`,
													width: `${width}%`,
													minWidth: '60px',
												}}
											>
												<div className="flex items-center justify-center h-full text-muted-foreground text-xs">
													{tracingEnabled ? '...' : '???'}
												</div>
											</div>
										)}
									</div>
								);
							})}
						</div>

						{/* Legend */}
						<div className="flex flex-wrap gap-4 mt-6">
							{Array.from(new Set(spans.map((s) => s.service))).map(
								(service) => (
									<div
										className="flex items-center gap-2 text-xs"
										key={service}
									>
										<div
											className="w-3 h-3 rounded"
											style={{ backgroundColor: getSpanColor(service) }}
										/>
										<span className="text-muted-foreground">{service}</span>
									</div>
								),
							)}
						</div>
					</div>

					{/* Problem indicator */}
					{problemFound && (
						<div className="mt-6 bg-destructive/20 border border-destructive rounded-lg p-4 max-w-md mx-auto">
							<div className="text-destructive font-medium">
								Bottleneck Identified!
							</div>
							<div className="text-destructive/80 text-sm mt-1">
								The Billing service takes 1800ms (90% of total time).
								Investigate database queries or cache the subscription data.
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'config/initializers/opentelemetry.rb',
							language: 'ruby',
							code: `require 'opentelemetry/sdk'
require 'opentelemetry/exporter/otlp'
require 'opentelemetry/instrumentation/all'

OpenTelemetry::SDK.configure do |c|
  c.service_name = 'checkout-service'

  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(
      OpenTelemetry::Exporter::OTLP::Exporter.new
    )
  )

  # Auto-instrument Rails, ActiveRecord, Faraday, etc.
  c.use_all
end

# Manual span for custom operations:
tracer = OpenTelemetry.tracer_provider.tracer('app')

tracer.in_span('get_subscription') do |span|
  span.set_attribute('user.id', user.id)
  BillingClient.get_subscription(user)
end`,
							highlight: [5, 6, 15, 20, 21, 22, 23, 24],
						},
					]}
					learningGoal="Distributed tracing shows the full journey of a request across services. Use it to find bottlenecks and debug latency issues."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level50Observability;
