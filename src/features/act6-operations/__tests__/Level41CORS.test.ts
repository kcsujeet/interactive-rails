/**
 * Level 41: CORS. Post-redesign tests (2026-07-10).
 *
 * The redesign's core correction is mechanism honesty, verified against
 * MDN's CORS guide and the rack-cors source (cyu/rack-cors lib/rack/cors.rb):
 *   - A simple GET DOES reach Rails; the server does the work and the
 *     BROWSER discards the response when Access-Control-Allow-Origin is
 *     missing. Nothing is "blocked before reaching the app".
 *   - A preflighted request (DELETE) sends OPTIONS first; when the
 *     preflight comes back without permission headers, the real request
 *     is never sent.
 *   - rack-cors answers preflights itself (200, empty body, app never
 *     called) and NEVER blocks actual requests: for a disallowed origin
 *     it just adds no headers and the app still runs.
 * These tests pin those facts into the player-visible strings. They
 * import the component's exported data because wiring cannot be
 * verified from mirrors.
 */

import { describe, expect, test } from 'bun:test';
import {
	expectAllDiscoveriesRequired,
	expectBuildStepQuality,
	expectProbeDiscoveryMapOneToOne,
	expectProbesMatchScenarios,
	expectScenarioBasics,
	expectStoriesPresent,
} from '@/lib/testing/level-pedagogy';
import { expectEveryProbeDrivesDistinctChange } from '@/lib/testing/probe-pedagogy';
import {
	ADD_GEM_COMMANDS,
	DISCOVERY_DEFS,
	getCodeFiles,
	OBSERVE_PROBE_FRAMES,
	OPTION_STEP_CONFIG,
	PROBE_DISCOVERY_MAP,
	PROBES,
	REWARD_PROBE_FRAMES,
	STEP_DEFS,
	STRESS_SCENARIOS,
} from '../components/level-41-cors/Level41CORS';

describe('Level 41: discovery / probe wiring', () => {
	test('all discoveries are required', () => {
		expectAllDiscoveriesRequired({
			discoveries: DISCOVERY_DEFS,
			minRequired: DISCOVERY_DEFS.length,
		});
	});

	test('probe-discovery map is strictly 1:1', () => {
		expectProbeDiscoveryMapOneToOne({
			probes: PROBES,
			discoveries: DISCOVERY_DEFS,
			map: PROBE_DISCOVERY_MAP,
		});
	});

	test('probes tell 3-6 bullet stories', () => {
		expectStoriesPresent({ items: PROBES, kind: 'probe' });
	});

	test('probes never name the fix tool', () => {
		const text = JSON.stringify(PROBES).toLowerCase();
		for (const forbidden of ['rack-cors', 'rack::cors', 'middleware', 'gem']) {
			expect(text.includes(forbidden), `probes mention "${forbidden}"`).toBe(
				false,
			);
		}
	});
});

describe('Level 41: mechanism honesty (browser enforces, server always runs)', () => {
	test('the old lie is gone: nothing claims requests are blocked before the app', () => {
		const text = JSON.stringify({
			PROBES,
			OBSERVE_PROBE_FRAMES,
			STRESS_SCENARIOS,
			REWARD_PROBE_FRAMES,
		}).toLowerCase();
		for (const forbidden of [
			'not reached',
			'blocked before reaching',
			'never reaches your code',
			'request never reaches',
		]) {
			expect(text.includes(forbidden), `level claims "${forbidden}"`).toBe(
				false,
			);
		}
	});

	test('simple GET: the API returns 200 and the browser discards the response', () => {
		const frames = JSON.stringify(OBSERVE_PROBE_FRAMES['fetch-products']);
		expect(frames).toContain('200 OK');
		expect(frames.toLowerCase()).toContain('discard');
		const probe = PROBES.find((p) => p.id === 'fetch-products');
		expect(JSON.stringify(probe?.story).toLowerCase()).toContain('discard');
	});

	test('preflighted DELETE: OPTIONS goes out, fails, and the DELETE is never sent', () => {
		const frames = JSON.stringify(
			OBSERVE_PROBE_FRAMES['preflight-delete'],
		).toLowerCase();
		expect(frames).toContain('options');
		expect(frames).toContain('never sent');
	});

	test('curl: 200 with full data, because only browsers enforce CORS', () => {
		const frames = JSON.stringify(OBSERVE_PROBE_FRAMES['curl-bypass']);
		expect(frames).toContain('200 OK');
	});

	test('reward evil-origin read: the app still runs; the browser withholds', () => {
		const frames = JSON.stringify(REWARD_PROBE_FRAMES['evil-read']);
		expect(frames).toContain('200 OK');
		expect(frames.toLowerCase()).toContain('withhold');
	});

	test('reward preflight: the middleware answers the preflight itself', () => {
		const frames = JSON.stringify(
			REWARD_PROBE_FRAMES['preflight-delete'],
		).toLowerCase();
		expect(frames).toContain('answers the preflight');
	});
});

