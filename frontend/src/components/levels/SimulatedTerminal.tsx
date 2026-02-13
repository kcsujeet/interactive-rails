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

interface SimulatedTerminalProps {
	commands: TerminalCommand[];
	onCorrect: () => void;
	onWrong: (feedback: string) => void;
	prompt?: string;
	outputLines?: TerminalOutputLine[];
	disabled?: boolean;
	completed?: boolean;
}

export function SimulatedTerminal({
	commands,
	onCorrect,
	onWrong,
	prompt = '$',
	outputLines,
	disabled = false,
	completed = false,
}: SimulatedTerminalProps) {
	const [history, setHistory] = useState<
		{ command: string; output: TerminalOutputLine[]; isError: boolean }[]
	>([]);
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
				return 'text-emerald-400';
			case 'yellow':
				return 'text-amber-400';
			case 'red':
				return 'text-red-400';
			case 'cyan':
				return 'text-cyan-400';
			case 'muted':
				return 'text-zinc-500';
			default:
				return 'text-zinc-300';
		}
	};

	return (
		<div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
			{/* Terminal header */}
			<div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
				<div className="flex gap-1.5">
					<div className="w-3 h-3 rounded-full bg-red-500" />
					<div className="w-3 h-3 rounded-full bg-yellow-500" />
					<div className="w-3 h-3 rounded-full bg-green-500" />
				</div>
				<Terminal className="w-3.5 h-3.5 text-zinc-400 ml-1" />
				<span className="text-xs text-zinc-400 font-mono">Terminal</span>
			</div>

			{/* Terminal output */}
			<div
				className="p-3 font-mono text-sm max-h-64 overflow-y-auto"
				ref={scrollRef}
			>
				{history.map((entry, i) => (
					<div className="mb-2" key={`entry-${i}-${entry.command.slice(0, 20)}`}>
						<div className="flex gap-2">
							<span className="text-emerald-400 shrink-0">{prompt}</span>
							<span className="text-zinc-200">{entry.command}</span>
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
						<span className="text-emerald-400">{prompt}</span>
						<span className="w-2 h-4 bg-zinc-300 animate-pulse" />
					</div>
				)}
			</div>

			{/* Command buttons */}
			{!completed && (
				<div className="p-3 border-t border-zinc-700 bg-zinc-800/50">
					<div className="text-xs text-zinc-500 mb-2">Choose a command:</div>
					<div className="flex flex-wrap gap-2">
						{commands.map((cmd) => (
							<Button
								className="font-mono text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border-zinc-600"
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
