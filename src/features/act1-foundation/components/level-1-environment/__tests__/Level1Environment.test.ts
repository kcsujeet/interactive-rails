/**
 * Tests for Level 1: The Environment.
 *
 * Type 1 (no observe phase): pure terminal-choice setup. No probes, no
 * stress scenarios. Tests focus on build-step quality.
 *
 * Per testing.md: mirror data structures from the component, do not
 * import. If the component data drifts, the test still documents the
 * expected shape.
 *
 * Validates:
 * - Each step has exactly one correct option.
 * - Every wrong option has substantive feedback.
 * - Wrong-option feedback never reveals the correct answer (keyword scan).
 * - Option IDs and labels are unique within each step.
 * - Canonical answers reflect the Rails 8 / mise narrative
 *   (e.g. install Rails uses `gem install rails`, not `brew install rails`).
 */

import { describe, expect, test } from 'bun:test';

// ─────────────────────────────────────────────
// Mirrored data from Level1Environment.tsx
// ─────────────────────────────────────────────

interface OptionShape {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const INSTALL_MISE_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-apt',
		label: 'apt-get install mise',
		correct: false,
		feedback: 'apt-get is a Linux package manager, not available on macOS.',
	},
	{
		id: 'correct',
		label: 'brew install mise',
		correct: true,
	},
	{
		id: 'wrong-npm',
		label: 'npm install -g mise',
		correct: false,
		feedback:
			"mise isn't a Node package. It's a system tool, not an npm module.",
	},
];

const ACTIVATE_MISE_OPTIONS: OptionShape[] = [
	{
		id: 'path-only',
		label: 'export PATH="/opt/homebrew/opt/mise/bin:$PATH"',
		correct: false,
		feedback:
			"Adding the binary to PATH isn't enough. mise needs a shell hook to auto-switch versions when you cd into a project.",
	},
	{
		id: 'wrong-source',
		label: 'source /opt/homebrew/opt/mise/mise.sh',
		correct: false,
		feedback:
			"mise doesn't ship a static shell script to source. Its shell hook is generated dynamically at startup.",
	},
	{
		id: 'correct',
		label: 'eval "$(mise activate zsh)"',
		correct: true,
	},
	{
		id: 'alias',
		label: 'alias mise="/opt/homebrew/bin/mise"',
		correct: false,
		feedback:
			'An alias only gives you the command. mise also needs a shell hook so it can auto-switch Ruby versions per directory.',
	},
];

const MISE_TOML_OPTIONS: OptionShape[] = [
	{
		id: 'yaml',
		label: 'ruby: "3.4.9"',
		correct: false,
		feedback: "That's YAML syntax. TOML uses `=`, not `:`.",
	},
	{
		id: 'tool-versions-style',
		label: 'ruby 3.4.9',
		correct: false,
		feedback:
			"That's the old asdf/.tool-versions format. A .toml file needs proper TOML syntax.",
	},
	{
		id: 'no-section',
		label: 'ruby = "3.4.9"',
		correct: false,
		feedback:
			"Valid TOML, but mise won't treat a bare top-level key as a tool declaration. It needs to live under the right grouping.",
	},
	{
		id: 'correct',
		label: '[tools] > ruby = "3.4.9"',
		correct: true,
	},
];

const INSTALL_RUBY_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-brew',
		label: 'brew install ruby',
		correct: false,
		feedback:
			"A system-installed Ruby won't read .mise.toml. You need the version manager to handle it.",
	},
	{
		id: 'wrong-ruby',
		label: 'ruby install 3.4.9',
		correct: false,
		feedback: "That's not a valid command. Which tool manages your versions?",
	},
	{
		id: 'correct',
		label: 'mise install',
		correct: true,
	},
];

const INSTALL_RAILS_OPTIONS: OptionShape[] = [
	{
		id: 'wrong-npm',
		label: 'npm install rails',
		correct: false,
		feedback:
			'Rails is Ruby, not Node. Think about how Ruby distributes packages.',
	},
	{
		id: 'correct',
		label: 'gem install rails',
		correct: true,
	},
	{
		id: 'wrong-brew',
		label: 'brew install rails',
		correct: false,
		feedback:
			"Rails isn't a system package. It's distributed through Ruby's own ecosystem.",
	},
];