describe('Level 41: observe visuals', () => {
	test('every probe has frames and drives a distinct animation', () => {
		for (const probe of PROBES) {
			expect(
				OBSERVE_PROBE_FRAMES[probe.id],
				`probe "${probe.id}" has no observe frames`,
			).toBeInstanceOf(Array);
		}
		expectEveryProbeDrivesDistinctChange({
			probes: PROBES,
			probeStateMap: OBSERVE_PROBE_FRAMES,
			serialize: (_id, frames) => JSON.stringify(frames),
		});
	});

	test('every observe probe ends on customer-visible damage', () => {
		const lastFrames = {
			'fetch-products': 'Storefront rendered 0 products',
			'preflight-delete': 'delete button does nothing',
			'curl-bypass': 'all 42 products printed',
		};
		for (const [probeId, expected] of Object.entries(lastFrames)) {
			const frames = OBSERVE_PROBE_FRAMES[probeId] ?? [];
			const last = JSON.stringify(frames[frames.length - 1]);
			expect(last, `probe "${probeId}" final frame`).toContain(expected);
		}
	});

	test('observe frames never show the fix tool (it is not installed yet)', () => {
		const text = JSON.stringify(OBSERVE_PROBE_FRAMES).toLowerCase();
		for (const forbidden of ['rack-cors', 'rack::cors', 'middleware']) {
			expect(
				text.includes(forbidden),
				`observe frames mention "${forbidden}"`,
			).toBe(false);
		}
	});
});

describe('Level 41: probe / scenario pairing and reward wiring', () => {
	test('every probe has a matching reward scenario (same id and label)', () => {
		expectProbesMatchScenarios({ probes: PROBES, scenarios: STRESS_SCENARIOS });
	});

	test('scenario basics and stories', () => {
		expectScenarioBasics({ scenarios: STRESS_SCENARIOS });
		expectStoriesPresent({ items: STRESS_SCENARIOS, kind: 'scenario' });
	});

	test('every scenario has reward frames; no orphans', () => {
		const ids = new Set(STRESS_SCENARIOS.map((s) => s.id));
		for (const scenario of STRESS_SCENARIOS) {
			expect(
				REWARD_PROBE_FRAMES[scenario.id],
				`scenario "${scenario.id}" fires but animates nothing`,
			).toBeInstanceOf(Array);
		}
		for (const key of Object.keys(REWARD_PROBE_FRAMES)) {
			expect(ids.has(key), `frames for "${key}" have no button`).toBe(true);
		}
	});

	test('paired reward stories replay the observe story ("same ...")', () => {
		for (const probe of PROBES) {
			const scenario = STRESS_SCENARIOS.find((s) => s.id === probe.id);
			expect(
				scenario?.story?.[0].toLowerCase().startsWith('same'),
				`scenario "${probe.id}" story must open with the same-actor replay`,
			).toBe(true);
		}
	});

	test('blocked scenarios are the evil-origin extras, allowed are the pairs', () => {
		const blocked = STRESS_SCENARIOS.filter(
			(s) => s.expectedResult === 'blocked',
		).map((s) => s.id);
		expect(blocked.sort()).toEqual(['evil-delete', 'evil-read']);
	});
});

