/**
 * Probe pedagogy: every probe in a level's observe phase must visibly mutate
 * the center-panel visualization on fire. Updating only the left-panel
 * discovery checklist is not enough.
 *
 * This helper enforces that requirement mechanically at CI time. It works
 * with any per-level state shape: pass a `validate` callback that knows
 * whether a given probe's state entry produces a visible delta.
 *
 * The always-loaded `.agents/rules/pedagogy.md` rule is the design-time
 * companion to this CI-time check.
 */

import { expect } from 'bun:test';

interface ProbeLike {
	id: string;
	label?: string;
}

export interface ProbePedagogyOptions<TState> {
	probes: ProbeLike[];
	/** Per-probe visualization state, keyed by probe id. */
	probeStateMap: Record<string, TState>;
	/**
	 * Returns an array of error messages if the state does NOT produce a
	 * visible center-panel change. Empty array means OK. The validator is
	 * level-specific: it knows the state shape (overrides, frames, badges,
	 * sublabels) and decides whether the entry would actually mutate
	 * something on screen.
	 *
	 * Validators should reject:
	 * - empty override records (`{}` with no keys)
	 * - entries that only set neutral fields (no badge / sublabel / variant
	 *   delta vs the base stage)
	 * - entries that reuse the exact same state as another probe (caught
	 *   separately by `expectEveryProbeDrivesDistinctChange`)
	 */
	validate: (probeId: string, state: TState | undefined) => string[];
}

/**
 * Asserts that every probe drives a visible center-panel change.
 *
 * Fails the test (with a single aggregated `expect`) if any probe lacks an
 * entry in `probeStateMap` or has an entry the validator rejects as
 * "no visible delta".
 */
export function expectEveryProbeDrivesVisualChange<TState>(
	options: ProbePedagogyOptions<TState>,
): void {
	const { probes, probeStateMap, validate } = options;
	const errors: string[] = [];
	for (const probe of probes) {
		const state = probeStateMap[probe.id];
		if (state === undefined) {
			errors.push(
				`probe "${probe.id}" has NO entry in the probe state map ` +
					`(firing it would produce no visible center-panel change).`,
			);
			continue;
		}
		const probeErrors = validate(probe.id, state);
		for (const e of probeErrors) {
			errors.push(`probe "${probe.id}": ${e}`);
		}
	}
	expect(
		errors,
		'every probe must drive a visible center-panel change ' +
			'(see .agents/rules/pedagogy.md)',
	).toEqual([]);
}

/**
 * Asserts that no two probes produce the same visual state. Mirrors the
 * `design-level` skill's "Probe Differentiation" rule: each probe exists
 * to teach a different aspect of the problem; identical visual state means
 * the visualisation is generic instead of specific.
 *
 * `serialize` should return a stable string representation of the visual
 * delta a probe produces. Probes whose serialized state collides will fail
 * the test.
 */
export function expectEveryProbeDrivesDistinctChange<TState>(options: {
	probes: ProbeLike[];
	probeStateMap: Record<string, TState>;
	serialize: (probeId: string, state: TState) => string;
}): void {
	const { probes, probeStateMap, serialize } = options;
	const seen = new Map<string, string>();
	const collisions: string[] = [];
	for (const probe of probes) {
		const state = probeStateMap[probe.id];
		if (state === undefined) continue;
		const key = serialize(probe.id, state);
		const existing = seen.get(key);
		if (existing !== undefined) {
			collisions.push(
				`probes "${existing}" and "${probe.id}" produce identical visual state ` +
					`(they should each teach a different aspect of the problem)`,
			);
		} else {
			seen.set(key, probe.id);
		}
	}
	expect(
		collisions,
		'each probe must produce a distinct visual change ' +
			'(see .agents/rules/pedagogy.md and design-level skill ' +
			'"Probe Differentiation")',
	).toEqual([]);
}
