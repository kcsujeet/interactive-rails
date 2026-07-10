/**
 * Level 17: Concerns & Modules. Post-redesign tests (2026-07-10).
 *
 * The redesign replaces the old polymorphic Taggable example (a pre-bake
 * of the polymorphic-associations level, 13 levels early) with Flaggable:
 * flag-count moderation on Product and Review using only concepts taught
 * by L17. Pins guard the audit findings:
 *   - Duplication is DRAMATIZED AS DRIFT, not asserted: Product's copy
 *     auto-hides at 3 flags; Review's copy never got the fix (threshold
 *     5, no auto-hide). The intro shows both.
 *   - Step 1 is no longer a longest-option giveaway: all three options
 *     are full-length concern definitions differing in mechanism.
 *   - No polymorphic vocabulary anywhere (as: :taggable is L30's
 *     concept).
 * Concern shape verified against api.rubyonrails.org/classes/
 * ActiveSupport/Concern.html: included do is for class macros, instance
 * methods live in the module body, prepend fires prepended (not
 * included).
 */

import { describe, expect, test } from 'bun:test';
import {
	expectBuildStepQuality,
	expectScenarioBasics,
	expectStoriesPresent,
} from '@/lib/testing/level-pedagogy';
import { expectEveryProbeDrivesDistinctChange } from '@/lib/testing/probe-pedagogy';
import {
	getCodeFiles,
	OPTION_STEP_CONFIG,
	REWARD_SCENARIO_FRAMES,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../components/level-17-concerns/Level17Concerns';

const previewText = (phase: 'intro' | 'build' | 'reward', step: number) =>
	getCodeFiles(phase, step)
		.map((f) => `${f.filename}\n${f.code}`)
		.join('\n');

const allPreviewCode = () => {
	const chunks: string[] = [];
	for (const phase of ['intro', 'build', 'reward'] as const) {
		for (let step = -1; step <= STEP_DEFS.length; step++) {
			chunks.push(previewText(phase, step));
		}
	}
	return chunks.join('\n');
};

describe('Level 17: no future-concept pre-bake', () => {
	test('polymorphic tagging (the L30 concept) is gone everywhere', () => {
		const all =
			allPreviewCode() +
			JSON.stringify(OPTION_STEP_CONFIG) +
			JSON.stringify(STRESS_SCENARIOS);
		for (const forbidden of [
			'taggable',
			'Taggable',
			'taggings',
			'polymorphic',
			'as: :',
		]) {
			expect(all.includes(forbidden), `level contains "${forbidden}"`).toBe(
				false,
			);
		}
	});

	test('the shared behavior uses only taught concepts', () => {
		const done = previewText('build', STEP_DEFS.length);
		expect(done).toContain('module Flaggable');
		expect(done).toContain('extend ActiveSupport::Concern');
		expect(done).toContain('FLAG_THRESHOLD = 3');
		expect(done).toContain('include Flaggable');
	});
});

describe('Level 17: duplication dramatized as drift', () => {
	test('the intro shows the two copies have diverged', () => {
		const intro = previewText('intro', -1);
		// Product's copy got the fix: threshold 3 + auto-hide.
		expect(intro).toContain('"flags_count >= ?", 3');
		expect(intro).toContain('update!(hidden: true)');
		// Review's copy drifted: threshold 5, and its flag! never auto-hides.
		expect(intro).toContain('"flags_count >= ?", 5');
		const review = intro.slice(intro.indexOf('app/models/review.rb'));
		expect(review.includes('update!(hidden: true)')).toBe(false);
	});

	test('the before-state models are anchored to myapp level-15', () => {
		const intro = previewText('intro', -1);
		expect(intro).toContain('has_many :reviews, dependent: :destroy');
		expect(intro).toContain('normalizes :name');
		expect(intro).toContain('enum :status, draft: "draft"');
		const review = intro.slice(intro.indexOf('app/models/review.rb'));
		expect(review).toContain('belongs_to :product');
	});

	test('the extracted concern keeps the FIXED behavior, killing the drift', () => {
		const concern = getCodeFiles('build', STEP_DEFS.length).find((f) =>
			f.filename.includes('concerns/flaggable.rb'),
		);
		expect(concern).toBeDefined();
		expect(concern?.code).toContain('FLAG_THRESHOLD = 3');
		expect(concern?.code).toContain('update!(hidden: true)');
		expect(concern?.code.includes('>= 5')).toBe(false);
	});

	test('clean models no longer carry any flagging copy', () => {
		const done = getCodeFiles('build', STEP_DEFS.length);
		for (const model of ['product.rb', 'review.rb']) {
			const file = done.find((f) => f.filename.endsWith(model));
			expect(file, `${model} missing from final preview`).toBeDefined();
			expect(file?.code).toContain('include Flaggable');
			expect(file?.code.includes('def flag!')).toBe(false);
			expect(file?.code.includes('scope :visible')).toBe(false);
		}
	});
});

describe('Level 17: build steps', () => {
	test('step defs are the 3-step chain', () => {
		expect(STEP_DEFS.map((s) => s.id)).toEqual([
			'choose-pattern',
			'define-concern',
			'include-concern',
		]);
	});

	test('steps 0-2, exactly three options each, quality rules pass', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([
			0, 1, 2,
		]);
		for (const [index, config] of Object.entries(OPTION_STEP_CONFIG)) {
			expect(config.options.length, `step ${index} option count`).toBe(3);
			expectBuildStepQuality({
				name: `step-${index} (${config.title})`,
				options: config.options,
			});
		}
	});

	test('step 1 is not a longest-option giveaway', () => {
		// The audit finding: the correct option was the visibly longest full
		// concern next to truncated wrongs. All three must now be full-length
		// definitions of comparable size.
		const lengths = OPTION_STEP_CONFIG[1].options.map((o) => o.label.length);
		const min = Math.min(...lengths);
		const max = Math.max(...lengths);
		expect(min).toBeGreaterThan(120);
		expect(max / min).toBeLessThan(1.6);
	});

	test('wrong-option feedback never contains that step answer tokens', () => {
		const stepAnswerTokens: [number, string[]][] = [
			[0, ['ActiveSupport::Concern', 'Concern', 'app/models/concerns']],
			[1, ['module body', 'included do']],
			[2, ['include Flaggable']],
		];
		for (const [index, tokens] of stepAnswerTokens) {
			const config = OPTION_STEP_CONFIG[index];
			for (const option of config.options.filter((o) => !o.correct)) {
				for (const token of tokens) {
					expect(
						option.feedback?.includes(token),
						`step ${index} feedback for "${option.id}" leaks "${token}"`,
					).toBe(false);
				}
			}
		}
	});
});

