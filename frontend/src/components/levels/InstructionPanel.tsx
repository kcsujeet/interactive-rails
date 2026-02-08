/**
 * Instruction Panel Component
 *
 * Simple wrapper for the left panel content in custom levels.
 * Scenario/instructions are now shown via the Help dialog in the header.
 */

import type { ReactNode } from 'react';

interface InstructionPanelProps {
	scenario?: string;
	instructions?: string[];
	goal?: string;
	children?: ReactNode;
}

export function InstructionPanel({ children }: InstructionPanelProps) {
	return (
		<div className="flex flex-col h-full overflow-hidden">
			{children && <div className="flex-1 overflow-y-auto">{children}</div>}
		</div>
	);
}

export default InstructionPanel;
