/**
 * Builds a nested file tree from a flat list of CodeFile objects.
 * Splits filenames on "/" and creates a hierarchical folder/file structure.
 */

import type { CodeFile } from '@/utils/codeGeneration';

export interface TreeNode {
	name: string;
	path: string;
	type: 'file' | 'folder';
	children?: TreeNode[];
	file?: CodeFile;
}

export function buildProjectTree(files: CodeFile[]): TreeNode[] {
	const root: TreeNode = {
		name: '',
		path: '',
		type: 'folder',
		children: [],
	};

	for (const file of files) {
		const parts = file.filename.split('/');
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isFile = i === parts.length - 1;
			const currentPath = parts.slice(0, i + 1).join('/');

			if (isFile) {
				current.children?.push({
					name: part,
					path: currentPath,
					type: 'file',
					file,
				});
			} else {
				let folder = current.children?.find(
					(c) => c.type === 'folder' && c.name === part,
				);
				if (!folder) {
					folder = {
						name: part,
						path: currentPath,
						type: 'folder',
						children: [],
					};
					current.children?.push(folder);
				}
				current = folder;
			}
		}
	}

	sortTree(root.children ?? []);
	return root.children ?? [];
}

function sortTree(nodes: TreeNode[]): void {
	nodes.sort((a, b) => {
		// Folders first, then files
		if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
		// Alphabetical within each group
		return a.name.localeCompare(b.name);
	});

	for (const node of nodes) {
		if (node.children) {
			sortTree(node.children);
		}
	}
}
