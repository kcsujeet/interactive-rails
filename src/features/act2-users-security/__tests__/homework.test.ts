/**
 * Act 2 homework bridge: every Act 2 level ships "now do it for real"
 * exercises against the player's companion Rails project. Commands were
 * verified against canonical docs on 2026-07-12:
 * - `bin/rails generate authentication`:
 *   https://guides.rubyonrails.org/8_0_release_notes.html
 * - `bin/rails db:encryption:init` / `credentials:edit`:
 *   https://guides.rubyonrails.org/active_record_encryption.html
 * - `bundle add pundit` / `rails generate pundit:install`:
 *   https://github.com/varvet/pundit
 * - `bundle add rspec-rails` / `rails generate rspec:install`:
 *   https://github.com/rspec/rspec-rails
 * - factory_bot_rails setup:
 *   https://github.com/thoughtbot/factory_bot_rails
 */

import { describe, expect, test } from 'bun:test';
import { actTwo } from '@/features/act2-users-security/content/act';

describe('Act 2 homework exercises', () => {
	test('every Act 2 level has at least one homework exercise', () => {
		const missing = actTwo.levels
			.filter((level) => !level.learningContent.homework?.length)
			.map((level) => level.id);
		expect(missing).toEqual([]);
	});

	test('every exercise has a substantive task and verify text', () => {
		const violations: string[] = [];
		for (const level of actTwo.levels) {
			for (const exercise of level.learningContent.homework ?? []) {
				if (exercise.task.trim().length < 20) {
					violations.push(`${level.id}: task too thin: "${exercise.task}"`);
				}
				if (exercise.verify.trim().length < 20) {
					violations.push(`${level.id}: verify too thin: "${exercise.verify}"`);
				}
				if (exercise.commands && exercise.commands.length === 0) {
					violations.push(`${level.id}: empty commands array`);
				}
			}
		}
		expect(violations).toEqual([]);
	});

	test('doc-verified anchor commands appear where the level teaches them', () => {
		const commandsOf = (levelId: string) =>
			(
				actTwo.levels.find((l) => l.id === levelId)?.learningContent.homework ??
				[]
			).flatMap((exercise) => exercise.commands ?? []);

		expect(commandsOf('act2-level9-authentication')).toContain(
			'bin/rails generate authentication',
		);
		expect(commandsOf('act2-level10-encryption')).toContain(
			'bin/rails db:encryption:init',
		);
		expect(commandsOf('act2-level11-authorization')).toContain(
			'bundle add pundit',
		);
		expect(commandsOf('act2-level11-authorization')).toContain(
			'rails generate pundit:install',
		);
		expect(commandsOf('act2-level14-testing')).toContain(
			'bundle add rspec-rails --group "development, test"',
		);
		expect(commandsOf('act2-level14-testing')).toContain(
			'bin/rails generate rspec:install',
		);
	});
});
