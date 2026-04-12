/**
 * CodebaseViewerDialog Component
 *
 * Near-full-screen dialog showing the cumulative Rails project codebase.
 * Uses Monaco Editor for VS Code-like code viewing and a custom file tree.
 */

import Editor from '@monaco-editor/react';
import { Code2, FolderTree, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import type { CodeFile } from '@/utils/codeGeneration';
import { buildProjectTree } from '../utils/build-project-tree';
import { FileTree } from './FileTree';

interface CodebaseViewerDialogProps {
	files: CodeFile[];
	levelCount?: number;
	/** Custom trigger element. If not provided, renders a default button. */
	trigger?: React.ReactNode;
}

/** Map CodeFile language to Monaco language ID */
function getMonacoLanguage(language: string, filename: string): string {
	// Check filename first for special cases
	if (filename === 'Gemfile' || filename === 'Rakefile') return 'ruby';
	if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return 'yaml';
	if (filename.endsWith('.json')) return 'json';
	if (filename.endsWith('.toml')) return 'ini';
	if (filename.endsWith('.sh')) return 'shell';
	if (filename.endsWith('.erb')) return 'html';

	switch (language) {
		case 'ruby':
			return 'ruby';
		case 'yaml':
			return 'yaml';
		case 'json':
			return 'json';
		case 'bash':
		case 'shell':
			return 'shell';
		case 'html':
		case 'erb':
			return 'html';
		default:
			return 'plaintext';
	}
}

export function CodebaseViewerDialog({
	files,
	levelCount,
	trigger,
}: CodebaseViewerDialogProps) {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);

	const tree = useMemo(() => buildProjectTree(files), [files]);

	const fileMap = useMemo(() => {
		const map = new Map<string, CodeFile>();
		for (const file of files) {
			map.set(file.filename, file);
		}
		return map;
	}, [files]);

	const selectedFile = selectedPath ? fileMap.get(selectedPath) : null;

	// Auto-select first file if none selected
	const effectiveFile = selectedFile ?? files[0];
	const effectivePath = selectedPath ?? files[0]?.filename ?? null;

	const isEmpty = files.length === 0;

	const stats = `${files.length} file${files.length !== 1 ? 's' : ''}${levelCount ? ` from ${levelCount} level${levelCount !== 1 ? 's' : ''}` : ''}`;

	return (
		<Dialog>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button size="sm" variant="outline">
						<Code2 className="w-4 h-4 mr-2" />
						View Codebase
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-[90vw] h-[85vh] p-0 gap-0 flex flex-col">
				<DialogHeader className="px-4 py-3 border-b border-border shrink-0">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<FolderTree className="w-5 h-5 text-primary" />
							<div>
								<DialogTitle className="text-base">
									Your Rails Project
								</DialogTitle>
								<p className="text-xs text-muted-foreground mt-0.5">
									{stats}
								</p>
							</div>
						</div>
					</div>
				</DialogHeader>

				<div className="flex flex-1 min-h-0 overflow-hidden">
					{isEmpty ? (
						<div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
							<FolderTree className="w-10 h-10" />
							<p className="text-sm">Complete your first level to see generated code here.</p>
						</div>
					) : (
						<>
							{/* File tree sidebar */}
							<div className="w-64 shrink-0 border-r border-border overflow-y-auto bg-muted/30 py-2">
								<FileTree
									nodes={tree}
									onSelect={setSelectedPath}
									selectedPath={effectivePath}
								/>
							</div>

					{/* Code viewer */}
					<div className="flex-1 min-w-0 flex flex-col">
						{effectiveFile ? (
							<>
								<div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border text-sm shrink-0">
									<Code2 className="w-3.5 h-3.5 text-muted-foreground" />
									<span className="font-mono text-muted-foreground">
										{effectiveFile.filename}
									</span>
								</div>
								<div className="flex-1 min-h-0">
									<Editor
										defaultLanguage="ruby"
										height="100%"
										language={getMonacoLanguage(
											effectiveFile.language,
											effectiveFile.filename,
										)}
										loading={
											<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
												Loading editor...
											</div>
										}
										options={{
											readOnly: true,
											minimap: { enabled: true },
											fontSize: 13,
											fontFamily: "'JetBrains Mono', monospace",
											lineNumbers: 'on',
											scrollBeyondLastLine: false,
											wordWrap: 'on',
											padding: { top: 12 },
											renderLineHighlight: 'none',
											domReadOnly: true,
											contextmenu: false,
										}}
										theme="vs-dark"
										value={effectiveFile.code.trim()}
									/>
								</div>
							</>
						) : (
							<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
								Select a file to view its contents
							</div>
						)}
							</div>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
