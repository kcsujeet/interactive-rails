/**
 * Cross-level reference pinning.
 *
 * Content refers to other levels by number ("L40's middleware", "Act 7,
 * Level 56"). Numbers are the least refactor-safe surface in the
 * curriculum: every reorder silently invalidates them (7 rotted references
 * were found on 2026-07-05, then 8 more the same day). This test pins each
 * file's cross-references to level NAMES; the expected numbers are derived
 * from the acts registry, so renumbering fails here with the exact files
 * to update.
 *
 * Self-references (a file mentioning its own level number) are verified
 * automatically against the file path. Everything else must be declared
 * in CROSS_REFERENCES below. When you add a new cross-reference to
 * content, add the referenced level's NAME here.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { getAllLevels } from '@/lib/acts-registry';

const FEATURES_ROOT = resolve(import.meta.dir, '..', '..', 'features');

// file (relative to src/features) -> names of the levels it references.
const CROSS_REFERENCES: Record<string, string[]> = {
	'act1-foundation/content/level-5-associations.ts': ['The Model'],
	'act1-foundation/content/level-7-controller.ts': ['Error Handling'],
	'act1-foundation/components/level-4-crud/Level4CRUD.tsx': ['The Model'],
	'act1-foundation/components/level-5-associations/Level5Associations.tsx': [
		'The Model',
		'CRUD Operations',
		'Routes & Request Lifecycle',
		'The Controller',
		'Serializers',
	],
	'act1-foundation/components/level-6-routes/Level6Routes.tsx': [
		'First Boot',
		'The Model',
		'CRUD Operations',
	],
	'act1-foundation/components/level-7-controller/Level7Controller.tsx': [
		'First Boot',
		'The Model',
		'Routes & Request Lifecycle',
		'Strong Params',
	],
	'act1-foundation/components/level-8-serializers/Level8Serializers.tsx': [
		'The Model',
		'Routes & Request Lifecycle',
		'The Controller',
	],
	'act2-users-security/content/level-9-authentication.ts': ['First Boot'],
	'act2-users-security/content/level-11-authorization.ts': ['Authentication'],
	'act2-users-security/content/level-13-strong-params.ts': ['The Controller'],
	'act2-users-security/components/level-10-encryption/Level10Encryption.tsx': [
		'Authentication',
		'Validations',
		'Service Objects',
		'Validation Contracts',
		'Active Storage',
	],
	'act2-users-security/components/level-11-authorization/Level11Authorization.tsx':
		['Authentication'],
	'act2-users-security/components/level-12-validations/Level12Validations.tsx':
		['Authentication', 'Encrypted Attributes'],
	'act2-users-security/components/level-13-strong-params/Level13StrongParams.tsx':
		['The Controller', 'Authorization', 'Validations'],
	'act2-users-security/components/level-14-testing/Level14Testing.tsx': [
		'Encrypted Attributes',
		'Authorization',
		'Strong Params',
	],
	'act3-clean-architecture/content/level-18-validation-contracts.ts': [
		'Service Objects',
	],
	'act3-clean-architecture/content/level-20-error-handling.ts': [
		'API Versioning',
	],
	'act3-clean-architecture/components/level-15-callbacks/data/code-files.ts': [
		'Authentication',
		'Encrypted Attributes',
		'Authorization',
		'Strong Params',
	],
	'act3-clean-architecture/components/level-18-validation-contracts/Level18ValidationContracts.tsx':
		['Service Objects'],
	'act4-performance/content/level-22-eager-loading.ts': ['The N+1 Problem'],
	'act4-performance/components/level-22-eager-loading/Level22EagerLoading.tsx':
		['The N+1 Problem'],
	'act4-performance/components/level-27-search/Level27Search.tsx': [
		'Service Objects',
	],
	'act4-performance/components/level-28-caching/Level28Caching.tsx': [
		'HTTP Caching & CDNs',
	],
	'act5-production/content/level-31-soft-deletes.ts': ['Service Objects'],
	'act5-production/content/level-33-locking.ts': ['Transactions'],
	'act5-production/content/level-36-background-jobs.ts': ['Action Mailer'],
	'act5-production/components/level-32-transactions/Level32Transactions.tsx': [
		'Validation Contracts',
	],
	'act5-production/components/level-33-locking/Level33Locking.tsx': [
		'Validation Contracts',
	],
	'act5-production/components/level-34-active-storage/Level34ActiveStorage.tsx':
		['Validation Contracts'],
	'act5-production/components/level-30-polymorphic/Level30Polymorphic.tsx': [
		'Validation Contracts',
	],
	'act5-production/components/level-39-webhooks/Level39Webhooks.tsx': [
		'External APIs',
	],
	'act6-operations/content/level-44-recurring-jobs.ts': ['Background Jobs'],
	'act6-operations/content/level-45-data-lifecycle.ts': ['Safe Migrations'],
	'act6-operations/components/level-45-data-lifecycle/Level45DataLifecycle.tsx':
		['Recurring Jobs & Scheduling', 'Safe Migrations'],
	'act6-operations/content/level-46-error-monitoring.ts': [
		'Middleware & Rack',
		'Observability',
	],
	'act6-operations/components/level-42-rate-limiting/Level42RateLimiting.tsx': [
		'Middleware & Rack',
	],
	'act6-operations/components/level-44-recurring-jobs/Level44RecurringJobs.tsx':
		['Background Jobs'],
	'act6-operations/components/level-46-error-monitoring/Level46ErrorMonitoring.tsx':
		['Middleware & Rack', 'Recurring Jobs & Scheduling'],
	'act6-operations/components/level-48-api-versioning/Level48APIVersioning.tsx':
		[
			'Routes & Request Lifecycle',
			'Service Objects',
			'External APIs',
			'Webhooks & Idempotency',
		],
	'act6-operations/components/level-49-deployment/data/content.ts': [
		'Safe Migrations',
	],
	'act6-operations/components/level-49-deployment/data/stress-scenarios.ts': [
		'Observability',
	],
	'act6-operations/components/level-50-feature-flags/data/content.ts': [
		'Structured Error Monitoring',
		'Observability',
		'Deployment',
	],
	'act6-operations/components/level-50-feature-flags/data/probes.ts': [
		'Deployment',
	],
	'act7-scale/content/level-52-multi-tenancy.ts': ['Observability'],
	'act7-scale/content/level-53-sharding.ts': [
		'Multi-Tenancy',
		'Multi-Database',
	],
	'act7-scale/components/level-53-sharding/Level53Sharding.tsx': [
		'Multi-Database',
	],
	'act7-scale/content/level-57-api-gateway.ts': [
		'Authentication',
		'Structured Error Monitoring',
		'Modular Monolith',
	],
	'act7-scale/components/level-57-api-gateway/Level57APIGateway.tsx': [
		'Authentication',
		'Modular Monolith',
	],
	'act7-scale/content/level-58-architect.ts': [
		'Feature Flags & Staged Rollouts',
		'Multi-Database',
		'Database Sharding',
		'Multi-Tenancy',
		'State Machines',
		'Modular Monolith',
		'Domain Events & Decoupling',
		'API Gateway',
		'Observability',
	],
	'act7-scale/components/level-54-state-machines/Level54StateMachines.tsx': [
		'Soft Deletes & Audit Trails',
	],
	'act7-scale/components/level-58-architect/Level58Architect.tsx': [
		'Deployment',
		'Multi-Database',
		'State Machines',
		'Modular Monolith',
		'Domain Events & Decoupling',
		'API Gateway',
	],
};

// Tokens that look like level references but are not. Keyed by file;
// values are the matched numbers to skip.
const NOT_A_LEVEL: Record<string, number[]> = {
	// "PCI Level 1" is a compliance tier.
	'act2-users-security/content/level-10-encryption.ts': [1],
};

const TOKEN = /\bL(\d{1,2})\b|\bLevel (\d{1,2})\b/g;
const ACT_LEVEL_PAIR = /\bAct (\d), Level (\d{1,2})\b/g;
const OWN_LEVEL = /level-(\d{1,2})\b/;

function contentFiles(): string[] {
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) {
				if (entry !== '__tests__') walk(path);
			} else if (/\.(ts|tsx)$/.test(entry) && !entry.includes('.test.')) {
				files.push(path);
			}
		}
	};
	walk(FEATURES_ROOT);
	return files;
}

const levelNumberByName = new Map(
	getAllLevels().map((level) => [level.name, level.levelNumber]),
);
const levelByNumber = new Map(
	getAllLevels().map((level) => [level.levelNumber, level]),
);

describe('cross-level number references', () => {
	test('every cross-reference points at the pinned level', () => {
		const violations: string[] = [];
		const seenMapEntries = new Set<string>();

		for (const path of contentFiles()) {
			const rel = relative(FEATURES_ROOT, path);
			const source = readFileSync(path, 'utf8');
			const own = Number(OWN_LEVEL.exec(rel)?.[1] ?? -1);
			const ignored = new Set(NOT_A_LEVEL[rel] ?? []);

			const found = new Set<number>();
			for (const match of source.matchAll(TOKEN)) {
				const n = Number(match[1] ?? match[2]);
				if (n !== own && !ignored.has(n)) found.add(n);
			}
			if (found.size === 0) continue;

			const pinnedNames = CROSS_REFERENCES[rel];
			if (!pinnedNames) {
				violations.push(
					`${rel}: references L${[...found].sort((a, b) => a - b).join(', L')} but has no CROSS_REFERENCES entry`,
				);
				continue;
			}
			seenMapEntries.add(rel);

			const expected = new Set(
				pinnedNames.map((name) => {
					const n = levelNumberByName.get(name);
					if (n === undefined) {
						throw new Error(`CROSS_REFERENCES names unknown level "${name}"`);
					}
					return n;
				}),
			);
			for (const n of found) {
				if (!expected.has(n)) {
					violations.push(
						`${rel}: references L${n} (${levelByNumber.get(n)?.name ?? 'no such level'}) which is not pinned for this file`,
					);
				}
			}
			for (const n of expected) {
				if (!found.has(n)) {
					violations.push(
						`${rel}: pinned to reference L${n} (${levelByNumber.get(n)?.name}) but no such reference exists`,
					);
				}
			}
		}

		for (const rel of Object.keys(CROSS_REFERENCES)) {
			if (!seenMapEntries.has(rel)) {
				violations.push(`stale CROSS_REFERENCES entry: ${rel}`);
			}
		}

		expect(violations).toEqual([]);
	});

	test('every "Act X, Level Y" pair is internally consistent', () => {
		const violations: string[] = [];
		for (const path of contentFiles()) {
			const rel = relative(FEATURES_ROOT, path);
			const source = readFileSync(path, 'utf8');
			for (const match of source.matchAll(ACT_LEVEL_PAIR)) {
				const act = Number(match[1]);
				const levelNumber = Number(match[2]);
				const level = levelByNumber.get(levelNumber);
				if (!level) {
					violations.push(
						`${rel}: "Act ${act}, Level ${levelNumber}" (no such level)`,
					);
				} else if (level.actId !== act) {
					violations.push(
						`${rel}: "Act ${act}, Level ${levelNumber}" but ${level.name} is in Act ${level.actId}`,
					);
				}
			}
		}
		expect(violations).toEqual([]);
	});
});
