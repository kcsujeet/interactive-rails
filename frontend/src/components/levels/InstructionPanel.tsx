/**
 * Instruction Panel Component
 *
 * Passes scenario/instructions to the HelpDialog via context.
 * Renders only children (node palette, etc.) in the left panel.
 */

import { useEffect, type ReactNode } from 'react';
import { useLevelHelp } from './LevelHelpContext';

interface InstructionPanelProps {
	scenario: string;
	instructions: string[];
	goal?: string;
	children?: ReactNode;
}

export function InstructionPanel({
	scenario,
	instructions,
	children,
}: InstructionPanelProps) {
	const { setHelp } = useLevelHelp();

	useEffect(() => {
		setHelp({ scenario, instructions });
	}, [scenario, instructions, setHelp]);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{children && <div className="flex-1 overflow-y-auto">{children}</div>}
		</div>
	);
}

export default InstructionPanel;
