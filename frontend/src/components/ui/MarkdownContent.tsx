/**
 * Markdown Content Component
 *
 * Renders markdown text with styled components.
 * Reuses the preprocessing and component styles from LearningGoalDialog.
 */

import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';

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
		return getTextContent((children as { props?: { children?: React.ReactNode } }).props?.children);
	}
	return '';
}

/**
 * Pre-process markdown text to fix common content patterns:
 * - Consecutive lines starting with ** without - prefix -> convert to list items
 */
function preprocessMarkdown(text: string): string {
	const blocks = text.split(/\n\n/);
	return blocks
		.map((block) => {
			const lines = block.split('\n');
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
			<p className="text-foreground leading-relaxed mb-2 last:mb-0">
				{children}
			</p>
		);
	},
	strong: ({ children }) => (
		<strong className="text-foreground font-semibold">{children}</strong>
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
		<li className="text-foreground leading-relaxed">{children}</li>
	),
};

interface MarkdownContentProps {
	content: string;
	className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
	return (
		<div className={className}>
			<Markdown components={mdComponents}>
				{preprocessMarkdown(content)}
			</Markdown>
		</div>
	);
}
