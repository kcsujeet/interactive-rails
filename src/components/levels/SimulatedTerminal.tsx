/**
 * Simulated Terminal Component
 *
 * Free-input first: the player types the command at the prompt (recall).
 * The clickable command buttons (recognition fallback) appear either when
 * the player clicks "Show the options" or after FREE_INPUT_MISS_LIMIT
 * failed attempts, so a first-timer who has never seen the command is
 * never stuck at a blank prompt. Animated line-by-line output, monospace
 * font, colored output, auto-scroll.
 */

import { Terminal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	matchTypedCommand,
	shouldRevealOptions,
} from '@/components/levels/terminal-input-matching';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

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
	const [typedInput, setTypedInput] = useState('');
	const [missCount, setMissCount] = useState(0);
	const [manuallyRevealed, setManuallyRevealed] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom whenever new output appears. The deps `history`
	// and `visibleLines` aren't read inside the effect, they're scroll
	// triggers: every time history grows (new step output) or visibleLines
	// changes (typed-out animation step), this re-runs and scrolls to keep
	// up with the new line. Without these deps the effect runs only on mount.
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional scroll triggers
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

	const handleTypedSubmit = () => {
		if (disabled || animating || completed) return;
		const typed = typedInput.trim();
		if (typed.length === 0) return;

		const match = matchTypedCommand(typedInput, commands);
		setTypedInput('');
		if (match.kind === 'match') {
			if (!match.command.correct) setMissCount((count) => count + 1);
			handleCommand(match.command);
			return;
		}
		// Unrecognized input: echo it with a shell-style error. It counts as
		// a miss toward revealing the options, but not as a wrong answer (a
		// typo is not a choice), so onWrong is not called.
		setMissCount((count) => count + 1);
		setHistory((prev) => [
			...prev,
			{
				command: typed,
				output: [
					{
						text: 'command not recognized. Check the spelling and try again.',
						color: 'red' as const,
					},
				],
				isError: true,
			},
		]);
	};

	const optionsRevealed = shouldRevealOptions(missCount, manuallyRevealed);

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

				{/* Prompt line with free input */}
				{!completed && (
					<div className="flex items-center gap-2">
						<span className="text-emerald-600 dark:text-emerald-400 shrink-0">
							{prompt}
						</span>
						<div className="relative flex-1">
							{/* Blinking pipe marks the typing area while the prompt is
							    empty; the native caret takes over once typing starts. */}
							{typedInput.length === 0 && (
								<span
									aria-hidden="true"
									className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
								>
									<span className="h-4 w-px bg-foreground animate-caret-blink" />
								</span>
							)}
							<Input
								aria-label="Type a command"
								autoComplete="off"
								className={cn(
									'h-5 w-full rounded-none border-0 bg-transparent dark:bg-transparent px-0 py-0 font-mono text-sm shadow-none focus-visible:ring-0 focus-visible:border-0',
									typedInput.length === 0 && 'caret-transparent',
								)}
								disabled={disabled || animating}
								onChange={(event) => setTypedInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') handleTypedSubmit();
								}}
								spellCheck={false}
								value={typedInput}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Free-input hint + fallback command buttons */}
			{!completed && (
				<div className="p-3 border-t border-border bg-muted/50">
					{optionsRevealed ? (
						<>
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
						</>
					) : (
						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<span>Type the command and press Enter, or</span>
							<Button
								className="h-6 px-2 text-xs"
								disabled={disabled || animating}
								onClick={() => setManuallyRevealed(true)}
								size="sm"
								variant="outline"
							>
								Show the options
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default SimulatedTerminal;
