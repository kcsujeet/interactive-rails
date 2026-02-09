/**
 * Script to replace relative imports with @/ alias
 * Usage: bun scripts/fix-imports.ts
 *
 * Note: Skips <script> tags in .astro files as they don't support the alias
 */

import { Glob } from 'bun';

const glob = new Glob('**/*.{ts,tsx,astro}');

async function fixImports() {
	const files: string[] = [];

	for await (const file of glob.scan({ cwd: './src', absolute: true })) {
		files.push(file);
	}

	console.log(`Found ${files.length} files to process\n`);

	let totalReplacements = 0;

	for (const filePath of files) {
		const file = Bun.file(filePath);
		const content = await file.text();
		const isAstro = filePath.endsWith('.astro');

		let newContent = content;
		let fileReplacements = 0;

		if (isAstro) {
			// For Astro files, only replace imports in the frontmatter (between ---)
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (frontmatterMatch) {
				const frontmatter = frontmatterMatch[1];
				let newFrontmatter = frontmatter;

				// Replace relative imports with @/ alias
				newFrontmatter = newFrontmatter.replace(
					/from\s+["'](\.\.\/)+([^"']+)['"]/g,
					(match, dots, path) => {
						const srcDirs = [
							'components',
							'lib',
							'stores',
							'layouts',
							'styles',
							'hooks',
							'types',
						];
						const firstDir = path.split('/')[0];

						if (srcDirs.includes(firstDir)) {
							fileReplacements++;
							return `from "@/${path}"`;
						}
						return match;
					},
				);

				newContent = content.replace(frontmatterMatch[1], newFrontmatter);
			}
		} else {
			// For .ts/.tsx files, replace all relative imports
			newContent = newContent.replace(
				/from\s+["'](\.\.\/)+([^"']+)['"]/g,
				(match, dots, path) => {
					const srcDirs = [
						'components',
						'lib',
						'stores',
						'layouts',
						'styles',
						'hooks',
						'types',
					];
					const firstDir = path.split('/')[0];

					if (srcDirs.includes(firstDir)) {
						fileReplacements++;
						return `from "@/${path}"`;
					}
					return match;
				},
			);

			// Handle import statements without 'from' (side effects)
			newContent = newContent.replace(
				/import\s+["'](\.\.\/)+([^"']+)['"]/g,
				(match, dots, path) => {
					const srcDirs = [
						'components',
						'lib',
						'stores',
						'layouts',
						'styles',
						'hooks',
						'types',
					];
					const firstDir = path.split('/')[0];

					if (srcDirs.includes(firstDir)) {
						fileReplacements++;
						return `import "@/${path}"`;
					}
					return match;
				},
			);
		}

		if (fileReplacements > 0) {
			await Bun.write(filePath, newContent);
			const relativePath = filePath.replace(process.cwd() + '/', '');
			console.log(`✓ ${relativePath} (${fileReplacements} replacements)`);
			totalReplacements += fileReplacements;
		}
	}

	console.log(
		`\n✅ Done! ${totalReplacements} imports updated across ${files.length} files.`,
	);
}

fixImports().catch(console.error);
