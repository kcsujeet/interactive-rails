/**
 * FileTree Component
 *
 * Recursive file tree with collapsible folders and file selection.
 * Uses Lucide icons for folder/file indicators.
 */

import {
	ChevronDown,
	ChevronRight,
	FileCode2,
	FileText,
	Folder,
	FolderOpen,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TreeNode } from '../utils/build-project-tree';

interface FileTreeProps {
	nodes: TreeNode[];
	selectedPath: string | null;
	onSelect: (path: string) => void;
}

export function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
	return (
		<div className="text-sm font-mono select-none">
			{nodes.map((node) => (
				<FileTreeNode
					depth={0}
					key={node.path}
					node={node}
					onSelect={onSelect}
					selectedPath={selectedPath}
				/>
			))}
		</div>
	);
}

function FileTreeNode({
	node,
	depth,
	selectedPath,
	onSelect,
}: {
	node: TreeNode;
	depth: number;
	selectedPath: string | null;
	onSelect: (path: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(depth < 2);
	const isSelected = selectedPath === node.path;

	if (node.type === 'folder') {
		return (
			<div>
				<button
					className={cn(
						'flex items-center gap-1.5 w-full py-1 px-2 text-left text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-sm transition-colors',
					)}
					onClick={() => setIsOpen(!isOpen)}
					style={{ paddingLeft: `${depth * 12 + 8}px` }}
					type="button"
				>
					{isOpen ? (
						<ChevronDown className="w-3.5 h-3.5 shrink-0" />
					) : (
						<ChevronRight className="w-3.5 h-3.5 shrink-0" />
					)}
					{isOpen ? (
						<FolderOpen className="w-4 h-4 shrink-0 text-amber-500" />
					) : (
						<Folder className="w-4 h-4 shrink-0 text-amber-500" />
					)}
					<span className="truncate">{node.name}</span>
				</button>
				{isOpen && node.children && (
					<div>
						{node.children.map((child) => (
							<FileTreeNode
								depth={depth + 1}
								key={child.path}
								node={child}
								onSelect={onSelect}
								selectedPath={selectedPath}
							/>
						))}
					</div>
				)}
			</div>
		);
	}

	const icon = getFileIcon(node.name);

	return (
		<button
			className={cn(
				'flex items-center gap-1.5 w-full py-1 px-2 text-left rounded-sm transition-colors',
				isSelected
					? 'bg-primary/10 text-primary'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
			)}
			onClick={() => onSelect(node.path)}
			style={{ paddingLeft: `${depth * 12 + 24}px` }}
			type="button"
		>
			{icon}
			<span className="truncate">{node.name}</span>
		</button>
	);
}

function getFileIcon(filename: string) {
	const ext = filename.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'rb':
			return <FileCode2 className="w-4 h-4 shrink-0 text-red-400" />;
		case 'yml':
		case 'yaml':
			return <FileText className="w-4 h-4 shrink-0 text-purple-400" />;
		case 'json':
			return <FileText className="w-4 h-4 shrink-0 text-yellow-400" />;
		default:
			return <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />;
	}
}
