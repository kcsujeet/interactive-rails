/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components, lazy-loaded so each level
 * is its own bundle chunk and is only fetched when the player opens it.
 *
 * CURRICULUM STRUCTURE (58 levels, 7 acts):
 *
 * Act 1: The Foundation (L1-L8, 8 levels)
 * - Environment, First Boot, Model, CRUD, Routes, Controller, Serializers, Associations
 *
 * Act 2: Users & Security (L9-L15, 7 levels)
 * - Authentication, Validations, Callbacks, Authorization, Testing, Strong Params, CORS
 *
 * Act 3: Clean Architecture (L16-L22, 7 levels)
 * - Service Objects, Concerns, Validation Contracts, Query Objects, Error Handling, Action Mailer, Background Jobs
 *
 * Act 4: Performance (L23-L31, 9 levels)
 * - N+1 Problem, Eager Loading, Narrow Fetching, Indexing, Counter Caches, Pagination, Search, Caching, HTTP Caching & CDNs
 *
 * Act 5: Advanced Features (L32-L40, 9 levels)
 * - Polymorphic, Transactions, Locking, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning
 *
 * Act 6: Operations (L41-L50, 10 levels)
 * - Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Data Lifecycle, Error Monitoring, Observability, Deployment (Kamal), Feature Flags
 *
 * Act 7: Scale (L51-L58, 8 levels)
 * - Read Replicas, Sharding, Multi-Tenancy, State Machines, Modular Monolith, Domain Events, API Gateway, The Architect (Capstone)
 */

import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

// Shared exports
export * from '@/components/levels';

// Level component props interface
export interface LevelComponentProps {
	onComplete: (data?: {
		stars?: number;
		decisions?: Record<string, string>;
	}) => void;
}

type LevelComponent = ComponentType<LevelComponentProps>;
type LazyLevel = LazyExoticComponent<LevelComponent>;

// Levels expose named exports (e.g. `Level1Environment`), so the dynamic
// import is wrapped to match React.lazy's `default` contract.
function lazyNamed<K extends string>(
	loader: () => Promise<{ [P in K]: LevelComponent }>,
	name: K,
): LazyLevel {
	return lazy(() => loader().then((m) => ({ default: m[name] })));
}

