/**
 * ProbeTerminal Component
 *
 * Terminal-style component for the observe phase where the player fires test
 * requests to discover vulnerabilities. NOT a correct/wrong quiz: every probe
 * "succeeds" but the response reveals the vulnerability.
 *
 * Visually matches SimulatedTerminal (dark bg, monospace, traffic-light dots).
 */

import { Check, Crosshair, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface ProbeConfig {
	id: string;
	label: string;
	command: string;
	responseLines: ProbeResponseLine[];
	/** Optional user story shown as bullet points in info modal. */
	story?: string[];
}

export interface ProbeResponseLine {
	text: string;
	color?: 'default' | 'green' | 'yellow' | 'red' | 'cyan' | 'muted';
}

interface ProbeHistoryEntry {
	command: string;
	lines: ProbeResponseLine[];
}

interface ProbeTerminalProps {
	probes: ProbeConfig[];
	/** Called when a probe fires. Use to trigger discoveries. */
	onProbe: (probeId: string) => void;
	title?: string;
	/** Disable all probe buttons (e.g. while a flow animation is running) */
	disabled?: boolean;
	/** Additional classes for the outer container (e.g. "flex-1 flex flex-col" to fill parent) */
	className?: string;
}

export function ProbeTerminal({
	probes,
	onProbe,
	title = 'API Probe',
	disabled = false,
	className,
}: ProbeTerminalProps) {
	const [firedIds, setFiredIds] = useState<Set<string>>(new Set());
	const [history, setHistory] = useState<ProbeHistoryEntry[]>([]);
	const [animating, setAnimating] = useState(false);
	const [visibleLines, setVisibleLines] = useState(0);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new output appears
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTo({
				top: scrollRef.current.scrollHeight,
				behavior: 'smooth',
			});
		}
	}, [history.length, visibleLines]);

	// Animate output lines
	useEffect(() => {
		if (!animating || history.length === 0) return;

		const latestEntry = history[history.length - 1];
		const totalLines = latestEntry.lines.length;
		setVisibleLines(0);

		let lineIndex = 0;
		const interval = setInterval(() => {
			lineIndex++;
			setVisibleLines(lineIndex);
			if (lineIndex >= totalLines) {
				clearInterval(interval);
				setAnimating(false);
			}
		}, 60);
		return () => clearInterval(interval);
	}, [animating, history.length, history]);

	const handleProbe = (probe: ProbeConfig) => {
		if (animating || disabled) return;

		setFiredIds((prev) => new Set(prev).add(probe.id));
		setHistory((prev) => [
			...prev,
			{ command: probe.command, lines: probe.responseLines },
		]);
		setAnimating(true);

		// Notify parent after animation
		const delay = (probe.responseLines.length + 1) * 60 + 200;
		setTimeout(() => onProbe(probe.id), delay);
	};

	const colorClass = (color?: ProbeResponseLine['color']) => {
		switch (color) {
			case 'green':
				return 'text-emerald-600 dark:text-emerald-400';
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

	const availableProbes = probes.filter((p) => !firedIds.has(p.id));
	const allFired = availableProbes.length === 0;

	return (
		<div
			className={cn(
				'rounded-lg border border-border bg-zinc-50 dark:bg-zinc-900 overflow-hidden',
				className,
			)}
		>
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
				<div className="flex gap-1.5">
					<div className="w-3 h-3 rounded-full bg-red-500" />
					<div className="w-3 h-3 rounded-full bg-yellow-500" />
					<div className="w-3 h-3 rounded-full bg-green-500" />
				</div>
				<Crosshair className="w-3.5 h-3.5 text-muted-foreground ml-1" />
				<span className="text-xs text-muted-foreground font-mono">{title}</span>
			</div>

			{/* Output area */}
			<div
				className={cn(
					'p-3 font-mono text-sm overflow-y-auto',
					className ? 'flex-1 min-h-0' : 'max-h-48',
				)}
				ref={scrollRef}
			>
				{history.length === 0 && (
					<div className="text-muted-foreground text-xs">
						Fire probes to inspect the API...
					</div>
				)}

				{history.map((entry, i) => (
					<div
						className="mb-2"
						key={`probe-${i}-${entry.command.slice(0, 20)}`}
					>
						<div className="flex gap-2">
							<span className="text-amber-600 dark:text-amber-400 shrink-0">
								{'>'}
							</span>
							<span className="text-foreground">{entry.command}</span>
						</div>
						{entry.lines.map((line, j) => {
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
				{!allFired && (
					<div className="flex items-center gap-2">
						<span className="text-amber-600 dark:text-amber-400">{'>'}</span>
						<span className="w-2 h-4 bg-foreground/50 animate-pulse" />
					</div>
				)}
			</div>

			{/* Probe buttons */}
			<div className="p-3 border-t border-border bg-muted/50">
				{!allFired && (
					<div className="text-xs text-zinc-500 mb-2">
						Fire a probe to test the API:
					</div>
				)}
				<div className="flex flex-wrap gap-2">
					{probes.map((probe) => {
						const fired = firedIds.has(probe.id);
						const btnBase =
							'font-mono text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700/50';
						return (
							<div className="flex items-stretch" key={probe.id}>
								<Button
									className={`${btnBase} ${probe.story ? 'rounded-r-none border-r-0' : ''}`}
									disabled={animating || disabled}
									onClick={() => handleProbe(probe)}
									size="sm"
									variant="outline"
								>
									{fired && <Check className="w-3 h-3 mr-1" />}
									{probe.label}
								</Button>
								{probe.story && (
									<Dialog>
										<DialogTrigger>
											<span
												className={`${btnBase} inline-flex items-center justify-center px-1.5 h-full rounded-l-none rounded-r-md border border-l-amber-200 dark:border-l-amber-700/30 cursor-pointer transition-colors`}
											>
												<Info className="w-3.5 h-3.5" />
											</span>
										</DialogTrigger>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>{probe.label}</DialogTitle>
											</DialogHeader>
											<ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
												{probe.story.map((point) => (
													<li key={point}>{point}</li>
												))}
											</ul>
										</DialogContent>
									</Dialog>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
