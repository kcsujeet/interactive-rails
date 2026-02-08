/**
 * Level Help Context
 *
 * Allows InstructionPanel to provide scenario/instructions data
 * that HelpDialog can read, without coupling the two components.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

interface LevelHelpData {
	scenario?: string;
	instructions?: string[];
}

interface LevelHelpContextValue extends LevelHelpData {
	setHelp: (data: LevelHelpData) => void;
}

const LevelHelpContext = createContext<LevelHelpContextValue>({
	setHelp: () => {},
});

export function LevelHelpProvider({ children }: { children: ReactNode }) {
	const [helpData, setHelpData] = useState<LevelHelpData>({});

	return (
		<LevelHelpContext.Provider
			value={{ ...helpData, setHelp: setHelpData }}
		>
			{children}
		</LevelHelpContext.Provider>
	);
}

export function useLevelHelp() {
	return useContext(LevelHelpContext);
}