// Level component registry
// Levels not listed here use the generic pipeline builder view
const LEVEL_COMPONENTS: Record<string, LazyLevel> = {
	// (LazyExoticComponent renders identically to ComponentType inside <Suspense>)
	// ============================================
	// Act 1: The Foundation
	// ============================================
	'act1-level1-environment': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-1-environment/Level1Environment'
			),
		'Level1Environment',
	),
	'act1-level2-first-boot': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-2-first-boot/Level2FirstBoot'
			),
		'Level2FirstBoot',
	),
	'act1-level3-model': lazyNamed(
		() =>
			import('@/features/act1-foundation/components/level-3-model/Level3Model'),
		'Level3Model',
	),
	'act1-level4-crud': lazyNamed(
		() =>
			import('@/features/act1-foundation/components/level-4-crud/Level4CRUD'),
		'Level4CRUD',
	),
	'act1-level5-routes': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-5-routes/Level5Routes'
			),
		'Level5Routes',
	),
	'act1-level6-controller': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-6-controller/Level6Controller'
			),
		'Level6Controller',
	),
	'act1-level7-serializers': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-7-serializers/Level7Serializers'
			),
		'Level7Serializers',
	),
	'act1-level8-associations': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-8-associations/Level8Associations'
			),
		'Level8Associations',
	),

	// ============================================
	// Act 2: Users & Security
	// ============================================
	'act2-level9-authentication': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-9-authentication/Level9Authentication'
			),
		'Level9Authentication',
	),
	'act2-level10-validations': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-10-validations/Level10Validations'
			),
		'Level10Validations',
	),
	'act2-level11-callbacks': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-11-callbacks/Level11Callbacks'
			),
		'Level11Callbacks',
	),
	'act2-level12-authorization': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-12-authorization/Level12Authorization'
			),
		'Level12Authorization',
	),
	'act2-level13-testing': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-13-testing/Level13Testing'
			),
		'Level13Testing',
	),
	'act2-level14-strong-params': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-14-strong-params/Level14StrongParams'
			),
		'Level14StrongParams',
	),
	'act2-level15-cors': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-15-cors/Level15CORS'
			),
		'Level15CORS',
	),

	// ============================================
	// Act 3: Clean Architecture
	// ============================================
	'act3-level16-service-objects': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-16-service-objects/Level16ServiceObjects'
			),
		'Level16ServiceObjects',
	),
	'act3-level17-concerns': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-17-concerns/Level17Concerns'
			),
		'Level17Concerns',
	),
	'act3-level18-validation-contracts': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-18-validation-contracts/Level18ValidationContracts'
			),
		'Level18ValidationContracts',
	),
	'act3-level19-query-objects': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-19-query-objects/Level19QueryObjects'
			),
		'Level19QueryObjects',
	),
	'act3-level20-error-handling': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-20-error-handling/Level20ErrorHandling'
			),
		'Level20ErrorHandling',
	),
	'act3-level21-action-mailer': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-21-action-mailer/Level21ActionMailer'
			),
		'Level21ActionMailer',
	),
	'act3-level22-background-jobs': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-22-background-jobs/Level22BackgroundJobs'
			),
		'Level22BackgroundJobs',
	),

	// ============================================
	// Act 4: Performance
	// ============================================
	'act4-level23-n1-problem': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-23-n1-problem/Level23N1Problem'
			),
		'Level23N1Problem',
	),
	'act4-level24-eager-loading': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-24-eager-loading/Level24EagerLoading'
			),
		'Level24EagerLoading',
	),
	'act4-level25-narrow-fetching': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-25-narrow-fetching/Level25NarrowFetching'
			),
		'Level25NarrowFetching',
	),
	'act4-level26-database-indexing': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-26-indexing/Level26Indexing'
			),
		'Level26Indexing',
	),
	'act4-level27-counter-caches': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-27-counter-caches/Level27CounterCaches'
			),
		'Level27CounterCaches',
	),
	'act4-level28-pagination': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-28-pagination/Level28Pagination'
			),
		'Level28Pagination',
	),
	'act4-level29-search': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-29-search/Level29Search'
			),
		'Level29Search',
	),
	'act4-level30-caching': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-30-caching/Level30Caching'
			),
		'Level30Caching',
	),
	'act4-level31-http-caching': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-31-http-caching/Level31HTTPCaching'
			),
		'Level31HTTPCaching',
	),

	// ============================================
	// Act 5: Advanced Features
	// ============================================
	'act5-level32-polymorphic': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-32-polymorphic/Level32Polymorphic'
			),
		'Level32Polymorphic',
	),
	'act5-level33-transactions': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-33-transactions/Level33Transactions'
			),
		'Level33Transactions',
	),
	'act5-level34-locking': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-34-locking/Level34Locking'
			),
		'Level34Locking',
	),
	'act5-level35-active-storage': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-35-active-storage/Level35ActiveStorage'
			),
		'Level35ActiveStorage',
	),
	'act5-level36-encryption': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-36-encryption/Level36Encryption'
			),
		'Level36Encryption',
	),
	'act5-level37-realtime': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-37-real-time/Level37RealTime'
			),
		'Level37RealTime',
	),
	'act5-level38-external-apis': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-38-external-apis/Level38ExternalAPIs'
			),
		'Level38ExternalAPIs',
	),
	'act5-level39-webhooks': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-39-webhooks/Level39Webhooks'
			),
		'Level39Webhooks',
	),
	'act5-level40-api-versioning': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-40-api-versioning/Level40APIVersioning'
			),
		'Level40APIVersioning',
	),

	// ============================================
	// Act 6: Operations
	// ============================================
	'act6-level41-middleware': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-41-middleware/Level41Middleware'
			),
		'Level41Middleware',
	),
	'act6-level42-rate-limiting': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-42-rate-limiting/Level42RateLimiting'
			),
		'Level42RateLimiting',
	),
	'act6-level43-soft-deletes': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-43-soft-deletes/Level43SoftDeletes'
			),
		'Level43SoftDeletes',
	),
	'act6-level44-safe-migrations': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-44-safe-migrations/Level44SafeMigrations'
			),
		'Level44SafeMigrations',
	),
	'act6-level45-recurring-jobs': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-45-recurring-jobs/Level45RecurringJobs'
			),
		'Level45RecurringJobs',
	),
	'act6-level46-data-lifecycle': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-46-data-lifecycle/Level46DataLifecycle'
			),
		'Level46DataLifecycle',
	),
	'act6-level47-error-monitoring': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-47-error-monitoring/Level47ErrorMonitoring'
			),
		'Level47ErrorMonitoring',
	),
	'act6-level48-observability': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-48-observability/Level48Observability'
			),
		'Level48Observability',
	),
	'act6-level49-deployment': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-49-deployment/Level49Deployment'
			),
		'Level49Deployment',
	),
	'act6-level50-feature-flags': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-50-feature-flags/Level50FeatureFlags'
			),
		'Level50FeatureFlags',
	),

	// ============================================
	// Act 7: Scale
	// ============================================
	'act7-level51-multi-database': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-51-multi-database/Level51MultiDatabase'
			),
		'Level51MultiDatabase',
	),
	'act7-level52-sharding': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-52-sharding/Level52Sharding'
			),
		'Level52Sharding',
	),
	'act7-level53-multi-tenancy': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-53-multi-tenancy/Level53MultiTenancy'
			),
		'Level53MultiTenancy',
	),
	'act7-level54-state-machines': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-54-state-machines/Level54StateMachines'
			),
		'Level54StateMachines',
	),
	'act7-level55-modular-monolith': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-55-modular-monolith/Level55ModularMonolith'
			),
		'Level55ModularMonolith',
	),
	'act7-level56-domain-events': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-56-domain-events/Level56DomainEvents'
			),
		'Level56DomainEvents',
	),
	'act7-level57-api-gateway': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-57-api-gateway/Level57APIGateway'
			),
		'Level57APIGateway',
	),
	'act7-level58-architect': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-58-architect/Level58Architect'
			),
		'Level58Architect',
	),
};

/**
 * Get the custom component for a level, or undefined if not found.
 * The returned component is lazy-loaded; render it inside <Suspense>.
 */
export function getLevelComponent(
	levelId: string,
): LazyExoticComponent<ComponentType<LevelComponentProps>> | undefined {
	return LEVEL_COMPONENTS[levelId];
}

/**
 * Check if a level has a custom component.
 */
export function hasCustomComponent(levelId: string): boolean {
	return levelId in LEVEL_COMPONENTS;
}
