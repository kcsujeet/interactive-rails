/**
 * Act 7 homework bridge: every Act 7 level ships "now do it for real"
 * exercises against the player's companion Rails project. Heavy
 * infrastructure levels (multi-database, sharding, capstone) scale down
 * to laptop-sized versions: a same-database replica entry, two local
 * PostgreSQL shard databases, a written design plus a second local Rails
 * app. Commands were verified against canonical docs on 2026-07-12:
 * - connects_to / connected_to roles and shards:
 *   https://guides.rubyonrails.org/active_record_multiple_databases.html
 * - acts_as_tenant: https://github.com/ErwinM/acts_as_tenant
 * - AASM: https://github.com/aasm/aasm
 * - Packwerk (bundle add + binstub, init, check):
 *   https://github.com/Shopify/packwerk
 * - Wisper: https://github.com/krisleech/wisper
 * - rails new --api: https://guides.rubyonrails.org/api_app.html
 */

import { describe, expect, test } from 'bun:test';
import { actSeven } from '@/features/act7-scale/content/act';

describe('Act 7 homework exercises', () => {
	test('every Act 7 level has at least one homework exercise', () => {
		const missing = actSeven.levels
			.filter((level) => !level.learningContent.homework?.length)
			.map((level) => level.id);
		expect(missing).toEqual([]);
	});

	test('every exercise has a substantive task and verify text', () => {
		const violations: string[] = [];
		for (const level of actSeven.levels) {
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
				actSeven.levels.find((l) => l.id === levelId)?.learningContent
					.homework ?? []
			).flatMap((exercise) => exercise.commands ?? []);

		expect(commandsOf('act7-level52-multi-tenancy')).toContain(
			'bundle add acts_as_tenant',
		);
		expect(commandsOf('act7-level54-state-machines')).toContain(
			'bundle add aasm',
		);
		expect(commandsOf('act7-level55-modular-monolith')).toContain(
			'bundle add packwerk && bundle binstub packwerk',
		);
		expect(commandsOf('act7-level55-modular-monolith')).toContain(
			'bin/packwerk init',
		);
		expect(commandsOf('act7-level56-domain-events')).toContain(
			'bundle add wisper',
		);
		expect(commandsOf('act7-level58-architect')).toContain(
			'rails new billing_service --api --database=postgresql',
		);
	});

	test('L54 never reinstalls PaperTrail (already installed by the audit work)', () => {
		const level54 = actSeven.levels.find(
			(l) => l.id === 'act7-level54-state-machines',
		);
		const allCommands = (level54?.learningContent.homework ?? [])
			.flatMap((exercise) => exercise.commands ?? [])
			.join(' ');
		expect(allCommands).not.toContain('paper_trail');
	});
});