describe('Level 41: build steps', () => {
	test('terminal step: one correct command, wrongs teach, correct not first', () => {
		expectBuildStepQuality({
			name: 'add-gem',
			options: ADD_GEM_COMMANDS.map((c) => ({
				id: c.id,
				label: c.label,
				correct: c.correct,
				feedback: c.feedback,
			})),
		});
	});

	test('option steps are 1-2, three options each, and pass quality rules', () => {
		expect(Object.keys(OPTION_STEP_CONFIG).map(Number).sort()).toEqual([1, 2]);
		for (const [index, config] of Object.entries(OPTION_STEP_CONFIG)) {
			expect(config.options.length, `step ${index} option count`).toBe(3);
			expectBuildStepQuality({
				name: `step-${index} (${config.title})`,
				options: config.options,
			});
		}
	});

	test('methods list matches the Rails-generated cors.rb template', () => {
		// Ground truth: project/myapp/config/initializers/cors.rb (rails new --api).
		const correct = OPTION_STEP_CONFIG[2].options.find((o) => o.correct);
		expect(correct?.label).toBe(
			'methods: [:get, :post, :put, :patch, :delete, :options, :head]',
		);
	});

	test('wrong-option feedback never contains that step answer tokens', () => {
		const stepAnswerTokens: [number, string[]][] = [
			[1, ['localhost:3001', 'origins "http']],
			[2, [':head', ':patch', '[:get, :post']],
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
		// Terminal step: wrong feedback must not name the correct command.
		for (const cmd of ADD_GEM_COMMANDS.filter((c) => !c.correct)) {
			for (const token of ['bundle add', 'Gemfile', 'Bundler', 'bundle ']) {
				expect(
					cmd.feedback?.includes(token),
					`add-gem feedback for "${cmd.id}" leaks "${token}"`,
				).toBe(false);
			}
		}
	});

	test('step defs are the 3-step chain', () => {
		expect(STEP_DEFS.map((s) => s.id)).toEqual([
			'add-gem',
			'configure-origins',
			'allow-methods',
		]);
	});
});

describe('Level 41: code preview boundaries', () => {
	const previewAt = (completedStep: number) =>
		getCodeFiles('build', completedStep)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');

	test('observe preview shows the commented stub without the answer DSL', () => {
		const observe = getCodeFiles('observe', -1)
			.map((f) => `${f.filename}\n${f.code}`)
			.join('\n');
		// The initializer stub exists on disk (rails new --api generated it).
		expect(observe).toContain('config/initializers/cors.rb');
		// But the answer surface stays hidden in observe.
		for (const token of [
			'rack-cors',
			'Rack::Cors',
			'origins',
			'resource',
			'methods:',
			'bundle add',
		]) {
			expect(observe.includes(token), `observe preview leaks "${token}"`).toBe(
				false,
			);
		}
	});

	test('preview while working on step N never contains step N answers', () => {
		const leaks: [number, string[]][] = [
			[0, ['rack-cors']],
			[1, ['origins']],
			[2, [':head', ':patch', ':delete']],
		];
		for (const [step, tokens] of leaks) {
			const preview = previewAt(step - 1);
			for (const token of tokens) {
				expect(
					preview.includes(token),
					`working on step ${step}, preview leaks "${token}"`,
				).toBe(false);
			}
		}
	});

	test('preview grows step by step and ends with the full initializer', () => {
		expect(previewAt(0)).toContain('gem "rack-cors"');
		expect(previewAt(1)).toContain('origins "http://localhost:3001"');
		expect(previewAt(1)).not.toContain(':head');
		const done = previewAt(2);
		expect(done).toContain(
			'methods: [:get, :post, :put, :patch, :delete, :options, :head]',
		);
		expect(done).toContain('insert_before 0, Rack::Cors');
	});
});
