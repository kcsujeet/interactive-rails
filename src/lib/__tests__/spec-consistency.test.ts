/**
 * docs/spec.md consistency test.
 *
 * The spec is the design document that CLAUDE.md and the audit skills tell
 * every session to cross-reference for level scenarios and concepts. When it
 * drifts from the live curriculum (acts-registry), audits silently inherit
 * wrong level numbers, wrong act boundaries, and wrong feature placements.
 * This test pins the spec's structural claims to the registry so drift fails
 * CI instead of waiting for a human to notice.
 *
 * Expected spec format:
 *   - Act heading:   ## ACT <id>: <Name> (Levels <first>-<last>)
 *   - Level row:     | <levelNumber> | <Name> | ...
 *   - Stats line:    **<total> levels, <actCount> acts**
 *   - Feature row:   | <feature> | L<n>[, L<m>] | ...
 */

import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { ACTS, getAllLevels } from '@/lib/acts-registry';
import type { Level } from '@/types';

const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..');
const spec = await Bun.file(resolve(REPO_ROOT, 'docs', 'spec.md')).text();

type SpecAct = {
	id: number;
	name: string;
	firstLevel: number;
	lastLevel: number;
	levels: { number: number; name: string }[];
};

const ACT_HEADING = /^## ACT (\d+): (.+?) \(Levels (\d+)-(\d+)\)$/;
const LEVEL_ROW = /^\| (\d+) \| ([^|]+) \|/;

function parseSpecActs(markdown: string): SpecAct[] {
	const acts: SpecAct[] = [];
	let current: SpecAct | null = null;
	for (const line of markdown.split('\n')) {
		const heading = line.match(ACT_HEADING);
		if (heading) {
			current = {
				id: Number(heading[1]),
				name: heading[2],
				firstLevel: Number(heading[3]),
				lastLevel: Number(heading[4]),
				levels: [],
			};
			acts.push(current);
			continue;
		}
		if (line.startsWith('## ')) {
			current = null;
			continue;
		}
		if (!current) continue;
		const row = line.match(LEVEL_ROW);
		if (row) {
			current.levels.push({ number: Number(row[1]), name: row[2].trim() });
		}
	}
	return acts;
}

function levelByName(name: string): Level {
	const level = getAllLevels().find((l) => l.name === name);
	if (!level) {
		throw new Error(`No level named "${name}" in acts-registry`);
	}
	return level;
}

const specActs = parseSpecActs(spec);

describe('spec.md act structure matches acts-registry', () => {
	test('spec declares the same number of acts as the registry', () => {
		expect(specActs.map((a) => a.id)).toEqual(ACTS.map((a) => a.id));
	});

	for (const act of ACTS) {
		const specAct = specActs.find((a) => a.id === act.id);

		test(`Act ${act.id} heading has the registry name and level range`, () => {
			expect(specAct?.name).toBe(act.name);
			expect(specAct?.firstLevel).toBe(act.levels[0]?.levelNumber);
			expect(specAct?.lastLevel).toBe(act.levels.at(-1)?.levelNumber);
		});

		test(`Act ${act.id} table lists exactly the registry levels, in order`, () => {
			expect(specAct?.levels).toEqual(
				act.levels.map((l) => ({ number: l.levelNumber, name: l.name })),
			);
		});
	}
});

describe('spec.md headline numbers match the registry', () => {
	const totalLevels = getAllLevels().length;

	test('stats line states the registry level and act counts', () => {
		expect(spec).toContain(`**${totalLevels} levels, ${ACTS.length} acts**`);
	});

	test('intro describes the progression with the registry level count', () => {
		expect(spec).toContain(`${totalLevels}-level`);
	});
});

describe('spec.md Rails 8 feature table points at the right levels', () => {
	// Feature cell text in the spec table -> level name(s) in the registry
	// that actually teach it. Human-verified mapping; the registry supplies
	// the level numbers so renumbering cannot silently invalidate the table.
	const RAILS8_FEATURE_LEVELS: ReadonlyArray<[string, string[]]> = [
		['`rails new --api`', ['First Boot']],
		['SQLite production (WAL, IMMEDIATE)', ['First Boot']],
		['`params.expect()`', ['Strong Params']],
		['`normalizes`', ['Callbacks & Normalizations']],
		['Built-in auth generator', ['Authentication']],
		['`authenticate_by`', ['Authentication']],
		['`Current` attributes', ['Authentication', 'Authorization']],
		['`generates_token_for`', ['Action Mailer']],
		['Solid Queue', ['Background Jobs', 'Recurring Jobs & Scheduling']],
		['Solid Cache', ['Caching']],
		['Solid Cable', ['Real-Time']],
		['`encrypts`', ['Encrypted Attributes']],
		['Built-in `rate_limit`', ['Rate Limiting']],
		['Kamal 2', ['Deployment']],
	];

	function specFeatureCell(feature: string): string {
		const escaped = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const match = spec.match(
			new RegExp(`^\\| ${escaped} \\| ([^|]+) \\|`, 'm'),
		);
		if (!match) {
			throw new Error(`spec.md has no feature table row for "${feature}"`);
		}
		return match[1].trim();
	}

	for (const [feature, levelNames] of RAILS8_FEATURE_LEVELS) {
		test(`${feature} row references ${levelNames.join(' + ')}`, () => {
			const expected = levelNames
				.map((name) => `L${levelByName(name).levelNumber}`)
				.join(', ');
			expect(specFeatureCell(feature)).toBe(expected);
		});
	}
});
