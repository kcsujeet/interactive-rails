/**
 * Shared per-level pedagogy assertions.
 *
 * Each helper enforces a rule from `.agents/rules/pedagogy.md` or
 * `.agents/rules/level-content.md` so authors do not have to re-implement
 * the same scaffolding in every level's test file.
 *
 * Helpers fail loudly via `expect(...).toEqual([])` aggregating every
 * violation in one assertion, so the failure message lists every issue
 * at once instead of stopping at the first.
 *
 * The companion to this file lives at
 * `src/lib/testing/probe-pedagogy.ts` (visualization-state helpers).
 */

import { expect } from 'bun:test';

interface Identified {
	id: string;
}
interface IdentifiedLabeled extends Identified {
	label: string;
}
interface Storied extends Identified {
	story?: string[];
}
interface OptionLike {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}
interface ScenarioLike extends IdentifiedLabeled {
	expectedResult: 'allowed' | 'blocked';
}

/**
 * Discovery gating must require all discoveries to surface.
 *
 * Pedagogy.md rule: every probe must fire before "Build the Fix" appears,
 * which only works if `useDiscoveryGating` is called with
 * `minRequired: DISCOVERY_DEFS.length`.
 */
export function expectAllDiscoveriesRequired(opts: {
	discoveries: Identified[];
	minRequired: number;
}): void {
	expect(
		opts.minRequired,
		`minRequired (${opts.minRequired}) must equal DISCOVERY_DEFS.length ` +
			`(${opts.discoveries.length}); see .agents/rules/pedagogy.md ` +
			`"PROBE_DISCOVERY_MAP must be 1:1, minRequired = all"`,
	).toBe(opts.discoveries.length);
}

/**
 * `PROBE_DISCOVERY_MAP` must be strictly 1:1, each probe unlocks exactly
 * one distinct discovery, and each discovery is unlocked by exactly one
 * probe. Catches the silent gating bug where a probe maps to no discovery
 * (player can never advance) or duplicate discoveries (player can advance
 * without firing every probe).
 */
export function expectProbeDiscoveryMapOneToOne(opts: {
	probes: Identified[];
	discoveries: Identified[];
	map: Record<string, string[]>;
}): void {
	const errors: string[] = [];
	const probeIds = new Set(opts.probes.map((p) => p.id));
	const discoveryIds = new Set(opts.discoveries.map((d) => d.id));
	const seenDiscoveries = new Map<string, string>();

	for (const probe of opts.probes) {
		const mapped = opts.map[probe.id];
		if (mapped === undefined) {
			errors.push(`probe "${probe.id}" has no entry in PROBE_DISCOVERY_MAP`);
			continue;
		}
		if (mapped.length !== 1) {
			errors.push(
				`probe "${probe.id}" maps to ${mapped.length} discoveries; ` +
					`map must be 1:1 (one probe -> one discovery)`,
			);
			continue;
		}
		const [discoveryId] = mapped;
		if (!discoveryIds.has(discoveryId)) {
			errors.push(
				`probe "${probe.id}" maps to unknown discovery "${discoveryId}"`,
			);
			continue;
		}
		const existingProbe = seenDiscoveries.get(discoveryId);
		if (existingProbe !== undefined) {
			errors.push(
				`discovery "${discoveryId}" is unlocked by both ` +
					`"${existingProbe}" and "${probe.id}"; map must be 1:1`,
			);
		} else {
			seenDiscoveries.set(discoveryId, probe.id);
		}
	}

	for (const discovery of opts.discoveries) {
		if (!seenDiscoveries.has(discovery.id)) {
			errors.push(
				`discovery "${discovery.id}" is not unlocked by any probe; ` +
					`every discovery must have a 1:1 probe`,
			);
		}
	}

	for (const probeId of Object.keys(opts.map)) {
		if (!probeIds.has(probeId)) {
			errors.push(
				`PROBE_DISCOVERY_MAP has entry for "${probeId}" but no such probe exists`,
			);
		}
	}

	expect(
		errors,
		'PROBE_DISCOVERY_MAP must be 1:1 ' +
			'(see .agents/rules/pedagogy.md "PROBE_DISCOVERY_MAP must be 1:1")',
	).toEqual([]);
}

/**
 * Every probe and every reward scenario must have a `story` field with
 * 3-6 short bullets. Pedagogy.md rule: "Every probe and scenario has a
 * `story` field" (Dialog content for the info icon).
 *
 * Each bullet must be a real sentence, not a one-word placeholder. The
 * 20-character minimum below is heuristic, it catches the common "TODO"
 * / "fix this" placeholders without rejecting legitimate short bullets.
 */
export function expectStoriesPresent(opts: {
	items: Storied[];
	kind: 'probe' | 'scenario';
}): void {
	const errors: string[] = [];
	for (const item of opts.items) {
		const story = item.story;
		if (!story || story.length === 0) {
			errors.push(`${opts.kind} "${item.id}" has no story array`);
			continue;
		}
		if (story.length < 3 || story.length > 6) {
			errors.push(
				`${opts.kind} "${item.id}" has ${story.length} story bullets; ` +
					`must be 3-6`,
			);
		}
		for (const [idx, bullet] of story.entries()) {
			if (bullet.length < 20) {
				errors.push(
					`${opts.kind} "${item.id}" story[${idx}] is too short ` +
						`(${bullet.length} chars; need 20+ for a real sentence): "${bullet}"`,
				);
			}
		}
	}
	expect(
		errors,
		`${opts.kind}s must have 3-6 substantive story bullets ` +
			'(see .agents/rules/pedagogy.md "Every probe and scenario has a `story` field")',
	).toEqual([]);
}

