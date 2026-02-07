/**
 * Level 1: The Stack Choice
 *
 * Custom UI for Level 1 - different from the regular pipeline canvas.
 * Features slots for database and frontend choices with live code preview.
 */

import { useState, type ReactNode } from 'react';
import { Button } from './ui/Button';
import type { GameChoices } from '@/types/game';
import {
	Lightbulb,
	Database,
	Feather,
	Zap,
	Atom,
	Cog,
	AlertTriangle,
	Hexagon,
} from 'lucide-react';

interface Level1StackChoiceProps {
	onComplete: (choices: GameChoices) => void;
	onExit: () => void;
}

type DatabaseChoice = 'postgresql' | 'sqlite' | null;
type FrontendChoice = 'react' | 'hotwire' | null;

export function Level1StackChoice({
	onComplete,
	onExit,
}: Level1StackChoiceProps) {
	const [database, setDatabase] = useState<DatabaseChoice>(null);
	const [frontend, setFrontend] = useState<FrontendChoice>(null);
	const [dragOverSlot, setDragOverSlot] = useState<
		'database' | 'frontend' | null
	>(null);

	const canGenerate = database !== null && frontend !== null;

	function handleDragStart(e: React.DragEvent, type: string) {
		e.dataTransfer.setData('nodeType', type);
	}

	function handleDragOver(e: React.DragEvent) {
		e.preventDefault();
	}

	function handleDropDatabase(e: React.DragEvent) {
		e.preventDefault();
		const nodeType = e.dataTransfer.getData('nodeType');
		if (nodeType === 'postgresql' || nodeType === 'sqlite') {
			setDatabase(nodeType);
		}
		setDragOverSlot(null);
	}

	function handleDropFrontend(e: React.DragEvent) {
		e.preventDefault();
		const nodeType = e.dataTransfer.getData('nodeType');
		if (nodeType === 'react' || nodeType === 'hotwire') {
			setFrontend(nodeType);
		}
		setDragOverSlot(null);
	}

	function handleGenerate() {
		if (!canGenerate) return;

		const choices: GameChoices = {
			database,
			frontend,
			constraints: {
				apiOnly: frontend === 'react',
				canShard: database === 'postgresql',
			},
		};

		// Persist choices to localStorage for future levels
		try {
			localStorage.setItem(
				'rails-expert-game-choices',
				JSON.stringify(choices),
			);
		} catch (e) {
			console.error('Failed to save game choices:', e);
		}

		onComplete(choices);
	}

	function clearDatabase() {
		setDatabase(null);
	}

	function clearFrontend() {
		setFrontend(null);
	}

	// Generate the rails command based on choices
	function getRailsCommand(): string {
		let cmd = 'rails new myapp';
		if (database) {
			cmd += ` \\\n  --database=${database}`;
		}
		if (frontend === 'react') {
			cmd += ' \\\n  --api';
		}
		return cmd;
	}

	return (
		<div className="h-full flex bg-background">
			{/* Left Panel - Scenario & Instructions & Palette */}
			<div className="w-72 bg-card border-r border-border flex flex-col">
				{/* Scenario */}
				<div className="p-4 border-b border-border">
					<div className="flex items-center gap-2 text-warning text-sm font-medium mb-2">
						<Lightbulb className="w-4 h-4" />
						<span>Scenario</span>
					</div>
					<p className="text-sm text-foreground leading-relaxed">
						Day 1. You are initializing the repository. Your architectural
						choices today will determine your scaling limits in Act IV.
					</p>
				</div>

				{/* Instructions */}
				<div className="p-4 border-b border-border">
					<h3 className="text-sm font-semibold text-foreground mb-3">
						Instructions
					</h3>
					<ol className="space-y-2 text-sm text-muted-foreground">
						<li className="flex gap-2">
							<span className="text-primary">1.</span>
							<span>Drag a Database System to the Database slot</span>
						</li>
						<li className="flex gap-2">
							<span className="text-primary">2.</span>
							<span>Drag a Frontend Architecture to the Frontend slot</span>
						</li>
						<li className="flex gap-2">
							<span className="text-primary">3.</span>
							<span>
								Click 'Generate App' to initialize your Rails application
							</span>
						</li>
					</ol>
				</div>

				{/* Component Palette */}
				<div className="flex-1 p-4 overflow-y-auto">
					<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
						Component Palette
					</h3>

					{/* Databases */}
					<div className="mb-4">
						<h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
							Databases
						</h4>
						<div className="space-y-2">
							<PaletteItem
								color="#336791"
								description="Production-ready relational database"
								disabled={database === 'postgresql'}
								icon={<Database className="w-5 h-5" />}
								name="PostgreSQL"
								onDragStart={handleDragStart}
								type="postgresql"
							/>
							<PaletteItem
								color="#003b57"
								description="Simple file-based database"
								disabled={database === 'sqlite'}
								icon={<Feather className="w-5 h-5" />}
								name="SQLite"
								onDragStart={handleDragStart}
								type="sqlite"
								warning="Cannot support Sharding (Level 22)"
							/>
						</div>
					</div>

					{/* Frontend */}
					<div>
						<h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
							Frontend
						</h4>
						<div className="space-y-2">
							<PaletteItem
								benefit="Monolithic, fast development"
								color="#ff6b6b"
								description="Rails-native frontend with Turbo"
								disabled={frontend === 'hotwire'}
								icon={<Zap className="w-5 h-5" />}
								name="Hotwire/ERB"
								onDragStart={handleDragStart}
								type="hotwire"
							/>
							<PaletteItem
								color="#61dafb"
								description="Modern SPA with API backend"
								disabled={frontend === 'react'}
								icon={<Atom className="w-5 h-5" />}
								name="React"
								onDragStart={handleDragStart}
								type="react"
								warning="Requires separate API layer"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Center - Architecture Canvas */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<div className="h-14 border-b border-border flex items-center justify-between px-6">
					<Button onClick={onExit} size="sm" variant="ghost">
						← Levels
					</Button>
					<div className="text-center">
						<div className="text-xs text-primary font-medium">LEVEL 1</div>
						<div className="text-lg font-bold text-foreground">
							The Stack Choice
						</div>
					</div>
					<Button
						onClick={() => {
							setDatabase(null);
							setFrontend(null);
						}}
						size="sm"
						variant="ghost"
					>
						↺ Reset
					</Button>
				</div>

				{/* Canvas */}
				<div className="flex-1 flex items-center justify-center p-8">
					<div className="w-full max-w-2xl">
						<h3 className="text-center text-sm font-medium text-muted-foreground mb-8">
							Architecture Canvas
						</h3>

						{/* Terminal Node */}
						<div className="flex justify-center mb-8">
							<div className="bg-linear-to-br from-primary/30 to-primary/10 border border-primary/50 rounded-lg px-8 py-4 shadow-lg shadow-primary/20">
								<div className="flex items-center gap-3">
									<span className="text-2xl">{'>'}_</span>
									<div>
										<div className="text-primary font-semibold">Terminal</div>
										<div className="text-primary/70 text-sm font-mono">
											$ rails new
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Connection Lines */}
						<div className="flex justify-center mb-4">
							<svg className="text-primary/30" height="40" width="200">
								<path
									d="M 100 0 L 50 40"
									fill="none"
									stroke="currentColor"
									strokeDasharray="4"
									strokeWidth="2"
								/>
								<path
									d="M 100 0 L 150 40"
									fill="none"
									stroke="currentColor"
									strokeDasharray="4"
									strokeWidth="2"
								/>
							</svg>
						</div>

						{/* Slots */}
						<div className="flex justify-center gap-8 mb-8">
							{/* Database Slot */}
							<Slot
								filled={database}
								filledInfo={database ? getDatabaseInfo(database) : null}
								isDragOver={dragOverSlot === 'database'}
								label="Database System"
								onClear={clearDatabase}
								onDragEnter={() => setDragOverSlot('database')}
								onDragLeave={() => setDragOverSlot(null)}
								onDragOver={handleDragOver}
								onDrop={handleDropDatabase}
								sublabel="DATABASE SYSTEM"
							/>

							{/* Frontend Slot */}
							<Slot
								filled={frontend}
								filledInfo={frontend ? getFrontendInfo(frontend) : null}
								isDragOver={dragOverSlot === 'frontend'}
								label="Frontend Architecture"
								onClear={clearFrontend}
								onDragEnter={() => setDragOverSlot('frontend')}
								onDragLeave={() => setDragOverSlot(null)}
								onDragOver={handleDragOver}
								onDrop={handleDropFrontend}
								sublabel="Choose your UI approach"
							/>
						</div>

						{/* Generate Button */}
						<div className="flex justify-center">
							<Button
								className={canGenerate ? 'shadow-lg shadow-primary/30' : ''}
								disabled={!canGenerate}
								onClick={handleGenerate}
								size="lg"
							>
								<Cog className="w-5 h-5" />
								<span>GENERATE APP</span>
							</Button>
							{!canGenerate && (
								<div className="absolute mt-14 text-xs text-muted-foreground">
									Fill all slots to generate
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Right Panel - Code Preview & Learning */}
			<div className="w-80 bg-card border-l border-border flex flex-col">
				{/* Generated Code */}
				<div className="p-4 border-b border-border">
					<h3 className="text-sm font-semibold text-foreground mb-3">
						Generated Rails Code
					</h3>
					<div className="bg-background rounded-lg p-4 border border-border">
						<div className="flex items-center gap-2 mb-3">
							<div className="w-3 h-3 rounded-full bg-destructive" />
							<div className="w-3 h-3 rounded-full bg-warning" />
							<div className="w-3 h-3 rounded-full bg-success" />
							<span className="text-xs text-muted-foreground ml-2">
								rails_generator.sh
							</span>
						</div>
						<pre className="text-sm font-mono">
							<span className="text-muted-foreground">
								# Your generated command:
							</span>
							{'\n'}
							<span className="text-primary">rails new</span>
							<span className="text-foreground"> myapp</span>
							{database && (
								<>
									{' \\\n  '}
									<span className="text-muted-foreground">--database=</span>
									<span className="text-success">{database}</span>
								</>
							)}
							{frontend === 'react' && (
								<>
									{' \\\n  '}
									<span className="text-warning">--api</span>
								</>
							)}
							{!database && !frontend && (
								<>
									{' \\\n  '}
									<span className="text-muted">{'<options>'}</span>
								</>
							)}
						</pre>
					</div>
				</div>

				{/* Learning Goal */}
				<div className="p-4">
					<div className="text-xs font-semibold text-success uppercase tracking-wider mb-2">
						Learning Goal
					</div>
					<p className="text-sm text-foreground">
						Understanding rails new flags and database trade-offs.
					</p>
				</div>

				{/* Trade-offs Info */}
				{(database || frontend) && (
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-warning uppercase tracking-wider mb-2">
							Your Choices
						</div>
						<div className="space-y-2 text-sm">
							{database === 'postgresql' && (
								<div className="text-foreground">
									✓ <span className="text-success">PostgreSQL</span> - Can scale
									to sharding in Act IV
								</div>
							)}
							{database === 'sqlite' && (
								<div className="text-foreground">
									⚠ <span className="text-warning">SQLite</span> - Cannot shard
									(Level 22 blocked)
								</div>
							)}
							{frontend === 'hotwire' && (
								<div className="text-foreground">
									✓ <span className="text-success">Hotwire</span> - Monolithic,
									simpler architecture
								</div>
							)}
							{frontend === 'react' && (
								<div className="text-foreground">
									⚠ <span className="text-warning">React</span> - Requires
									API-only mode
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// Helper components

interface PaletteItemProps {
	type: string;
	name: string;
	description: string;
	color: string;
	icon: ReactNode;
	warning?: string;
	benefit?: string;
	disabled?: boolean;
	onDragStart: (e: React.DragEvent, type: string) => void;
}

function PaletteItem({
	type,
	name,
	description,
	color,
	icon,
	warning,
	benefit,
	disabled,
	onDragStart,
}: PaletteItemProps) {
	return (
		<div
			className={`
        p-3 rounded-lg border transition-all
        ${
					disabled
						? 'bg-secondary/50 border-border opacity-50 cursor-not-allowed'
						: 'bg-secondary border-border hover:border-primary cursor-grab active:cursor-grabbing'
				}
      `}
			draggable={!disabled}
			onDragStart={(e) => onDragStart(e, type)}
			style={{ borderLeftColor: color, borderLeftWidth: 4 }}
		>
			<div className="flex items-start justify-between mb-1">
				<div className="flex items-center gap-2" style={{ color }}>
					{icon}
					<span className="font-medium text-foreground">{name}</span>
				</div>
				<span className="text-xs text-muted-foreground uppercase">
					{type.includes('sql') ? 'DATABASE' : 'FRONTEND'}
				</span>
			</div>
			<p className="text-xs text-muted-foreground mb-1">{description}</p>
			{warning && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {warning}</p>}
			{benefit && <p className="text-xs text-success flex items-center gap-1"><Zap className="w-3 h-3" /> {benefit}</p>}
		</div>
	);
}

interface SlotProps {
	label: string;
	sublabel: string;
	filled: string | null;
	filledInfo: {
		name: string;
		description: string;
		icon: ReactNode;
		color: string;
	} | null;
	onDrop: (e: React.DragEvent) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDragEnter: () => void;
	onDragLeave: () => void;
	isDragOver: boolean;
	onClear: () => void;
}

function Slot({
	label,
	sublabel,
	filled,
	filledInfo,
	onDrop,
	onDragOver,
	onDragEnter,
	onDragLeave,
	isDragOver,
	onClear,
}: SlotProps) {
	if (filled && filledInfo) {
		return (
			<div className="relative">
				<Button
					className="absolute -top-2 -right-2 w-5 h-5 bg-secondary hover:bg-muted rounded-full text-muted-foreground hover:text-foreground text-xs z-10"
					onClick={onClear}
					size="icon"
					variant="ghost"
				>
					×
				</Button>
				<div
					className="w-56 p-4 rounded-lg border-2 transition-all"
					style={{
						borderColor: filledInfo.color,
						backgroundColor: `${filledInfo.color}15`,
					}}
				>
					<div className="flex items-center gap-3 mb-2">
						<span style={{ color: filledInfo.color }}>{filledInfo.icon}</span>
						<div>
							<div className="font-semibold text-foreground">
								{filledInfo.name}
							</div>
							<div className="text-xs text-muted-foreground">
								{filledInfo.description}
							</div>
						</div>
					</div>
					<div className="text-xs text-muted-foreground uppercase tracking-wider">
						{sublabel}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`
        w-56 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all
        ${
					isDragOver
						? 'border-primary bg-primary/10 scale-105'
						: 'border-border bg-card/50 hover:border-muted-foreground'
				}
      `}
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
			<Hexagon className="w-8 h-8 text-muted mb-2" />
			<div className="text-sm font-medium text-muted-foreground">{label}</div>
			<div className="text-xs text-muted">{sublabel}</div>
			<div className="text-xs text-primary mt-2">Drag & drop here</div>
		</div>
	);
}

// Helper functions
function getDatabaseInfo(db: DatabaseChoice) {
	if (db === 'postgresql') {
		return {
			name: 'PostgreSQL',
			description: 'Production-ready relational database',
			icon: <Database className="w-6 h-6" />,
			color: '#336791',
		};
	}
	if (db === 'sqlite') {
		return {
			name: 'SQLite',
			description: 'Simple file-based database',
			icon: <Feather className="w-6 h-6" />,
			color: '#003b57',
		};
	}
	return null;
}

function getFrontendInfo(fe: FrontendChoice) {
	if (fe === 'hotwire') {
		return {
			name: 'Hotwire/ERB',
			description: 'Rails-native frontend with Turbo',
			icon: <Zap className="w-6 h-6" />,
			color: '#ff6b6b',
		};
	}
	if (fe === 'react') {
		return {
			name: 'React',
			description: 'Modern SPA with API backend',
			icon: <Atom className="w-6 h-6" />,
			color: '#61dafb',
		};
	}
	return null;
}

export default Level1StackChoice;
