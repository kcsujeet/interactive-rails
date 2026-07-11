/**
 * Level 53: Sharding. Deep-pass pins (2026-07-11).
 *
 * Audit findings pinned here:
 *   - Probes 2-4 were unexplained DBA artifacts (dead tuples, TX
 *     wraparound) with no customer damage. Every probe story must now
 *     end on customer-visible harm, in plain English. The wraparound
 *     claim matches the PostgreSQL docs: near wraparound the database
 *     refuses operations that assign new XIDs (writes fail, reads
 *     continue), it does not merely "get slow".
 *   - The "wrong shard" reward scenario was impossible with the
 *     deterministic resolver the player builds (company_id % 3 cannot
 *     route to the wrong shard). Replaced by the honest failure mode:
 *     a query WITHOUT the shard key cannot be routed and is refused.
 *   - Wrong-option feedback must not name ShardRecord (the correct
 *     answer of the model step).
 */

import { describe, expect, test } from 'bun:test';
import {
	MOVE_ORDER_OPTIONS as MODEL_OPTIONS,
	PROBES,
	REWARD_PROBE_FRAMES,
	STRESS_SCENARIOS,
} from '../components/level-53-sharding/Level53Sharding';

describe('Level 53: probes carry customer damage, not DBA artifacts', () => {
	test('every probe story ends on customer-visible harm', () => {
		const damageMarkers: Record<string, string> = {
			'write-latency': 'checkout',
			'index-rebuild': 'stay slow',
			'backup-fails': 'order history',
			'vacuum-behind': 'refuse',
		};
		for (const probe of PROBES) {
			const marker = damageMarkers[probe.id];
			expect(marker, `unknown probe ${probe.id}`).toBeDefined();
			expect(
				JSON.stringify(probe.story).toLowerCase(),
				`probe "${probe.id}" lacks its damage beat`,
			).toContain(marker);
		}
	});

	test('the wraparound claim matches the PostgreSQL docs (writes refused)', () => {
		const vacuum = PROBES.find((p) => p.id === 'vacuum-behind');
		const text = JSON.stringify(vacuum).toLowerCase();
		// Not "the db shuts down", not "gets slow": writes refused, reads fine.
		expect(text).toContain('refuse');
		expect(text.includes('shuts down')).toBe(false);
	});

	test('jargon is translated: no bare DBA vocabulary without plain English', () => {
		const text = JSON.stringify(PROBES);
		// The bloat figure must be explained in plain terms wherever shown.
		expect(text.toLowerCase()).toContain('wasted space');
	});
});

describe('Level 53: the impossible wrong-shard scenario is gone', () => {
	test('no scenario claims the deterministic resolver routed wrongly', () => {
		const ids = STRESS_SCENARIOS.map((s) => s.id);
		expect(ids.includes('wrong-shard')).toBe(false);
		expect(ids.includes('missing-shard-key')).toBe(true);
	});

	test('the missing-key scenario is blocked and has frames', () => {
		const scenario = STRESS_SCENARIOS.find((s) => s.id === 'missing-shard-key');
		expect(scenario?.expectedResult).toBe('blocked');
		expect(REWARD_PROBE_FRAMES['missing-shard-key']).toBeInstanceOf(Array);
		expect(REWARD_PROBE_FRAMES['wrong-shard']).toBeUndefined();
		const frames = JSON.stringify(
			REWARD_PROBE_FRAMES['missing-shard-key'],
		).toLowerCase();
		expect(frames).toContain('company_id');
	});
});

describe('Level 53: feedback never names the model-step answer', () => {
	test('wrong options do not say ShardRecord', () => {
		for (const option of MODEL_OPTIONS.filter((o) => !o.correct)) {
			expect(
				option.feedback?.includes('ShardRecord'),
				`feedback for "${option.id}" leaks ShardRecord`,
			).toBe(false);
		}
	});
});