/**
 * Probe-to-scenario coverage: the reward phase must contain a scenario
 * with the same id and label as every observe probe.
 *
 * Reward may have ADDITIONAL scenarios beyond the probes (validation or
 * happy-path scenarios that close the loop on the build phase), but
 * every probe must have a matching scenario.
 */
export function expectProbesMatchScenarios(opts: {
	probes: IdentifiedLabeled[];
	scenarios: IdentifiedLabeled[];
}): void {
	const errors: string[] = [];
	const scenarioById = new Map(opts.scenarios.map((s) => [s.id, s]));
	for (const probe of opts.probes) {
		const scenario = scenarioById.get(probe.id);
		if (!scenario) {
			errors.push(
				`probe "${probe.id}" has no matching reward scenario with the same id`,
			);
			continue;
		}
		if (scenario.label !== probe.label) {
			errors.push(
				`probe "${probe.id}" label "${probe.label}" does not match ` +
					`scenario label "${scenario.label}"`,
			);
		}
	}
	expect(
		errors,
		'every observe probe must have a matching reward scenario ' +
			'(see .agents/rules/testing.md "Probe-to-scenario coverage")',
	).toEqual([]);
}

/**
 * One option set must have:
 * - exactly one correct answer;
 * - the correct answer not at index 0 (otherwise it's a giveaway);
 * - every wrong option has substantive feedback;
 * - wrong feedback never quotes the correct option's label verbatim;
 * - if `answerKeywords` is supplied, no wrong feedback contains any of
 *   those distinctive strings (catches indirect leaks).
 *
 * The author can assert this once per OptionCard step instead of
 * re-writing five separate `test(...)` blocks per step.
 */
export function expectBuildStepQuality(opts: {
	name: string;
	options: OptionLike[];
	/** Distinctive strings from the correct answer that must not appear in wrong-option feedback. */
	answerKeywords?: string[];
}): void {
	const errors: string[] = [];
	const correct = opts.options.filter((o) => o.correct);
	if (correct.length !== 1) {
		errors.push(
			`${opts.name}: must have exactly one correct answer (found ${correct.length})`,
		);
	}
	const correctOpt = correct[0];

	if (opts.options[0]?.correct) {
		errors.push(
			`${opts.name}: correct answer is at index 0; must be shuffled or hand-positioned later ` +
				'(see CLAUDE.md "The correct answer must NEVER be the first option")',
		);
	}

	const ids = opts.options.map((o) => o.id);
	if (new Set(ids).size !== ids.length) {
		errors.push(`${opts.name}: option ids are not unique`);
	}

	const labels = opts.options.map((o) => o.label);
	if (new Set(labels).size !== labels.length) {
		errors.push(`${opts.name}: option labels are not unique`);
	}

	for (const o of opts.options) {
		if (o.correct) continue;
		if (!o.feedback || o.feedback.length < 20) {
			errors.push(
				`${opts.name}: wrong option "${o.id}" needs substantive feedback ` +
					`(found ${(o.feedback ?? '').length} chars; need 20+)`,
			);
			continue;
		}
		if (correctOpt && o.feedback.includes(correctOpt.label)) {
			errors.push(
				`${opts.name}: wrong option "${o.id}" feedback quotes the correct ` +
					`label "${correctOpt.label}" verbatim`,
			);
		}
		for (const keyword of opts.answerKeywords ?? []) {
			if (o.feedback.includes(keyword)) {
				errors.push(
					`${opts.name}: wrong option "${o.id}" feedback contains answer ` +
						`keyword "${keyword}" (gives away the correct answer)`,
				);
			}
		}
	}

	expect(
		errors,
		`${opts.name}: build step quality issues ` +
			'(see CLAUDE.md "Wrong-Answer Feedback: Never Reveal Answers")',
	).toEqual([]);
}

/**
 * Stress scenario sanity: ids and labels are unique; expected results
 * include both 'allowed' and 'blocked' (otherwise the player learns the
 * solution is binary instead of selective).
 */
export function expectScenarioBasics(opts: {
	scenarios: ScenarioLike[];
}): void {
	const errors: string[] = [];
	const ids = opts.scenarios.map((s) => s.id);
	if (new Set(ids).size !== ids.length) {
		errors.push('scenario ids are not unique');
	}
	const labels = opts.scenarios.map((s) => s.label);
	if (new Set(labels).size !== labels.length) {
		errors.push('scenario labels are not unique');
	}

	const allowed = opts.scenarios.filter((s) => s.expectedResult === 'allowed');
	const blocked = opts.scenarios.filter((s) => s.expectedResult === 'blocked');
	if (allowed.length === 0) {
		errors.push(
			'no scenarios with expectedResult "allowed"; ' +
				'reward phase must show the solution succeeding on legitimate cases',
		);
	}
	if (blocked.length === 0) {
		errors.push(
			'no scenarios with expectedResult "blocked"; ' +
				'reward phase must show the solution rejecting illegitimate cases',
		);
	}

	expect(errors, 'scenario basics').toEqual([]);
}
