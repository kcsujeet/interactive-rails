/**
 * ScenarioCards Component
 *
 * Card-based discovery mechanism for refactoring levels where the problem
 * is visible in the code structure, not in runtime behavior. Replaces
 * ProbeTerminal (which fires HTTP requests) for levels where the player
 * should discover pain points through realistic developer scenarios.
 *
 * Each card presents a situation (e.g., "Fix a bug in tagging code")
 * that reveals WHY the current code structure is painful to maintain.
 */

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export interface ScenarioConfig {
	id: string;
	title: string;
	consequence: string;
}

interface ScenarioCardsProps {
	scenarios: ScenarioConfig[];
	onSelect: (scenarioId: string) => void;
	disabled?: boolean;
	title?: string;
}

export function ScenarioCards({
	scenarios,
	onSelect,
	disabled = false,
	title = 'What happens when...',
}: ScenarioCardsProps) {
	return (
		<div className="rounded-lg border border-border bg-card overflow-hidden">
			<div className="px-3 py-2 border-b border-border bg-muted/30">
				<span className="text-xs font-medium text-muted-foreground">
					{title}
				</span>
			</div>
			<div className="p-3 flex flex-wrap gap-2">
				{scenarios.map((scenario) => (
					<ScenarioCardButton
						key={scenario.id}
						scenario={scenario}
						disabled={disabled}
						onSelect={onSelect}
					/>
				))}
			</div>
		</div>
	);
}

function ScenarioCardButton({
	scenario,
	disabled,
	onSelect,
}: {
	scenario: ScenarioConfig;
	disabled: boolean;
	onSelect: (id: string) => void;
}) {
	const [fired, setFired] = useState(false);
	const [showConsequence, setShowConsequence] = useState(false);

	const handleClick = () => {
		if (fired || disabled) return;
		setFired(true);
		onSelect(scenario.id);
		// Show consequence after a brief delay for the flow animation to start
		setTimeout(() => setShowConsequence(true), 400);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={fired || disabled}
			className={`text-left border rounded-md px-3 py-2 transition-all duration-300 ${
				fired
					? 'border-destructive/30 bg-destructive/5 dark:bg-destructive/10'
					: 'border-border bg-background hover:ring-2 hover:ring-ring/30 cursor-pointer'
			} ${disabled && !fired ? 'opacity-50 cursor-not-allowed' : ''}`}
		>
			<div className="flex items-start gap-2">
				{fired ? (
					<AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
				) : (
					<span className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
				)}
				<div>
					<div className="text-sm font-medium text-foreground">
						{scenario.title}
					</div>
					{showConsequence && (
						<div className="text-xs text-destructive mt-1 animate-in fade-in duration-300">
							{scenario.consequence}
						</div>
					)}
				</div>
			</div>
		</button>
	);
}
