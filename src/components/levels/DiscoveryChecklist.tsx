/**
 * DiscoveryChecklist Component
 *
 * Left panel component showing exploration progress during the observe phase.
 * Each discovery appears as a pill: dimmed when hidden, bright when discovered.
 * Matches StepProgress visual language for consistency.
 */

import { Check, Eye, Search } from 'lucide-react';

import type { Discovery } from '@/hooks/useDiscoveryGating';

interface DiscoveryChecklistProps {
	discoveries: Discovery[];
	discoveredCount: number;
	minRequired: number;
}

export function DiscoveryChecklist({
	discoveries,
	discoveredCount,
	minRequired,
}: DiscoveryChecklistProps) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					Discoveries
				</div>
				<div className="text-xs text-muted-foreground">
					{discoveredCount} of {minRequired} required
				</div>
			</div>

			{/* Progress bar */}
			<div className="h-1.5 bg-secondary rounded-full overflow-hidden">
				<div
					className="h-full bg-primary rounded-full transition-all duration-500"
					style={{
						width: `${Math.min(100, (discoveredCount / minRequired) * 100)}%`,
					}}
				/>
			</div>

			{/* Discovery list */}
			<div className="space-y-1">
				{discoveries.map((discovery) => {
					const isFound = discovery.status === 'discovered';

					return (
						<div
							className={`flex items-start gap-3 py-1.5 transition-all duration-300 ${
								isFound ? 'opacity-100' : 'opacity-50'
							}`}
							key={discovery.id}
						>
							{/* Icon */}
							<div className="shrink-0 mt-0.5">
								{isFound ? (
									<div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
										<Check className="w-3 h-3 text-primary-foreground" />
									</div>
								) : (
									<div className="w-5 h-5 rounded-full border border-border flex items-center justify-center">
										<Search className="w-3 h-3 text-muted-foreground" />
									</div>
								)}
							</div>

							{/* Label */}
							<span
								className={`text-sm leading-tight ${
									isFound
										? 'text-foreground font-medium'
										: 'text-muted-foreground'
								}`}
							>
								{discovery.label}
							</span>

							{/* Eye icon for newly discovered */}
							{isFound && (
								<Eye className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5 ml-auto" />
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
