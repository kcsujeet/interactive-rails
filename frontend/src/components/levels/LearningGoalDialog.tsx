/**
 * Learning Goal Dialog Component
 *
 * Shows the level's learning goal in a dialog triggered from the header.
 */

import { GraduationCap } from 'lucide-react';
import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import { Button } from '@/components/ui/Button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';

interface LearningGoalDialogProps {
	learningGoal?: string;
}

/**
 * Extract plain text from React children to detect section headers.
 */
function getTextContent(children: React.ReactNode): string {
	if (typeof children === 'string') return children;
	if (typeof children === 'number') return String(children);
	if (Array.isArray(children)) return children.map(getTextContent).join('');
	if (
		typeof children === 'object' &&
		children !== null &&
		'props' in children
	) {
		return getTextContent(children.props?.children);
	}
	return '';
}

/**
 * Pre-process markdown text to fix common content patterns:
 * - Consecutive lines starting with ** without - prefix → convert to list items
 *   e.g. "**has_many** — desc\n**belongs_to** — desc" → "- **has_many** — ...\n- **belongs_to** — ..."
 */
function preprocessMarkdown(text: string): string {
	const blocks = text.split(/\n\n/);
	return blocks
		.map((block) => {
			const lines = block.split('\n');
			// If all non-empty lines in this block start with ** and it has 2+ lines,
			// they should be list items
			const nonEmpty = lines.filter((l) => l.trim() !== '');
			if (
				nonEmpty.length >= 2 &&
				nonEmpty.every((l) => l.trimStart().startsWith('**'))
			) {
				return nonEmpty.map((l) => `- ${l.trimStart()}`).join('\n');
			}
			return block;
		})
		.join('\n\n');
}

const mdComponents: Components = {
	p: ({ children, node }) => {
		// Section header: paragraph whose only inline child is a <strong>
		// e.g. "**Key concepts:**" → <p><strong>Key concepts:</strong></p>
		const isHeader =
			node?.children?.length === 1 &&
			node.children[0].type === 'element' &&
			node.children[0].tagName === 'strong';

		if (isHeader) {
			const text = getTextContent(children);
			return (
				<p className="text-xs font-semibold text-primary uppercase tracking-wider mt-4 mb-1.5 first:mt-0">
					{text}
				</p>
			);
		}
		return (
			<p className="text-sm text-muted-foreground leading-relaxed mb-2">
				{children}
			</p>
		);
	},
	strong: ({ children }) => (
		<strong className="text-foreground font-medium">{children}</strong>
	),
	code: ({ children }) => (
		<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary">
			{children}
		</code>
	),
	ul: ({ children }) => (
		<ul className="list-disc ml-5 mb-3 space-y-1">{children}</ul>
	),
	ol: ({ children }) => (
		<ol className="list-decimal ml-5 mb-3 space-y-1">{children}</ol>
	),
	li: ({ children }) => (
		<li className="text-sm text-muted-foreground leading-relaxed">
			{children}
		</li>
	),
};

export function LearningGoalDialog({ learningGoal }: LearningGoalDialogProps) {
	if (!learningGoal) return null;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2"
					size="sm"
					variant="ghost"
				>
					<GraduationCap className="w-4 h-4" />
					Goal
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GraduationCap className="w-5 h-5 text-success" />
						Learning Goal
					</DialogTitle>
				</DialogHeader>
				<Markdown components={mdComponents}>
					{preprocessMarkdown(learningGoal)}
				</Markdown>
			</DialogContent>
		</Dialog>
	);
}
