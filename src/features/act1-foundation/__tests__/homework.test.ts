/**
 * Act 1 homework bridge: every Act 1 level ships "now do it for real"
 * exercises against the player's companion Rails project. Commands were
 * verified against canonical docs on 2026-07-05:
 * - mise install / `mise use`: https://mise.jdx.dev/installing-mise.html,
 *   https://mise.jdx.dev/getting-started.html
 * - `rails new --api`: https://guides.rubyonrails.org/api_app.html
 * - generate model / db:migrate / console / routes -g:
 *   https://guides.rubyonrails.org/command_line.html
 * - `rails g serializer`: https://github.com/jsonapi-serializer/jsonapi-serializer
 */

import { describe, expect, test } from 'bun:test';
import { actOne } from '@/features/act1-foundation/content/act';

describe('Act 1 homework exercises', () => {
	test('every Act 1 level has at least one homework exercise', () => {
		const missing = actOne.levels
			.filter((level) => !level.learningContent.homework?.length)
			.map((level) => level.id);
		expect(missing).toEqual([]);
	});

	test('every exercise has a substantive task and verify text', () => {
		const violations: string[] = [];
		for (const level of actOne.levels) {
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
				actOne.levels.find((l) => l.id === levelId)?.learningContent.homework ??
				[]
			).flatMap((exercise) => exercise.commands ?? []);

		expect(commandsOf('act1-level1-environment')).toContain(
			'brew install mise',
		);
		expect(commandsOf('act1-level2-first-boot')).toContain(
			'rails new store_api --api',
		);
		expect(commandsOf('act1-level3-model')).toContain(
			'bin/rails generate model Product name:string description:text price:decimal',
		);
		expect(commandsOf('act1-level4-crud')).toContain('bin/rails console');
		expect(commandsOf('act1-level6-routes')).toContain(
			'bin/rails routes -g products',
		);
		expect(commandsOf('act1-level8-serializers')).toContain(
			'bin/rails g serializer Product name price',
		);
	});
});
