/**
 * Curriculum-wide quality sweep.
 *
 * Mechanically enforces the CLAUDE.md rules that used to depend on manual
 * audit discipline, across every level source file at once:
 *
 * 1. Option-group structure: exactly one correct answer, correct never
 *    first in source order, every wrong option teaches via feedback (or
 *    decision-modal consequence), no mixed option colors.
 * 2. Answer phrase leaks: feedback never quotes the correct answer.
 *    (Token-level leak *candidates* are heuristic and noisy; they live in
 *    `bun run report:leaks` for the manual audit pass, not here.)
 * 3. Probe-discovery gate integrity: no discovery is unlocked by two
 *    different probes, which would let the player clear the observe gate
 *    without firing every probe.
 * 4. Every `<PipelineFlow>` JSX tag passes `activeConnections` explicitly
 *    (undefined causes continuous idle animation; visuals must be static
 *    until the player fires a probe or scenario).
 * 5. No em dashes anywhere in src source files.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
	extractOptionGroups,
	extractPipelineFlowTags,
	extractProbeDiscoveryMaps,
	findAnswerLeaks,
	findOptionGroupViolations,
} from '@/lib/testing/level-source-analysis';

const SRC_ROOT = resolve(import.meta.dir, '..', '..');

function sourceFilesUnder(...dirs: string[]): string[] {
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) {
				if (entry !== '__tests__' && entry !== 'node_modules') walk(path);
			} else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.')) {
				files.push(path);
			}
		}
	};
	for (const dir of dirs) walk(resolve(SRC_ROOT, dir));
	return files;
}

const levelFiles = sourceFilesUnder('features');
const componentFiles = sourceFilesUnder('features', 'components');

describe('option groups across all levels', () => {
	test('follow the wrong-answer-feedback structural rules', () => {
		const violations: string[] = [];
		for (const file of levelFiles) {
			const source = readFileSync(file, 'utf8');
			for (const group of extractOptionGroups(
				relative(SRC_ROOT, file),
				source,
			)) {
				violations.push(...findOptionGroupViolations(group));
			}
		}
		expect(violations).toEqual([]);
	});

	test('feedback never quotes the correct answer verbatim', () => {
		const leaks: string[] = [];
		for (const file of levelFiles) {
			const source = readFileSync(file, 'utf8');
			for (const group of extractOptionGroups(
				relative(SRC_ROOT, file),
				source,
			)) {
				leaks.push(
					...findAnswerLeaks(group).filter((leak) =>
						leak.includes('quotes the correct answer'),
					),
				);
			}
		}
		expect(leaks).toEqual([]);
	});
});

describe('observe-phase gating across all levels', () => {
	test('no discovery is unlocked by two different probes', () => {
		const violations: string[] = [];
		for (const file of levelFiles) {
			const source = readFileSync(file, 'utf8');
			for (const map of extractProbeDiscoveryMaps(
				relative(SRC_ROOT, file),
				source,
			)) {
				const unlockedBy = new Map<string, string>();
				for (const [probe, discoveries] of Object.entries(map.entries)) {
					for (const discovery of discoveries) {
						const previous = unlockedBy.get(discovery);
						if (previous) {
							violations.push(
								`${map.file}:${map.line}: discovery "${discovery}" unlocked by both "${previous}" and "${probe}"`,
							);
						}
						unlockedBy.set(discovery, probe);
					}
				}
			}
		}
		expect(violations).toEqual([]);
	});
});

describe('visualization rules across all levels', () => {
	test('every PipelineFlow tag passes activeConnections explicitly', () => {
		const violations: string[] = [];
		for (const file of componentFiles) {
			const source = readFileSync(file, 'utf8');
			for (const tag of extractPipelineFlowTags(
				relative(SRC_ROOT, file),
				source,
			)) {
				if (!tag.hasActiveConnections) {
					violations.push(`${tag.file}:${tag.line}`);
				}
			}
		}
		expect(violations).toEqual([]);
	});
});

describe('typography rules across src', () => {
	// The character is spelled via escape so this file passes its own scan.
	const EM_DASH = '\u2014';

	test('no em dashes in any source file', () => {
		const violations: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) {
					if (entry !== 'node_modules') walk(path);
				} else if (/\.(ts|tsx|astro)$/.test(entry)) {
					const source = readFileSync(path, 'utf8');
					source.split('\n').forEach((line, i) => {
						if (line.includes(EM_DASH)) {
							violations.push(`${relative(SRC_ROOT, path)}:${i + 1}`);
						}
					});
				}
			}
		};
		walk(SRC_ROOT);
		expect(violations).toEqual([]);
	});
});
