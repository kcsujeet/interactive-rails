/**
 * Instruction Panel Component
 *
 * Left panel with scenario, instructions, and goals.
 */

import type { ReactNode } from 'react';

interface InstructionPanelProps {
	scenario: string;
	instructions: string[];
	goal?: string;
	children?: ReactNode; // For palette or additional content
}

export function InstructionPanel({
	scenario,
	instructions,
	goal,
	children,
}: InstructionPanelProps) {
	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Scenario */}
			<div className="p-4 border-b border-border">
				<div className="flex items-center gap-2 text-warning text-sm font-medium mb-2">
					<span>!</span>
					<span>Scenario</span>
				</div>
				<p className="text-sm text-muted-foreground leading-relaxed">
					{scenario}
				</p>
			</div>

			{/* Instructions */}
			<div className="p-4 border-b border-border">
				<h3 className="text-sm font-semibold text-foreground mb-3">
					Instructions
				</h3>
				<ol className="space-y-2 text-sm text-muted-foreground">
					{instructions.map((instruction, index) => (
						<li className="flex gap-2" key={index}>
							<span className="text-primary font-medium">{index + 1}.</span>
							<span>{instruction}</span>
						</li>
					))}
				</ol>
			</div>

			{/* Goal */}
			{goal && (
				<div className="p-4 border-b border-border">
					<div className="flex items-center gap-2 text-success text-sm font-medium mb-2">
						<span>*</span>
						<span>Goal</span>
					</div>
					<p className="text-sm text-muted-foreground">{goal}</p>
				</div>
			)}

			{/* Additional content (palette, etc.) */}
			{children && <div className="flex-1 overflow-y-auto">{children}</div>}
		</div>
	);
}

export default InstructionPanel;
