/**
 * Level 44: State Machines
 *
 * State diagram builder for order lifecycle using AASM.
 * Users draw valid transitions between states, add guard conditions,
 * and test invalid transitions to learn state machine patterns.
 */

import { useCallback, useState } from 'react';
import {
	ArrowRight,
	CheckCircle,
	Circle,
	GitBranch,
	ShieldCheck,
	XCircle,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StateName = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

interface StateNode {
	id: StateName;
	label: string;
	x: number;
	y: number;
	isInitial: boolean;
	isFinal: boolean;
}

interface Transition {
	from: StateName;
	to: StateName;
	guard?: string;
}

interface TestResult {
	from: StateName;
	to: StateName;
	success: boolean;
	message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string | undefined> = {
	'pending->confirmed': 'payment_received?',
	'confirmed->shipped': undefined,
	'shipped->delivered': undefined,
	'pending->cancelled': undefined,
	'confirmed->cancelled': undefined,
};

const STATES: StateNode[] = [
	{ id: 'pending', label: 'Pending', x: 100, y: 200, isInitial: true, isFinal: false },
	{ id: 'confirmed', label: 'Confirmed', x: 300, y: 100, isInitial: false, isFinal: false },
	{ id: 'shipped', label: 'Shipped', x: 500, y: 100, isInitial: false, isFinal: false },
	{ id: 'delivered', label: 'Delivered', x: 700, y: 100, isInitial: false, isFinal: true },
	{ id: 'cancelled', label: 'Cancelled', x: 400, y: 340, isInitial: false, isFinal: true },
];

const STATE_COLORS: Record<StateName, string> = {
	pending: 'border-warning text-warning',
	confirmed: 'border-primary text-primary',
	shipped: 'border-info text-info',
	delivered: 'border-success text-success',
	cancelled: 'border-destructive text-destructive',
};

const STATE_BG: Record<StateName, string> = {
	pending: 'bg-warning/10',
	confirmed: 'bg-primary/10',
	shipped: 'bg-blue-500/10',
	delivered: 'bg-success/10',
	cancelled: 'bg-destructive/10',
};

const GUARD_OPTIONS: Record<string, string[]> = {
	'pending->confirmed': ['payment_received?', 'items_available?', 'no guard'],
	'confirmed->shipped': ['tracking_number_set?', 'warehouse_confirmed?', 'no guard'],
	'shipped->delivered': ['signature_confirmed?', 'no guard'],
	'pending->cancelled': ['within_cancellation_window?', 'no guard'],
	'confirmed->cancelled': ['not_yet_shipped?', 'no guard'],
};

// ---------------------------------------------------------------------------
// Helper: compute arrow path between two state nodes
// ---------------------------------------------------------------------------

function getArrowPath(from: StateNode, to: StateNode): { d: string; labelX: number; labelY: number; angle: number } {
	const r = 44; // radius of state circles
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	const nx = dx / dist;
	const ny = dy / dist;

	const startX = from.x + nx * r;
	const startY = from.y + ny * r;
	const endX = to.x - nx * r;
	const endY = to.y - ny * r;

	const midX = (startX + endX) / 2;
	const midY = (startY + endY) / 2;

	// slight curve offset
	const perpX = -ny * 20;
	const perpY = nx * 20;

	const cpX = midX + perpX;
	const cpY = midY + perpY;

	const labelX = midX + perpX * 0.8;
	const labelY = midY + perpY * 0.8;

	const angle = Math.atan2(endY - cpY, endX - cpX) * (180 / Math.PI);

	const d = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
	return { d, labelX, labelY, angle };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Level44StateMachines({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	const [transitions, setTransitions] = useState<Transition[]>([]);
	const [drawingFrom, setDrawingFrom] = useState<StateName | null>(null);
	const [rejectedArrow, setRejectedArrow] = useState<{ from: StateName; to: StateName } | null>(null);
	const [testResults, setTestResults] = useState<TestResult[]>([]);
	const [isTesting, setIsTesting] = useState(false);
	const [guardEditing, setGuardEditing] = useState<string | null>(null);

	// ----- Transition helpers -------------------------------------------------

	const transitionKey = (from: StateName, to: StateName) => `${from}->${to}`;

	const hasTransition = useCallback(
		(from: StateName, to: StateName) =>
			transitions.some((t) => t.from === from && t.to === to),
		[transitions],
	);

	const isValidTransition = (from: StateName, to: StateName) =>
		transitionKey(from, to) in VALID_TRANSITIONS;

	// ----- Drawing transitions ------------------------------------------------

	const handleStateClick = (stateId: StateName) => {
		if (guardEditing) return; // don't start drawing while editing guards

		if (drawingFrom === null) {
			// Start drawing
			setDrawingFrom(stateId);
		} else if (drawingFrom === stateId) {
			// Cancel drawing (clicked same state)
			setDrawingFrom(null);
		} else {
			// Finish drawing
			const from = drawingFrom;
			const to = stateId;
			setDrawingFrom(null);

			if (hasTransition(from, to)) {
				// Already exists
				return;
			}

			if (isValidTransition(from, to)) {
				setTransitions((prev) => [...prev, { from, to }]);
			} else {
				// Invalid transition - show rejection
				setRejectedArrow({ from, to });
				setTimeout(() => setRejectedArrow(null), 1500);
			}
		}
	};

	// ----- Guard editing ------------------------------------------------------

	const handleSetGuard = (from: StateName, to: StateName, guard: string) => {
		const guardValue = guard === 'no guard' ? undefined : guard;
		setTransitions((prev) =>
			prev.map((t) =>
				t.from === from && t.to === to ? { ...t, guard: guardValue } : t,
			),
		);
		setGuardEditing(null);
	};

	// ----- Remove transition --------------------------------------------------

	const handleRemoveTransition = (from: StateName, to: StateName) => {
		setTransitions((prev) => prev.filter((t) => !(t.from === from && t.to === to)));
	};

	// ----- Test button --------------------------------------------------------

	const runTests = async () => {
		setIsTesting(true);
		setTestResults([]);

		const invalidTests: Array<{ from: StateName; to: StateName }> = [
			{ from: 'shipped', to: 'pending' },
			{ from: 'delivered', to: 'cancelled' },
			{ from: 'delivered', to: 'pending' },
			{ from: 'cancelled', to: 'confirmed' },
		];

		const results: TestResult[] = [];

		for (const test of invalidTests) {
			await new Promise((r) => setTimeout(r, 400));

			const allowed = hasTransition(test.from, test.to);
			results.push({
				from: test.from,
				to: test.to,
				success: !allowed,
				message: allowed
					? `Allowed ${test.from} -> ${test.to} (should be blocked!)`
					: `AASM::InvalidTransition - Cannot transition from ${test.from} to ${test.to}`,
			});
			setTestResults([...results]);
		}

		// Also test valid transitions the user has defined
		const validTests: Array<{ from: StateName; to: StateName }> = [
			{ from: 'pending', to: 'confirmed' },
			{ from: 'confirmed', to: 'shipped' },
		];

		for (const test of validTests) {
			await new Promise((r) => setTimeout(r, 400));

			const allowed = hasTransition(test.from, test.to);
			results.push({
				from: test.from,
				to: test.to,
				success: allowed,
				message: allowed
					? `Transition ${test.from} -> ${test.to} succeeded`
					: `No transition defined from ${test.from} to ${test.to}`,
			});
			setTestResults([...results]);
		}

		setIsTesting(false);
	};

	// ----- Validation ---------------------------------------------------------

	const handleValidate = useCallback((): ValidationResult => {
		const errors: string[] = [];

		// Must have all 5 states (they're always present)
		// Must have at least 4 valid transitions
		if (transitions.length < 4) {
			errors.push(
				`Define at least 4 valid transitions (you have ${transitions.length})`,
			);
		}

		// Must NOT allow shipped -> pending
		if (hasTransition('shipped', 'pending')) {
			errors.push('shipped -> pending must NOT be allowed');
		}

		// Check that core transitions exist
		const coreTransitions = [
			{ from: 'pending' as StateName, to: 'confirmed' as StateName, label: 'pending -> confirmed' },
			{ from: 'confirmed' as StateName, to: 'shipped' as StateName, label: 'confirmed -> shipped' },
			{ from: 'shipped' as StateName, to: 'delivered' as StateName, label: 'shipped -> delivered' },
		];

		for (const core of coreTransitions) {
			if (!hasTransition(core.from, core.to)) {
				errors.push(`Missing core transition: ${core.label}`);
			}
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'State machine is incomplete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'State machine correctly guards the order lifecycle!',
		};
	}, [transitions, hasTransition]);

	// ----- Completion ---------------------------------------------------------

	const handleComplete = async () => {
		const success = await completeLevel('act7-level44-state-machines', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// ----- Reset --------------------------------------------------------------

	const handleReset = () => {
		setTransitions([]);
		setDrawingFrom(null);
		setRejectedArrow(null);
		setTestResults([]);
		setIsTesting(false);
		setGuardEditing(null);
	};

	// ----- Generated code -----------------------------------------------------

	const generateCode = (): string => {
		const stateLines = STATES.filter((s) => !s.isInitial)
			.map((s) => `:${s.id}`)
			.join(', ');

		const eventBlocks: string[] = [];

		// Group transitions by event name
		const eventMap: Record<string, Transition[]> = {};
		for (const t of transitions) {
			const eventName = getEventName(t.from, t.to);
			if (!eventMap[eventName]) eventMap[eventName] = [];
			eventMap[eventName].push(t);
		}

		for (const [eventName, trans] of Object.entries(eventMap)) {
			const lines: string[] = [];
			lines.push(`    event :${eventName} do`);
			for (const t of trans) {
				const fromStates =
					trans.filter((tr) => tr.to === t.to).length > 1
						? `[:${trans
								.filter((tr) => tr.to === t.to)
								.map((tr) => tr.from)
								.join(', :')}]`
						: `:${t.from}`;

				let line = `      transitions from: ${fromStates}, to: :${t.to}`;
				if (t.guard) {
					line += `,\n                  guard: :${t.guard}`;
				}
				lines.push(line);
			}
			lines.push('    end');
			eventBlocks.push(lines.join('\n'));
		}

		return `class Order < ApplicationRecord
  include AASM

  aasm column: :status do
    state :pending, initial: true
    state ${stateLines}

${eventBlocks.length > 0 ? eventBlocks.join('\n\n') : '    # Add transitions by clicking states'}
  end
end

# Usage:
# order.confirm!  # pending -> confirmed
# order.ship!     # confirmed -> shipped
# order.cancel!   # raises AASM::InvalidTransition if shipped!`;
	};

	// Get event name for a transition
	function getEventName(from: StateName, to: StateName): string {
		const names: Record<string, string> = {
			'pending->confirmed': 'confirm',
			'confirmed->shipped': 'ship',
			'shipped->delivered': 'deliver',
			'pending->cancelled': 'cancel',
			'confirmed->cancelled': 'cancel',
		};
		return names[transitionKey(from, to)] || `transition_${from}_to_${to}`;
	}

	// ----- Render -------------------------------------------------------------

	const stateMap = Object.fromEntries(STATES.map((s) => [s.id, s]));

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Model an order lifecycle with AASM state machines to enforce valid transitions and prevent invalid state changes."
					instructions={[
						'Click a state to start drawing a transition arrow',
						'Click a second state to complete the transition',
						'Invalid transitions will be rejected with a red animation',
						'Click the shield icon on a transition to add a guard condition',
						'Use the Test button to verify invalid transitions are blocked',
					]}
					scenario="Orders go from 'shipped' back to 'pending' -- invalid! The status is just a string column with no guards. Customers exploit this to get double refunds."
				>
					<div className="p-4 border-t border-border space-y-3">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Drawing Mode
						</div>
						{drawingFrom ? (
							<div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
								<Circle className="w-4 h-4 text-primary" />
								<span className="text-sm text-primary">
									Drawing from <span className="font-bold">{drawingFrom}</span>
								</span>
								<Button
									className="ml-auto"
									onClick={() => setDrawingFrom(null)}
									size="sm"
									variant="ghost"
								>
									<XCircle className="w-4 h-4" />
								</Button>
							</div>
						) : (
							<div className="text-sm text-muted-foreground p-3 rounded-lg bg-secondary">
								Click a state node to begin
							</div>
						)}
					</div>

					<div className="p-4 border-t border-border space-y-3">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Transitions ({transitions.length})
						</div>
						{transitions.length === 0 ? (
							<div className="text-sm text-muted-foreground">
								No transitions defined yet
							</div>
						) : (
							<div className="space-y-2 max-h-40 overflow-y-auto">
								{transitions.map((t) => (
									<div
										className="flex items-center gap-2 text-sm p-2 rounded-lg bg-secondary"
										key={transitionKey(t.from, t.to)}
									>
										<ArrowRight className="w-3 h-3 text-success shrink-0" />
										<span className="text-foreground">
											{t.from} <ArrowRight className="w-3 h-3 inline" /> {t.to}
										</span>
										{t.guard && (
											<span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
												{t.guard}
											</span>
										)}
										<Button
											className="ml-auto shrink-0"
											onClick={() =>
												setGuardEditing(transitionKey(t.from, t.to))
											}
											size="sm"
											variant="ghost"
										>
											<ShieldCheck className="w-3 h-3 text-muted-foreground" />
										</Button>
										<Button
											className="shrink-0"
											onClick={() => handleRemoveTransition(t.from, t.to)}
											size="sm"
											variant="ghost"
										>
											<XCircle className="w-3 h-3 text-destructive" />
										</Button>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Guard editing popover */}
					{guardEditing && (
						<div className="p-4 border-t border-border space-y-2">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
								<ShieldCheck className="w-3 h-3" />
								Set Guard Condition
							</div>
							<div className="space-y-1">
								{(GUARD_OPTIONS[guardEditing] || ['no guard']).map(
									(option) => (
										<Button
											className="w-full justify-start text-sm"
											key={option}
											onClick={() => {
												const [from, to] = guardEditing.split('->') as [StateName, StateName];
												handleSetGuard(from, to, option);
											}}
											size="sm"
											variant="outline"
										>
											{option === 'no guard' ? (
												<span className="text-muted-foreground">No guard</span>
											) : (
												<span className="font-mono text-primary">{option}</span>
											)}
										</Button>
									),
								)}
							</div>
							<Button
								className="w-full"
								onClick={() => setGuardEditing(null)}
								size="sm"
								variant="ghost"
							>
								Cancel
							</Button>
						</div>
					)}

					<div className="p-4 border-t border-border">
						<Button
							className="w-full py-3"
							disabled={isTesting || transitions.length === 0}
							onClick={runTests}
							variant="secondary"
						>
							{isTesting ? 'Testing...' : 'Test Invalid Transitions'}
						</Button>
					</div>

					{testResults.length > 0 && (
						<div className="p-4 border-t border-border space-y-2">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Test Results
							</div>
							<div className="space-y-1.5 max-h-48 overflow-y-auto">
								{testResults.map((result) => (
									<div
										className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
											result.success
												? 'bg-success/10 text-success'
												: 'bg-destructive/10 text-destructive'
										}`}
										key={`${result.from}-${result.to}`}
									>
										{result.success ? (
											<CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
										) : (
											<XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
										)}
										<span className="font-mono">{result.message}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="State Machines"
					levelNumber={44}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background overflow-hidden">
					{/* Header hint */}
					<div className="flex items-center gap-2 px-6 py-3 bg-card/50 border-b border-border">
						<GitBranch className="w-4 h-4 text-primary" />
						<span className="text-sm text-muted-foreground">
							Click a state to start drawing, then click another state to create a transition.
							Invalid transitions are rejected.
						</span>
					</div>

					{/* State diagram SVG canvas */}
					<svg
						className="w-full h-full"
						viewBox="0 0 820 440"
						xmlns="http://www.w3.org/2000/svg"
					>
						<defs>
							<marker
								id="arrowhead-valid"
								fill="currentColor"
								markerHeight="7"
								markerUnits="strokeWidth"
								markerWidth="10"
								orient="auto"
								refX="5"
								refY="3.5"
								viewBox="0 0 10 7"
							>
								<polygon
									className="text-success"
									fill="currentColor"
									points="0 0, 10 3.5, 0 7"
								/>
							</marker>
							<marker
								id="arrowhead-rejected"
								fill="currentColor"
								markerHeight="7"
								markerUnits="strokeWidth"
								markerWidth="10"
								orient="auto"
								refX="5"
								refY="3.5"
								viewBox="0 0 10 7"
							>
								<polygon
									className="text-destructive"
									fill="currentColor"
									points="0 0, 10 3.5, 0 7"
								/>
							</marker>
						</defs>

						{/* Transition arrows */}
						{transitions.map((t) => {
							const fromNode = stateMap[t.from];
							const toNode = stateMap[t.to];
							if (!fromNode || !toNode) return null;
							const { d, labelX, labelY } = getArrowPath(fromNode, toNode);

							return (
								<g key={transitionKey(t.from, t.to)}>
									<path
										className="text-success"
										d={d}
										fill="none"
										markerEnd="url(#arrowhead-valid)"
										stroke="currentColor"
										strokeWidth="2"
									/>
									{t.guard && (
										<>
											<rect
												fill="hsl(var(--card))"
												height="18"
												rx="4"
												stroke="hsl(var(--primary))"
												strokeWidth="1"
												width={t.guard.length * 7 + 16}
												x={labelX - (t.guard.length * 7 + 16) / 2}
												y={labelY - 9}
											/>
											<text
												className="text-primary"
												dominantBaseline="central"
												fill="currentColor"
												fontSize="10"
												textAnchor="middle"
												x={labelX}
												y={labelY}
											>
												{t.guard}
											</text>
										</>
									)}
								</g>
							);
						})}

						{/* Rejected arrow animation */}
						{rejectedArrow && (() => {
							const fromNode = stateMap[rejectedArrow.from];
							const toNode = stateMap[rejectedArrow.to];
							if (!fromNode || !toNode) return null;
							const { d, labelX, labelY } = getArrowPath(fromNode, toNode);
							return (
								<g className="animate-pulse">
									<path
										className="text-destructive"
										d={d}
										fill="none"
										markerEnd="url(#arrowhead-rejected)"
										opacity="0.8"
										stroke="currentColor"
										strokeDasharray="6 3"
										strokeWidth="2.5"
									/>
									<text
										className="text-destructive"
										dominantBaseline="central"
										fill="currentColor"
										fontSize="11"
										fontWeight="bold"
										textAnchor="middle"
										x={labelX}
										y={labelY - 12}
									>
										INVALID
									</text>
									<text
										className="text-destructive"
										dominantBaseline="central"
										fill="currentColor"
										fontSize="9"
										textAnchor="middle"
										x={labelX}
										y={labelY + 4}
									>
										AASM::InvalidTransition
									</text>
								</g>
							);
						})()}

						{/* State nodes */}
						{STATES.map((state) => {
							const isActive = drawingFrom === state.id;
							const isDrawTarget = drawingFrom !== null && drawingFrom !== state.id;

							return (
								<g
									className="cursor-pointer"
									key={state.id}
									onClick={() => handleStateClick(state.id)}
								>
									{/* Outer ring for initial state */}
									{state.isInitial && (
										<circle
											className="text-warning"
											cx={state.x}
											cy={state.y}
											fill="none"
											r="48"
											stroke="currentColor"
											strokeDasharray="4 2"
											strokeWidth="1.5"
										/>
									)}

									{/* Double ring for final states */}
									{state.isFinal && (
										<circle
											className={
												state.id === 'cancelled'
													? 'text-destructive'
													: 'text-success'
											}
											cx={state.x}
											cy={state.y}
											fill="none"
											r="48"
											stroke="currentColor"
											strokeWidth="1.5"
										/>
									)}

									{/* Main circle */}
									<circle
										className={`transition-all ${
											isActive
												? 'text-primary'
												: isDrawTarget
													? 'text-muted-foreground'
													: STATE_COLORS[state.id].includes('warning')
														? 'text-warning'
														: STATE_COLORS[state.id].includes('primary')
															? 'text-primary'
															: STATE_COLORS[state.id].includes('info')
																? 'text-blue-500'
																: STATE_COLORS[state.id].includes('success')
																	? 'text-success'
																	: 'text-destructive'
										}`}
										cx={state.x}
										cy={state.y}
										fill={isActive ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--card))'}
										r="42"
										stroke="currentColor"
										strokeWidth={isActive ? 3 : 2}
									/>

									{/* Pulsing ring when this is the drawing source */}
									{isActive && (
										<circle
											className="text-primary animate-ping"
											cx={state.x}
											cy={state.y}
											fill="none"
											opacity="0.3"
											r="42"
											stroke="currentColor"
											strokeWidth="2"
										/>
									)}

									{/* Hover highlight for draw targets */}
									{isDrawTarget && (
										<circle
											className="text-muted-foreground"
											cx={state.x}
											cy={state.y}
											fill="none"
											opacity="0.3"
											r="42"
											stroke="currentColor"
											strokeDasharray="4 2"
											strokeWidth="1.5"
										/>
									)}

									{/* State label */}
									<text
										className={`select-none font-medium ${
											isActive ? 'text-primary' : 'text-foreground'
										}`}
										dominantBaseline="central"
										fill="currentColor"
										fontSize="13"
										textAnchor="middle"
										x={state.x}
										y={state.y - 4}
									>
										{state.label}
									</text>

									{/* Status tag */}
									<text
										className={`select-none ${
											state.isInitial
												? 'text-warning'
												: state.isFinal
													? state.id === 'cancelled'
														? 'text-destructive'
														: 'text-success'
													: 'text-muted-foreground'
										}`}
										dominantBaseline="central"
										fill="currentColor"
										fontSize="9"
										textAnchor="middle"
										x={state.x}
										y={state.y + 14}
									>
										{state.isInitial
											? 'initial'
											: state.isFinal
												? 'final'
												: 'state'}
									</text>
								</g>
							);
						})}
					</svg>

					{/* Rejection overlay notification */}
					{rejectedArrow && (
						<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-bounce">
							<XCircle className="w-5 h-5" />
							<span className="font-medium">
								Cannot transition from {rejectedArrow.from} to {rejectedArrow.to}!
							</span>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/order.rb',
							language: 'ruby',
							code: generateCode(),
							highlight: [2, 5, 6],
						},
					]}
					learningGoal="AASM (Acts As State Machine) enforces valid state transitions in Rails models. Guards prevent invalid transitions and keep your domain logic consistent."
				>
					{/* Valid transitions reference */}
					<div className="mt-4 p-4 rounded-lg bg-secondary">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
							<ShieldCheck className="w-3 h-3" />
							Valid Transitions
						</div>
						<div className="space-y-1.5">
							{Object.entries(VALID_TRANSITIONS).map(([key, guard]) => {
								const [from, to] = key.split('->');
								const defined = hasTransition(from as StateName, to as StateName);
								return (
									<div
										className={`flex items-center gap-2 text-xs ${
											defined ? 'text-success' : 'text-muted-foreground'
										}`}
										key={key}
									>
										{defined ? (
											<CheckCircle className="w-3 h-3 shrink-0" />
										) : (
											<Circle className="w-3 h-3 shrink-0" />
										)}
										<span className="font-mono">
											{from} {'->'} {to}
										</span>
										{guard && (
											<span className="text-primary/70 ml-auto">
												{guard}
											</span>
										)}
									</div>
								);
							})}
						</div>
					</div>

					{/* Forbidden transitions reference */}
					<div className="mt-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
						<div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-3 flex items-center gap-1.5">
							<XCircle className="w-3 h-3" />
							Forbidden Transitions
						</div>
						<div className="space-y-1.5">
							{[
								'shipped -> pending',
								'delivered -> cancelled',
								'delivered -> pending',
								'cancelled -> confirmed',
							].map((label) => (
								<div
									className="flex items-center gap-2 text-xs text-destructive/70"
									key={label}
								>
									<XCircle className="w-3 h-3 shrink-0" />
									<span className="font-mono">{label}</span>
								</div>
							))}
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level44StateMachines;
