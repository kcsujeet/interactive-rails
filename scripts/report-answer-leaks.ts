/**
 * Answer-leak candidate report (heuristic, for the manual audit pass).
 *
 * Lists every wrong-option feedback string that contains a token distinctive
 * to the correct answer. Token matching is noisy by nature (generic Rails
 * vocabulary triggers it), so this is a REPORT, not a CI gate; the verbatim
 * phrase-quote variant of the same check IS enforced in
 * `src/lib/__tests__/curriculum-quality.test.ts`.
 *
 * Run: `bun run report:leaks`
 * Review protocol: for each candidate, ask "does this feedback tell the
 * player which option to pick next?" If yes, rephrase the feedback to
 * explain why the chosen option is wrong without naming the missing piece.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
	extractOptionGroups,
	findAnswerLeaks,
} from '@/lib/testing/level-source-analysis';

const ROOT = resolve(import.meta.dir, '..', 'src');

const files: string[] = [];
function walk(dir: string) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			if (entry !== '__tests__' && entry !== 'node_modules') walk(path);
		} else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.')) {
			files.push(path);
		}
	}
}
walk(join(ROOT, 'features'));

const leaks: string[] = [];
for (const file of files) {
	const source = readFileSync(file, 'utf8');
	for (const group of extractOptionGroups(relative(ROOT, file), source)) {
		leaks.push(
			...findAnswerLeaks(group).filter(
				(leak) => !leak.includes('quotes the correct answer'),
			),
		);
	}
}

if (leaks.length === 0) {
	console.log('No token-level answer-leak candidates found.');
} else {
	console.log(`${leaks.length} token-level answer-leak candidates:\n`);
	for (const leak of leaks) console.log(`  ${leak}`);
	console.log(
		'\nHeuristic output. Verify each against the "does the feedback name the answer?" question before editing.',
	);
}
