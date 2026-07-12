/**
 * Act 3 homework bridge: every Act 3 level ships "now do it for real"
 * exercises against the player's companion Rails project. Commands were
 * verified against canonical docs on 2026-07-12:
 * - `normalizes` (write + finder-query normalization):
 *   https://api.rubyonrails.org/classes/ActiveRecord/Normalization/ClassMethods.html
 * - `Data.define` Result objects: https://docs.ruby-lang.org/en/master/Data.html
 * - `ActiveSupport::Concern` included block:
 *   https://api.rubyonrails.org/classes/ActiveSupport/Concern.html
 * - `bundle add dry-validation`: https://dry-rb.org/gems/dry-validation/
 * - `relation.explain`: https://guides.rubyonrails.org/active_record_querying.html
 * - `rescue_from`: https://guides.rubyonrails.org/action_controller_overview.html#rescue
 */

import { describe, expect, test } from 'bun:test';
import { actThree } from '@/features/act3-clean-architecture/content/act';

describe('Act 3 homework exercises', () => {
	test('every Act 3 level has at least one homework exercise', () => {
		const missing = actThree.levels
			.filter((level) => !level.learningContent.homework?.length)
			.map((level) => level.id);
		expect(missing).toEqual([]);
	});

	test('every exercise has a substantive task and verify text', () => {
		const violations: string[] = [];
		for (const level of actThree.levels) {
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
				actThree.levels.find((l) => l.id === levelId)?.learningContent
					.homework ?? []
			).flatMap((exercise) => exercise.commands ?? []);

		expect(commandsOf('act3-level15-callbacks')).toContain('bin/rails console');
		expect(commandsOf('act3-level16-service-objects')).toContain(
			'result = UserRegistration.call(email_address: "import@example.com", password: SecureRandom.base58(20))',
		);
		expect(commandsOf('act3-level17-concerns')).toContain(
			'bin/rails db:migrate',
		);
		expect(commandsOf('act3-level18-validation-contracts')).toContain(
			'bundle add dry-validation',
		);
		expect(commandsOf('act3-level19-query-objects')).toContain(
			'ProductQuery.new.by_seller(1).sorted.results.explain',
		);
		expect(commandsOf('act3-level20-error-handling')).toContain(
			'curl http://localhost:3000/api/v1/products/999999 -H "Authorization: Bearer <token>"',
		);
	});
});
