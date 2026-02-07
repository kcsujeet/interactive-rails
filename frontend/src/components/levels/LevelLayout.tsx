/**
 * Level Layout Component
 *
 * Three-panel layout wrapper for all level components.
 * Left: Instructions, Center: Canvas, Right: Code Preview
 */

import type { ReactNode } from 'react';

interface LevelLayoutProps {
	children: ReactNode;
}

export function LevelLayout({ children }: LevelLayoutProps) {
	return <div className="h-full flex bg-background">{children}</div>;
}

interface LeftPanelProps {
	children: ReactNode;
}

export function LeftPanel({ children }: LeftPanelProps) {
	return (
		<div className="w-72 bg-card border-r border-border flex flex-col overflow-hidden">
			{children}
		</div>
	);
}

interface CenterPanelProps {
	children: ReactNode;
}

export function CenterPanel({ children }: CenterPanelProps) {
	return <div className="flex-1 flex flex-col overflow-hidden">{children}</div>;
}

interface RightPanelProps {
	children: ReactNode;
	width?: string;
}

export function RightPanel({ children, width = 'w-80' }: RightPanelProps) {
	return (
		<div
			className={`${width} bg-card border-l border-border flex flex-col overflow-hidden`}
		>
			{children}
		</div>
	);
}

export default LevelLayout;
