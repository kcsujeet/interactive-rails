/**
 * Level 33: Real-Time with Action Cable
 *
 * Replace HTTP polling with WebSocket-based real-time via Action Cable + Solid Cable.
 * Player compares polling vs WebSocket performance and configures the WebSocket approach.
 */

import { Activity, Bell, Clock, Radio, Server, Wifi, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

type Adapter = 'solid_cable' | 'redis' | 'polling' | null;

interface EventSubscription {
	id: string;
	label: string;
	icon: typeof Bell;
	subscribed: boolean;
}

interface PollingRequest {
	id: number;
	timestamp: number;
	hasData: boolean;
}

interface WebSocketMessage {
	id: number;
	timestamp: number;
	event: string;
}

const INITIAL_SUBSCRIPTIONS: EventSubscription[] = [
	{
		id: 'notifications',
		label: 'Notifications',
		icon: Bell,
		subscribed: false,
	},
	{ id: 'messages', label: 'Messages', icon: Radio, subscribed: false },
	{ id: 'activity', label: 'Activity Feed', icon: Activity, subscribed: false },
	{ id: 'status', label: 'Status Updates', icon: Wifi, subscribed: false },
];

export function Level34RealTime({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// Configuration state
	const [adapter, setAdapter] = useState<Adapter>(null);
	const [authEnabled, setAuthEnabled] = useState(false);
	const [subscriptions, setSubscriptions] = useState<EventSubscription[]>(
		INITIAL_SUBSCRIPTIONS,
	);

	// Simulation state
	const [isSimulating, setIsSimulating] = useState(false);
	const [pollingRequests, setPollingRequests] = useState<PollingRequest[]>([]);
	const [wsMessages, setWsMessages] = useState<WebSocketMessage[]>([]);
	const [pollingRequestCount, setPollingRequestCount] = useState(0);
	const [wsMessageCount, setWsMessageCount] = useState(0);
	const [pollingCpu, setPollingCpu] = useState(0);
	const [wsCpu, setWsCpu] = useState(0);
	const [notificationPending, setNotificationPending] = useState(false);
	const [pollingLatency, setPollingLatency] = useState(0);
	const [wsLatency, setWsLatency] = useState(0);

	const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const simulationTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const subscribedCount = subscriptions.filter((s) => s.subscribed).length;

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
			if (simulationTickRef.current) clearInterval(simulationTickRef.current);
		};
	}, []);

	// Polling simulation: generates requests every 400ms when simulating
	useEffect(() => {
		if (!isSimulating) {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current);
				pollingIntervalRef.current = null;
			}
			return;
		}

		pollingIntervalRef.current = setInterval(() => {
			const hasData = Math.random() < 0.01; // 1% chance of data = 99% empty
			const request: PollingRequest = {
				id: Date.now() + Math.random(),
				timestamp: Date.now(),
				hasData,
			};
			setPollingRequests((prev) => [...prev.slice(-14), request]);
			setPollingRequestCount((prev) => prev + 1);
		}, 400);

		return () => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current);
				pollingIntervalRef.current = null;
			}
		};
	}, [isSimulating]);

	// CPU and stats simulation
	useEffect(() => {
		if (!isSimulating) {
			if (simulationTickRef.current) {
				clearInterval(simulationTickRef.current);
				simulationTickRef.current = null;
			}
			return;
		}

		simulationTickRef.current = setInterval(() => {
			// Polling CPU ramps up over time (simulating 25K req/sec load)
			setPollingCpu((prev) => Math.min(95, prev + (95 - prev) * 0.08));
			// WebSocket CPU stays low
			setWsCpu((prev) => {
				const target = 8 + subscribedCount * 2;
				return prev + (target - prev) * 0.1;
			});
			// Polling latency increases with load
			setPollingLatency((prev) => Math.min(2000, prev + (2000 - prev) * 0.05));
			// WebSocket latency stays low
			setWsLatency((prev) => {
				const target = 15 + Math.random() * 10;
				return prev + (target - prev) * 0.2;
			});
		}, 300);

		return () => {
			if (simulationTickRef.current) {
				clearInterval(simulationTickRef.current);
				simulationTickRef.current = null;
			}
		};
	}, [isSimulating, subscribedCount]);

	const toggleSubscription = (id: string) => {
		setSubscriptions((prev) =>
			prev.map((s) => (s.id === id ? { ...s, subscribed: !s.subscribed } : s)),
		);
	};

	const sendNotification = () => {
		if (notificationPending) return;
		setNotificationPending(true);

		// WebSocket: instant delivery
		const wsMsg: WebSocketMessage = {
			id: Date.now(),
			timestamp: Date.now(),
			event: 'New notification pushed',
		};
		setWsMessages((prev) => [...prev.slice(-9), wsMsg]);
		setWsMessageCount((prev) => prev + 1);

		// Polling: shows on next poll cycle (delayed 800-1600ms)
		const pollDelay = 800 + Math.random() * 800;
		setTimeout(() => {
			const pollReq: PollingRequest = {
				id: Date.now() + Math.random(),
				timestamp: Date.now(),
				hasData: true,
			};
			setPollingRequests((prev) => [...prev.slice(-14), pollReq]);
			setPollingRequestCount((prev) => prev + 1);
			setNotificationPending(false);
		}, pollDelay);
	};

	const startSimulation = () => {
		setIsSimulating(true);
		setPollingRequests([]);
		setWsMessages([]);
		setPollingRequestCount(0);
		setWsMessageCount(0);
		setPollingCpu(0);
		setWsCpu(0);
		setPollingLatency(0);
		setWsLatency(0);
	};

	const stopSimulation = () => {
		setIsSimulating(false);
	};

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (adapter !== 'solid_cable') {
			errors.push(
				adapter === null
					? 'Select an adapter for Action Cable'
					: adapter === 'redis'
						? 'Redis works but Solid Cable is the Rails 8 default -- no external dependency needed'
						: 'Polling defeats the purpose of real-time WebSockets',
			);
		}

		if (!authEnabled) {
			errors.push(
				'Authentication must be enabled to secure WebSocket connections',
			);
		}

		if (subscribedCount === 0) {
			errors.push('Subscribe to at least one event type');
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'WebSocket configuration incomplete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Action Cable + Solid Cable configured correctly!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act5-level34-realtime', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setAdapter(null);
		setAuthEnabled(false);
		setSubscriptions(INITIAL_SUBSCRIPTIONS);
		setIsSimulating(false);
		setPollingRequests([]);
		setWsMessages([]);
		setPollingRequestCount(0);
		setWsMessageCount(0);
		setPollingCpu(0);
		setWsCpu(0);
		setPollingLatency(0);
		setWsLatency(0);
		setNotificationPending(false);
	};

	const reqPerSec = isSimulating
		? Math.round(
				pollingRequestCount /
					Math.max(
						1,
						(Date.now() - (pollingRequests[0]?.timestamp ?? Date.now())) / 1000,
					),
			)
		: 0;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Replace HTTP polling with WebSocket-based real-time via Action Cable + Solid Cable."
					instructions={[
						'Compare polling vs WebSocket performance',
						'Choose Solid Cable as the adapter (Rails 8)',
						'Enable authentication for secure connections',
						'Subscribe to event channels',
					]}
					scenario="50K users polling every 2 seconds = 25K requests/sec. 99% of responses return empty. Server CPU at 95%. Time to switch to WebSockets!"
				>
					{/* Scenario Stats */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Current Problem
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Server className="w-3.5 h-3.5" />
									Active users
								</span>
								<span className="text-foreground font-mono">50,000</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Clock className="w-3.5 h-3.5" />
									Poll interval
								</span>
								<span className="text-foreground font-mono">2s</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Activity className="w-3.5 h-3.5" />
									Requests/sec
								</span>
								<span className="text-destructive font-mono font-semibold">
									25,000
								</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Zap className="w-3.5 h-3.5" />
									Empty responses
								</span>
								<span className="text-destructive font-mono font-semibold">
									99%
								</span>
							</div>
						</div>
					</div>

					{/* WebSocket Configuration */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							WebSocket Config
						</div>

						{/* Adapter selection */}
						<div className="mb-3">
							<div className="text-xs text-muted-foreground mb-2">Adapter</div>
							<div className="space-y-1.5">
								{[
									{
										value: 'solid_cable' as Adapter,
										label: 'Solid Cable',
										desc: 'Rails 8 default, no Redis',
									},
									{
										value: 'redis' as Adapter,
										label: 'Redis',
										desc: 'External dependency',
									},
									{
										value: 'polling' as Adapter,
										label: 'Polling',
										desc: 'Not real WebSockets',
									},
								].map((opt) => (
									<Button
										className={`w-full p-2 h-auto text-left justify-start rounded-lg border transition-all ${
											adapter === opt.value
												? opt.value === 'solid_cable'
													? 'border-success bg-success/10'
													: 'border-warning bg-warning/10'
												: 'border-border bg-card hover:border-muted-foreground'
										}`}
										key={opt.value}
										onClick={() => setAdapter(opt.value)}
										variant="ghost"
									>
										<div className="flex items-center gap-2 w-full">
											<div
												className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
													adapter === opt.value
														? opt.value === 'solid_cable'
															? 'border-success'
															: 'border-warning'
														: 'border-muted-foreground'
												}`}
											>
												{adapter === opt.value && (
													<div
														className={`w-1.5 h-1.5 rounded-full ${
															opt.value === 'solid_cable'
																? 'bg-success'
																: 'bg-warning'
														}`}
													/>
												)}
											</div>
											<div className="flex-1">
												<div
													className={`text-sm font-medium ${
														adapter === opt.value
															? opt.value === 'solid_cable'
																? 'text-success'
																: 'text-warning'
															: 'text-foreground'
													}`}
												>
													{opt.label}
												</div>
												<div className="text-xs text-muted-foreground">
													{opt.desc}
												</div>
											</div>
										</div>
									</Button>
								))}
							</div>
						</div>

						{/* Authentication toggle */}
						<div className="mb-3">
							<Button
								className={`w-full p-2 h-auto text-left justify-start rounded-lg border transition-all ${
									authEnabled
										? 'border-success bg-success/10'
										: 'border-border bg-card hover:border-muted-foreground'
								}`}
								onClick={() => setAuthEnabled(!authEnabled)}
								variant="ghost"
							>
								<div className="flex items-center justify-between w-full">
									<span
										className={`text-sm font-medium ${authEnabled ? 'text-success' : 'text-foreground'}`}
									>
										Authentication
									</span>
									<span
										className={`text-xs px-2 py-0.5 rounded ${
											authEnabled
												? 'bg-success/20 text-success'
												: 'bg-muted text-muted-foreground'
										}`}
									>
										{authEnabled ? 'ON' : 'OFF'}
									</span>
								</div>
							</Button>
						</div>

						{/* Channel subscriptions */}
						<div>
							<div className="text-xs text-muted-foreground mb-2">
								Subscribe to events
							</div>
							<div className="space-y-1.5">
								{subscriptions.map((sub) => (
									<Button
										className={`w-full p-2 h-auto text-left justify-start rounded-lg border transition-all ${
											sub.subscribed
												? 'border-success bg-success/10'
												: 'border-border bg-card hover:border-muted-foreground'
										}`}
										key={sub.id}
										onClick={() => toggleSubscription(sub.id)}
										variant="ghost"
									>
										<div className="flex items-center gap-2 w-full">
											<sub.icon
												className={`w-3.5 h-3.5 ${sub.subscribed ? 'text-success' : 'text-muted-foreground'}`}
											/>
											<span
												className={`text-sm ${sub.subscribed ? 'text-success' : 'text-foreground'}`}
											>
												{sub.label}
											</span>
											{sub.subscribed && (
												<span className="ml-auto text-success text-xs">
													subscribed
												</span>
											)}
										</div>
									</Button>
								))}
							</div>
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-1">
							<span className="text-muted-foreground">Config progress</span>
							<span
								className={
									adapter === 'solid_cable' &&
									authEnabled &&
									subscribedCount > 0
										? 'text-success'
										: 'text-foreground'
								}
							>
								{(adapter === 'solid_cable' ? 1 : 0) +
									(authEnabled ? 1 : 0) +
									(subscribedCount > 0 ? 1 : 0)}{' '}
								/ 3
							</span>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Real-Time"
					levelNumber={34}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-5xl mx-auto">
						{/* Simulation Controls */}
						<div className="flex items-center justify-between mb-6">
							<Button
								color={isSimulating ? 'destructive' : 'primary'}
								onClick={isSimulating ? stopSimulation : startSimulation}
							>
								{isSimulating ? 'Stop Simulation' : 'Start Simulation'}
							</Button>

							<Button
								disabled={!isSimulating}
								onClick={sendNotification}
								variant="outline"
							>
								<Bell className="w-4 h-4 mr-2" />
								Send Notification
								{notificationPending && (
									<span className="ml-2 text-xs text-muted-foreground">
										(delivering...)
									</span>
								)}
							</Button>
						</div>

						{/* Side-by-side comparison */}
						<div className="grid grid-cols-2 gap-4 mb-6">
							{/* Polling Side */}
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-destructive/10 px-4 py-3 border-b border-border flex items-center gap-2">
									<Clock className="w-4 h-4 text-destructive" />
									<span className="text-foreground font-semibold">
										HTTP Polling
									</span>
								</div>
								<div className="p-4">
									{/* Request stream */}
									<div className="mb-4">
										<div className="text-xs text-muted-foreground mb-2">
											Request stream
										</div>
										<div className="h-32 bg-background rounded-lg border border-border p-2 overflow-hidden font-mono text-xs space-y-0.5">
											{pollingRequests.length === 0 ? (
												<div className="text-muted-foreground text-center pt-12">
													Start simulation...
												</div>
											) : (
												pollingRequests.map((req) => (
													<div className="flex items-center gap-2" key={req.id}>
														<span
															className={`w-1.5 h-1.5 rounded-full shrink-0 ${
																req.hasData ? 'bg-success' : 'bg-destructive/40'
															}`}
														/>
														<span className="text-muted-foreground">
															GET /notifications
														</span>
														<span
															className={
																req.hasData
																	? 'text-success'
																	: 'text-destructive/60'
															}
														>
															{req.hasData ? '200 [data]' : '200 []'}
														</span>
													</div>
												))
											)}
										</div>
									</div>

									{/* Server load bar */}
									<div className="mb-3">
										<div className="flex items-center justify-between text-xs mb-1">
											<span className="text-muted-foreground flex items-center gap-1">
												<Server className="w-3 h-3" />
												Server CPU
											</span>
											<span
												className={
													pollingCpu > 80
														? 'text-destructive font-semibold'
														: pollingCpu > 50
															? 'text-warning'
															: 'text-success'
												}
											>
												{Math.round(pollingCpu)}%
											</span>
										</div>
										<div className="h-3 bg-background rounded-full border border-border overflow-hidden">
											<div
												className={`h-full rounded-full transition-all duration-300 ${
													pollingCpu > 80
														? 'bg-destructive'
														: pollingCpu > 50
															? 'bg-warning'
															: 'bg-success'
												}`}
												style={{ width: `${pollingCpu}%` }}
											/>
										</div>
									</div>

									{/* Stats */}
									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="bg-background rounded-lg p-2 border border-border">
											<div className="text-muted-foreground">Requests</div>
											<div className="text-foreground font-mono font-semibold">
												{pollingRequestCount}
											</div>
										</div>
										<div className="bg-background rounded-lg p-2 border border-border">
											<div className="text-muted-foreground">Latency</div>
											<div
												className={`font-mono font-semibold ${
													pollingLatency > 1000
														? 'text-destructive'
														: 'text-foreground'
												}`}
											>
												{Math.round(pollingLatency)}ms
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* WebSocket Side */}
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-success/10 px-4 py-3 border-b border-border flex items-center gap-2">
									<Zap className="w-4 h-4 text-success" />
									<span className="text-foreground font-semibold">
										WebSocket (Action Cable)
									</span>
								</div>
								<div className="p-4">
									{/* Connection / message stream */}
									<div className="mb-4">
										<div className="text-xs text-muted-foreground mb-2">
											Connection stream
										</div>
										<div className="h-32 bg-background rounded-lg border border-border p-2 overflow-hidden font-mono text-xs space-y-0.5">
											{!isSimulating ? (
												<div className="text-muted-foreground text-center pt-12">
													Start simulation...
												</div>
											) : wsMessages.length === 0 ? (
												<div className="space-y-1">
													<div className="flex items-center gap-2">
														<span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
														<span className="text-success">
															Connected (persistent)
														</span>
													</div>
													<div className="flex items-center gap-2">
														<span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
														<span className="text-muted-foreground">
															Waiting for events...
														</span>
													</div>
												</div>
											) : (
												<>
													<div className="flex items-center gap-2">
														<span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
														<span className="text-success">
															Connected (persistent)
														</span>
													</div>
													{wsMessages.map((msg) => (
														<div
															className="flex items-center gap-2"
															key={msg.id}
														>
															<span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
															<span className="text-primary">PUSH</span>
															<span className="text-foreground">
																{msg.event}
															</span>
														</div>
													))}
												</>
											)}
										</div>
									</div>

									{/* Server load bar */}
									<div className="mb-3">
										<div className="flex items-center justify-between text-xs mb-1">
											<span className="text-muted-foreground flex items-center gap-1">
												<Server className="w-3 h-3" />
												Server CPU
											</span>
											<span className="text-success font-semibold">
												{Math.round(wsCpu)}%
											</span>
										</div>
										<div className="h-3 bg-background rounded-full border border-border overflow-hidden">
											<div
												className="h-full rounded-full bg-success transition-all duration-300"
												style={{ width: `${Math.max(wsCpu, 2)}%` }}
											/>
										</div>
									</div>

									{/* Stats */}
									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="bg-background rounded-lg p-2 border border-border">
											<div className="text-muted-foreground">Messages</div>
											<div className="text-foreground font-mono font-semibold">
												{wsMessageCount}
											</div>
										</div>
										<div className="bg-background rounded-lg p-2 border border-border">
											<div className="text-muted-foreground">Latency</div>
											<div className="text-success font-mono font-semibold">
												{isSimulating ? `${Math.round(wsLatency)}ms` : '0ms'}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Stats Comparison Summary */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Performance Comparison
								</div>
							</div>
							<div className="p-4">
								<div className="grid grid-cols-3 gap-4">
									{/* Requests/sec */}
									<div className="text-center">
										<div className="text-xs text-muted-foreground mb-2">
											Requests/sec
										</div>
										<div className="flex items-end justify-center gap-4">
											<div>
												<div className="text-destructive font-mono font-bold text-lg">
													{isSimulating ? `~${Math.max(reqPerSec, 1)}` : '0'}
												</div>
												<div className="text-xs text-muted-foreground">
													Polling
												</div>
											</div>
											<div>
												<div className="text-success font-mono font-bold text-lg">
													0
												</div>
												<div className="text-xs text-muted-foreground">
													WebSocket
												</div>
											</div>
										</div>
									</div>

									{/* Latency */}
									<div className="text-center">
										<div className="text-xs text-muted-foreground mb-2">
											Avg Latency
										</div>
										<div className="flex items-end justify-center gap-4">
											<div>
												<div
													className={`font-mono font-bold text-lg ${
														pollingLatency > 1000
															? 'text-destructive'
															: 'text-foreground'
													}`}
												>
													{Math.round(pollingLatency)}ms
												</div>
												<div className="text-xs text-muted-foreground">
													Polling
												</div>
											</div>
											<div>
												<div className="text-success font-mono font-bold text-lg">
													{isSimulating ? `${Math.round(wsLatency)}ms` : '0ms'}
												</div>
												<div className="text-xs text-muted-foreground">
													WebSocket
												</div>
											</div>
										</div>
									</div>

									{/* Server CPU */}
									<div className="text-center">
										<div className="text-xs text-muted-foreground mb-2">
											Server CPU
										</div>
										<div className="flex items-end justify-center gap-4">
											<div>
												<div
													className={`font-mono font-bold text-lg ${
														pollingCpu > 80
															? 'text-destructive'
															: 'text-foreground'
													}`}
												>
													{Math.round(pollingCpu)}%
												</div>
												<div className="text-xs text-muted-foreground">
													Polling
												</div>
											</div>
											<div>
												<div className="text-success font-mono font-bold text-lg">
													{Math.round(wsCpu)}%
												</div>
												<div className="text-xs text-muted-foreground">
													WebSocket
												</div>
											</div>
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
							filename: 'config/cable.yml',
							language: 'ruby',
							code: `# Rails 8: Solid Cable, no Redis!
production:
  adapter: ${adapter ?? '???'}`,
							highlight: adapter === 'solid_cable' ? [3] : [],
						},
						{
							filename: 'app/channels/notifications_channel.rb',
							language: 'ruby',
							code: `class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end
end`,
							highlight: authEnabled ? [3] : [],
						},
						{
							filename: 'app/models/notification.rb',
							language: 'ruby',
							code: `class Notification < ApplicationRecord
  after_create_commit :broadcast_to_user

  private

  def broadcast_to_user
    NotificationsChannel.broadcast_to(user, {
      id: id, title: title, body: body
    })
  end
end`,
							highlight: [2, 7, 8, 9],
						},
						{
							filename: 'app/channels/application_cable/connection.rb',
							language: 'ruby',
							code: authEnabled
								? `module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      if verified_user = User.find_by(
        id: cookies.encrypted[:user_id]
      )
        verified_user
      else
        reject_unauthorized_connection
      end
    end
  end
end`
								: `module ApplicationCable
  class Connection < ActionCable::Connection::Base
    # WARNING: No authentication!
    # Anyone can connect to your channels
  end
end`,
							highlight: authEnabled ? [3, 6, 12, 13, 16] : [],
						},
					]}
					learningGoal="Action Cable + Solid Cable (Rails 8) replaces polling with WebSockets. No Redis needed. Push data only when events occur."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Solid Cable is the Rails 8 default adapter</li>
							<li>• No Redis dependency required</li>
							<li>• Push data only when events occur</li>
							<li>• Authenticate connections in ApplicationCable</li>
							<li>• Use stream_for for user-scoped channels</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Polling vs WebSocket
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Polling: client asks repeatedly (wasteful)</li>
							<li>• WebSocket: server pushes when ready (efficient)</li>
							<li>• 99% fewer requests with WebSockets</li>
							<li>• Near-zero latency for notifications</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Rails 8 Stack
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>• Action Cable - WebSocket framework</li>
							<li>• Solid Cable - DB-backed adapter</li>
							<li>• Solid Queue - Background jobs</li>
							<li>• Solid Cache - Caching adapter</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level34RealTime;
