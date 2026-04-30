/**
 * Level Layout Component
 *
 * Three-panel resizable layout wrapper for all level components.
 * Left: Instructions, Center: Canvas, Right: Code Preview
 */

import type { ReactNode } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

interface LevelLayoutProps {
	children: ReactNode;
}

export function LevelLayout({ children }: LevelLayoutProps) {
	return (
		<Group
			className="h-full bg-background"
			id="level-panels"
			orientation="horizontal"
		>
			{children}
		</Group>
	);
}

interface LeftPanelProps {
	children: ReactNode;
}

export function LeftPanel({ children }: LeftPanelProps) {
	return (
		<>
			<Panel defaultSize="18%" id="left" maxSize="30%" minSize="10%">
				<div className="h-full bg-card border-r border-border flex flex-col overflow-hidden">
					{children}
				</div>
			</Panel>
			<Separator className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />
		</>
	);
}

interface CenterPanelProps {
	children: ReactNode;
}

export function CenterPanel({ children }: CenterPanelProps) {
	return (
		<Panel id="center" minSize="30%">
			<div className="h-full flex flex-col overflow-hidden">{children}</div>
		</Panel>
	);
}

interface RightPanelProps {
	children: ReactNode;
}

export function RightPanel({ children }: RightPanelProps) {
	return (
		<>
			<Separator className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />
			<Panel defaultSize="22%" id="right" maxSize="35%" minSize="12%">
				<div className="h-full bg-card border-l border-border flex flex-col overflow-hidden">
					{children}
				</div>
			</Panel>
		</>
	);
}

export default LevelLayout;
