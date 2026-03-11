/**
 * Simulated Terminal Component
 *
 * Clickable command buttons with animated line-by-line output.
 * Dark background, monospace font, colored output, auto-scroll.
 */

import { Terminal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

export interface TerminalCommand {
	id: string;
	label: string;
	command: string;
	correct: boolean;
	feedback?: string;
}

export interface TerminalOutputLine {
	text: string;
	color?: 'default' | 'green' | 'yellow' | 'red' | 'cyan' | 'muted';
}

export interface TerminalHistoryEntry {
	command: string;
	output: TerminalOutputLine[];
	isError: boolean;
}

interface SimulatedTerminalProps {
	commands: TerminalCommand[];
	onCorrect: () => void;
	onWrong: (feedback: string) => void;
	prompt?: string;
	/** Label shown in the terminal header bar */
	title?: string;
	outputLines?: TerminalOutputLine[];
	disabled?: boolean;
	completed?: boolean;
	/** Pre-populated history from previous steps */
	initialHistory?: TerminalHistoryEntry[];
}

export function SimulatedTerminal({
	commands,
	onCorrect,
	onWrong,
	prompt = '$',
	title = 'Terminal',
	outputLines,
	disabled = false,
	completed = false,
	initialHistory = [],
}: SimulatedTerminalProps) {
	const [history, setHistory] =
		useState<TerminalHistoryEntry[]>(initialHistory);
	const [animating, setAnimating] = useState(false);
	const [visibleLines, setVisibleLines] = useState(0);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [history, visibleLines]);

	// Animate output lines when outputLines change
	useEffect(() => {
		if (outputLines && outputLines.length > 0 && animating) {
			setVisibleLines(0);
			let lineIndex = 0;
			const interval = setInterval(() => {
				lineIndex++;
				setVisibleLines(lineIndex);
				if (lineIndex >= outputLines.length) {
					clearInterval(interval);
					setAnimating(false);
				}
			}, 60);
			return () => clearInterval(interval);
		}
	}, [outputLines, animating]);

	const handleCommand = (cmd: TerminalCommand) => {
		if (disabled || animating || completed) return;

		if (cmd.correct) {
			const output = outputLines || [
				{ text: 'Command executed successfully.', color: 'green' as const },
			];
			setHistory((prev) => [
				...prev,
				{ command: cmd.command, output, isError: false },
			]);
			setAnimating(true);

			// Delay onCorrect until animation finishes
			const delay = (output.length + 1) * 60 + 200;
			setTimeout(() => onCorrect(), delay);
		} else {
			const feedback = cmd.feedback || 'Not quite right. Try another command.';
			setHistory((prev) => [
				...prev,
				{
					command: cmd.command,
					output: [{ text: feedback, color: 'red' as const }],
					isError: true,
				},
			]);
			onWrong(feedback);
		}
	};

	const colorClass = (color?: TerminalOutputLine['color']) => {
		switch (color) {
			case 'green':
				return 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-400';
			case 'yellow':
				return 'text-amber-600 dark:text-amber-400';
			case 'red':
				return 'text-red-600 dark:text-red-400';
			case 'cyan':
				return 'text-cyan-600 dark:text-cyan-400';
			case 'muted':
				return 'text-muted-foreground';
			default:
				return 'text-foreground';
		}
	};

	return (
		<div className="rounded-lg border border-border bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
			{/* Terminal header */}
			<div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
				<div className="flex gap-1.5">
					<div className="w-3 h-3 rounded-full bg-red-500" />
					<div className="w-3 h-3 rounded-full bg-yellow-500" />
					<div className="w-3 h-3 rounded-full bg-green-500" />
				</div>
				<Terminal className="w-3.5 h-3.5 text-muted-foreground ml-1" />
				<span className="text-xs text-muted-foreground font-mono">{title}</span>
			</div>

			{/* Terminal output */}
			<div
				className="p-3 font-mono text-sm max-h-64 overflow-y-auto"
				ref={scrollRef}
			>
				{history.map((entry, i) => (
					<div
						className="mb-2"
						key={`entry-${i}-${entry.command.slice(0, 20)}`}
					>
						<div className="flex gap-2">
							<span className="text-emerald-600 dark:text-emerald-400 shrink-0">
								{prompt}
							</span>
							<span className="text-foreground">{entry.command}</span>
						</div>
						{entry.output.map((line, j) => {
							// For the latest entry, animate lines
							const isLatest = i === history.length - 1;
							const shouldShow = !isLatest || !animating || j < visibleLines;
							if (!shouldShow) return null;
							return (
								<div
									className={`ml-4 ${colorClass(line.color)}`}
									key={`line-${j}-${line.text.slice(0, 20)}`}
								>
									{line.text}
								</div>
							);
						})}
					</div>
				))}

				{/* Cursor */}
				{!completed && (
					<div className="flex items-center gap-2">
						<span className="text-emerald-600 dark:text-emerald-400">
							{prompt}
						</span>
						<span className="w-2 h-4 bg-foreground/50 animate-pulse" />
					</div>
				)}
			</div>

			{/* Command buttons */}
			{!completed && (
				<div className="p-3 border-t border-border bg-muted/50">
					<div className="text-xs text-muted-foreground mb-2">
						Choose a command:
					</div>
					<div className="flex flex-wrap gap-2">
						{commands.map((cmd) => (
							<Button
								className="font-mono text-xs bg-muted hover:bg-muted/80 text-foreground border-border"
								disabled={disabled || animating}
								key={cmd.id}
								onClick={() => handleCommand(cmd)}
								size="sm"
								variant="outline"
							>
								{cmd.label}
							</Button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export default SimulatedTerminal;
