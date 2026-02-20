/**
 * Code Generation Utility
 *
 * Generates CodeFile arrays for CodePreviewPanel from level content.
 * For generic pipeline builder levels (Acts 2+), extracts code examples
 * from the level's problem and learning content.
 */

import type { Level } from '@/types/game';

export interface CodeFile {
	filename: string;
	language: string;
	code: string;
	highlight?: number[];
}

/**
 * Generate code preview files from a Level's content.
 * Shows the "before" (problem) code and the "target" (solution) code.
 */
export function generateCodeFiles(level: Level): CodeFile[] {
	const files: CodeFile[] = [];

	// "Before" state - the problem code
	if (level.problem.codeExample) {
		files.push({
			filename: inferFilename(level.problem.codeExample, 'problem.rb'),
			language: 'ruby',
			code: level.problem.codeExample,
		});
	}

	// "After" state - the Rails solution code from learning content
	if (level.learningContent.railsCodeExample) {
		files.push({
			filename: inferFilename(
				level.learningContent.railsCodeExample,
				'solution.rb',
			),
			language: 'ruby',
			code: level.learningContent.railsCodeExample,
		});
	}

	return files;
}

/**
 * Get the learning goal text for the CodePreviewPanel.
 */
export function getLearningGoal(level: Level): string {
	return level.learningContent.conceptExplanation;
}

/**
 * Infer a reasonable filename from code content.
 * Looks for class/module declarations to derive the name.
 */
function inferFilename(code: string, fallback: string): string {
	// Match "class PostsController" → "posts_controller.rb"
	const classMatch = code.match(/class\s+([A-Z][a-zA-Z0-9]+)/);
	if (classMatch) {
		const name = classMatch[1];
		// Convert CamelCase to snake_case
		const snake = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
		return `app/${categorize(name)}/${snake}.rb`;
	}

	// Match "module Api" → "api.rb"
	const moduleMatch = code.match(/module\s+([A-Z][a-zA-Z0-9]+)/);
	if (moduleMatch) {
		const name = moduleMatch[1];
		const snake = name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
		return `app/${snake}.rb`;
	}

	return fallback;
}

/**
 * Categorize a class name into Rails directory convention.
 */
function categorize(className: string): string {
	if (className.endsWith('Controller')) return 'controllers';
	if (className.endsWith('Serializer')) return 'serializers';
	if (className.endsWith('Job')) return 'jobs';
	if (className.endsWith('Mailer')) return 'mailers';
	if (className.endsWith('Service')) return 'services';
	return 'models';
}
