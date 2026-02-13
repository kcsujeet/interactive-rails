/**
 * Step Progress Component
 *
 * Vertical stepper showing step progression.
 * Lock icon (locked), pulsing dot (active), check (completed).
 */

import { Check, Lock } from 'lucide-react';
import type { Step } from '@/hooks/useStepGating';

interface StepProgressProps {
	steps: Step[];
}

export function StepProgress({ steps }: StepProgressProps) {
	return (
		<div className="space-y-1">
			{steps.map((step, i) => (
				<div className="flex items-start gap-3" key={step.id}>
					{/* Icon + connector line */}
					<div className="flex flex-col items-center">
						<StepIcon status={step.status} />
						{i < steps.length - 1 && (
							<div
								className={`w-px h-5 mt-1 ${
									step.status === 'completed'
										? 'bg-primary'
										: 'bg-border'
								}`}
							/>
						)}
					</div>

					{/* Label */}
					<div className="pt-0.5">
						<div
							className={`text-sm leading-tight ${
								step.status === 'completed'
									? 'text-primary font-medium'
									: step.status === 'active'
										? 'text-foreground font-medium'
										: 'text-muted-foreground'
							}`}
						>
							{step.title}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

function StepIcon({ status }: { status: Step['status'] }) {
	if (status === 'completed') {
		return (
			<div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
				<Check className="w-3.5 h-3.5 text-primary-foreground" />
			</div>
		);
	}

	if (status === 'active') {
		return (
			<div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
				<div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
			</div>
		);
	}

	return (
		<div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
			<Lock className="w-3 h-3 text-muted-foreground" />
		</div>
	);
}

export default StepProgress;