describe('Level 17: code preview boundaries', () => {
	test('preview while working on step N never contains step N answers', () => {
		const leaks: [number, string[]][] = [
			[0, ['Flaggable', 'app/models/concerns', 'ActiveSupport::Concern']],
			[1, ['included do']],
			[2, ['include Flaggable']],
		];
		for (const [step, tokens] of leaks) {
			const preview = previewText('build', step - 1);
			for (const token of tokens) {
				expect(
					preview.includes(token),
					`working on step ${step}, preview leaks "${token}"`,
				).toBe(false);
			}
		}
	});

	test('preview grows step by step', () => {
		expect(previewText('build', 0)).toContain(
			'app/models/concerns/flaggable.rb',
		);
		expect(previewText('build', 1)).toContain('included do');
		expect(previewText('build', 2)).toContain('include Flaggable');
	});
});

describe('Level 17: interactive reward', () => {
	test('scenario basics and stories', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	test('the drift incident replays with the fix, and reuse is demonstrated', () => {
		const ids = STRESS_SCENARIOS.map((s) => s.id).sort();
		expect(ids).toEqual([
			'browse-hidden',
			'extend-answers',
			'scam-review',
			'tighten-threshold',
		]);
		const blocked = STRESS_SCENARIOS.filter(
			(s) => s.expectedResult === 'blocked',
		).map((s) => s.id);
		expect(blocked).toEqual(['scam-review']);
		// The weekend incident from the intro, replayed with the fix.
		const scam = STRESS_SCENARIOS.find((s) => s.id === 'scam-review');
		expect(scam?.story?.[0].toLowerCase().startsWith('same')).toBe(true);
	});

	test('every scenario has frames; no orphans; all distinct', () => {
		const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				REWARD_SCENARIO_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
		}
		for (const key of Object.keys(REWARD_SCENARIO_FRAMES)) {
			expect(ids.has(key), `frames for "${key}" have no button`).toBe(true);
		}
		expectEveryProbeDrivesDistinctChange({
			probes: STRESS_SCENARIOS,
			probeStateMap: REWARD_SCENARIO_FRAMES,
			serialize: (_id, frames) => JSON.stringify(frames),
		});
	});

	test('the scam-review scenario ends hidden; the threshold change lands once', () => {
		const scam = JSON.stringify(REWARD_SCENARIO_FRAMES['scam-review']);
		expect(scam).toContain('HIDDEN');
		const tighten = JSON.stringify(
			REWARD_SCENARIO_FRAMES['tighten-threshold'],
		).toLowerCase();
		expect(tighten).toContain('one');
	});
});