const ALL_STEPS: { name: string; options: OptionShape[] }[] = [
	{ name: 'install-mise', options: INSTALL_MISE_OPTIONS },
	{ name: 'activate-mise', options: ACTIVATE_MISE_OPTIONS },
	{ name: 'mise-toml', options: MISE_TOML_OPTIONS },
	{ name: 'install-ruby', options: INSTALL_RUBY_OPTIONS },
	{ name: 'install-rails', options: INSTALL_RAILS_OPTIONS },
];

// Distinctive substrings of each step's correct answer that must NOT
// appear in the same step's wrong-option feedback (the answer-leak check).
const CORRECT_ANSWER_KEYWORDS: Record<string, string[]> = {
	'install-mise': ['brew install mise'],
	'activate-mise': ['mise activate zsh', 'mise activate'],
	// Step 3 correct = `[tools]\nruby = "3.4.9"`. The literal `[tools]` and
	// the joined `[tools] ruby = ` form must not appear in wrong feedback.
	'mise-toml': ['[tools]'],
	'install-ruby': ['mise install'],
	'install-rails': ['gem install rails'],
};

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Level 1: The Environment — build step quality', () => {
	test('every step has exactly one correct option', () => {
		for (const { name, options } of ALL_STEPS) {
			const correctCount = options.filter((o) => o.correct).length;
			expect(correctCount, `${name}: correct count`).toBe(1);
		}
	});

	test('every wrong option has substantive feedback', () => {
		for (const { name, options } of ALL_STEPS) {
			for (const option of options) {
				if (!option.correct) {
					expect(
						option.feedback,
						`${name}/${option.id}: feedback present`,
					).toBeDefined();
					expect(
						option.feedback?.length ?? 0,
						`${name}/${option.id}: feedback length`,
					).toBeGreaterThan(20);
				}
			}
		}
	});

	test('wrong-option feedback never names the correct answer', () => {
		for (const { name, options } of ALL_STEPS) {
			const keywords = CORRECT_ANSWER_KEYWORDS[name] ?? [];
			for (const option of options) {
				if (!option.correct && option.feedback) {
					for (const keyword of keywords) {
						expect(
							option.feedback,
							`${name}/${option.id}: feedback leaks "${keyword}"`,
						).not.toContain(keyword);
					}
				}
			}
		}
	});

	test('option IDs are unique within each step', () => {
		for (const { name, options } of ALL_STEPS) {
			const ids = options.map((o) => o.id);
			expect(new Set(ids).size, `${name}: id uniqueness`).toBe(ids.length);
		}
	});

	test('option labels are unique within each step', () => {
		for (const { name, options } of ALL_STEPS) {
			const labels = options.map((o) => o.label);
			expect(new Set(labels).size, `${name}: label uniqueness`).toBe(
				labels.length,
			);
		}
	});

	test('every step has at least 2 options', () => {
		for (const { name, options } of ALL_STEPS) {
			expect(options.length, `${name}: option count`).toBeGreaterThanOrEqual(2);
		}
	});
});

describe('Level 1: The Environment — narrative consistency', () => {
	test('install-mise correct answer uses brew (macOS package manager)', () => {
		const correct = INSTALL_MISE_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('brew install mise');
	});

	test('activate-mise correct answer uses the mise activate shell hook', () => {
		const correct = ACTIVATE_MISE_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('mise activate zsh');
		expect(correct?.label).toContain('eval');
	});

	test('mise-toml correct answer uses TOML [tools] section + assignment', () => {
		const correct = MISE_TOML_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toContain('[tools]');
		expect(correct?.label).toContain('ruby = "3.4.9"');
	});

	test('install-ruby correct answer uses mise (the version manager)', () => {
		const correct = INSTALL_RUBY_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('mise install');
	});

	test('install-rails correct answer uses gem install (Ruby ecosystem)', () => {
		const correct = INSTALL_RAILS_OPTIONS.find((o) => o.correct);
		expect(correct?.label).toBe('gem install rails');
		// Cumulative-patterns: Rails ships as a gem, not a system package
		// or npm module. Wrong options must explicitly contrast with that.
		expect(correct?.label).not.toContain('brew');
		expect(correct?.label).not.toContain('npm');
	});
});
