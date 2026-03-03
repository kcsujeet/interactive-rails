/**
 * StageInspector Component
 *
 * Positioned card that appears when a pipeline stage is clicked.
 * Shows stage name, description, optional code block.
 * Closes on X button or click outside.
 */

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface StageInspectorData {
	stageId: string;
	title: string;
	description: string;
	code?: string;
}

interface StageInspectorProps {
	data: StageInspectorData;
	onClose: () => void;
}

export function StageInspector({ data, onClose }: StageInspectorProps) {
	const cardRef = useRef<HTMLDivElement>(null);

	// Close on click outside
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		// Delay to avoid immediate close from the click that opened it
		const timer = setTimeout(() => {
			document.addEventListener('mousedown', handler);
		}, 100);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('mousedown', handler);
		};
	}, [onClose]);

	// Close on Escape key
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', handler);
		return () => document.removeEventListener('keydown', handler);
	}, [onClose]);

	return (
		<div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
			<Card
				className="pointer-events-auto max-w-sm w-full shadow-xl border-primary/30 bg-card"
				ref={cardRef}
			>
				<CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
					<CardTitle className="text-base">{data.title}</CardTitle>
					<Button
						className="shrink-0 -mt-1 -mr-1"
						onClick={onClose}
						size="icon"
						variant="ghost"
					>
						<X className="w-4 h-4" />
					</Button>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-sm text-muted-foreground leading-relaxed">
						{data.description}
					</p>
					{data.code && (
						<pre className="text-xs font-mono bg-zinc-900 text-zinc-300 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
							{data.code}
						</pre>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
