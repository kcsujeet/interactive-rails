/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components, lazy-loaded so each level
 * is its own bundle chunk and is only fetched when the player opens it.
 *
 * CURRICULUM STRUCTURE (58 levels, 7 acts):
 *
 * Act 1: The Foundation (L1-L8, 8 levels)
 * - Environment, First Boot, Model, Associations, CRUD, Routes, Controller, Serializers
 *
 * Act 2: Users & Security (L9-L14, 6 levels)
 * - Authentication, Encryption, Authorization, Validations, Strong Params, Testing
 *
 * Act 3: Clean Architecture (L15-L20, 6 levels)
 * - Callbacks, Service Objects, Concerns, Validation Contracts, Query Objects, Error Handling
 *
 * Act 4: Performance (L21-L29, 9 levels)
 * - N+1 Problem, Eager Loading, Narrow Fetching, Indexing, Counter Caches, Pagination, Search, Caching, HTTP Caching & CDNs
 *
 * Act 5: Advanced Features (L30-L39, 10 levels)
 * - Polymorphic, Soft Deletes, Transactions, Locking, Active Storage, Action Mailer, Background Jobs, Real-Time, External APIs, Webhooks
 *
 * Act 6: Operations (L40-L50, 11 levels)
 * - Middleware, CORS, Rate Limiting, Safe Migrations, Recurring Jobs, Data Lifecycle, Error Monitoring, Observability, API Versioning, Deployment (Kamal), Feature Flags
 *
 * Act 7: Scale (L51-L58, 8 levels)
 * - Read Replicas, Multi-Tenancy, Sharding, State Machines, Modular Monolith, Domain Events, API Gateway, The Architect (Capstone)
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
	'act1-level4-associations': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-4-associations/Level4Associations'
			),
		'Level4Associations',
	),
	'act1-level5-crud': lazyNamed(
		() =>
			import('@/features/act1-foundation/components/level-5-crud/Level5CRUD'),
		'Level5CRUD',
	),
	'act1-level6-routes': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-6-routes/Level6Routes'
			),
		'Level6Routes',
	),
	'act1-level7-controller': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-7-controller/Level7Controller'
			),
		'Level7Controller',
	),
	'act1-level8-serializers': lazyNamed(
		() =>
			import(
				'@/features/act1-foundation/components/level-8-serializers/Level8Serializers'
			),
		'Level8Serializers',
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
	'act2-level10-encryption': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-10-encryption/Level10Encryption'
			),
		'Level10Encryption',
	),
	'act2-level11-authorization': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-11-authorization/Level11Authorization'
			),
		'Level11Authorization',
	),
	'act2-level12-validations': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-12-validations/Level12Validations'
			),
		'Level12Validations',
	),
	'act2-level13-strong-params': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-13-strong-params/Level13StrongParams'
			),
		'Level13StrongParams',
	),
	'act2-level14-testing': lazyNamed(
		() =>
			import(
				'@/features/act2-users-security/components/level-14-testing/Level14Testing'
			),
		'Level14Testing',
	),

	// ============================================
	// Act 3: Clean Architecture
	// ============================================
	'act3-level15-callbacks': lazyNamed(
		() =>
			import(
				'@/features/act3-clean-architecture/components/level-15-callbacks/Level15Callbacks'
			),
		'Level15Callbacks',
	),
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

	// ============================================
	// Act 4: Performance
	// ============================================
	'act4-level21-n1-problem': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-21-n1-problem/Level21N1Problem'
			),
		'Level21N1Problem',
	),
	'act4-level22-eager-loading': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-22-eager-loading/Level22EagerLoading'
			),
		'Level22EagerLoading',
	),
	'act4-level23-narrow-fetching': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-23-narrow-fetching/Level23NarrowFetching'
			),
		'Level23NarrowFetching',
	),
	'act4-level24-indexing': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-24-indexing/Level24Indexing'
			),
		'Level24Indexing',
	),
	'act4-level25-counter-caches': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-25-counter-caches/Level25CounterCaches'
			),
		'Level25CounterCaches',
	),
	'act4-level26-pagination': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-26-pagination/Level26Pagination'
			),
		'Level26Pagination',
	),
	'act4-level27-search': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-27-search/Level27Search'
			),
		'Level27Search',
	),
	'act4-level28-caching': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-28-caching/Level28Caching'
			),
		'Level28Caching',
	),
	'act4-level29-http-caching': lazyNamed(
		() =>
			import(
				'@/features/act4-performance/components/level-29-http-caching/Level29HTTPCaching'
			),
		'Level29HTTPCaching',
	),

	// ============================================
	// Act 5: Advanced Features
	// ============================================
	'act5-level30-polymorphic': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-30-polymorphic/Level30Polymorphic'
			),
		'Level30Polymorphic',
	),
	'act5-level31-soft-deletes': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-31-soft-deletes/Level31SoftDeletes'
			),
		'Level31SoftDeletes',
	),
	'act5-level32-transactions': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-32-transactions/Level32Transactions'
			),
		'Level32Transactions',
	),
	'act5-level33-locking': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-33-locking/Level33Locking'
			),
		'Level33Locking',
	),
	'act5-level34-active-storage': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-34-active-storage/Level34ActiveStorage'
			),
		'Level34ActiveStorage',
	),
	'act5-level35-action-mailer': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-35-action-mailer/Level35ActionMailer'
			),
		'Level35ActionMailer',
	),
	'act5-level36-background-jobs': lazyNamed(
		() =>
			import(
				'@/features/act5-production/components/level-36-background-jobs/Level36BackgroundJobs'
			),
		'Level36BackgroundJobs',
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

	// ============================================
	// Act 6: Operations
	// ============================================
	'act6-level40-middleware': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-40-middleware/Level40Middleware'
			),
		'Level40Middleware',
	),
	'act6-level41-cors': lazyNamed(
		() =>
			import('@/features/act6-operations/components/level-41-cors/Level41CORS'),
		'Level41CORS',
	),
	'act6-level42-rate-limiting': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-42-rate-limiting/Level42RateLimiting'
			),
		'Level42RateLimiting',
	),
	'act6-level43-safe-migrations': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-43-safe-migrations/Level43SafeMigrations'
			),
		'Level43SafeMigrations',
	),
	'act6-level44-recurring-jobs': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-44-recurring-jobs/Level44RecurringJobs'
			),
		'Level44RecurringJobs',
	),
	'act6-level45-data-lifecycle': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-45-data-lifecycle/Level45DataLifecycle'
			),
		'Level45DataLifecycle',
	),
	'act6-level46-error-monitoring': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-46-error-monitoring/Level46ErrorMonitoring'
			),
		'Level46ErrorMonitoring',
	),
	'act6-level47-observability': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-47-observability/Level47Observability'
			),
		'Level47Observability',
	),
	'act6-level48-api-versioning': lazyNamed(
		() =>
			import(
				'@/features/act6-operations/components/level-48-api-versioning/Level48APIVersioning'
			),
		'Level48APIVersioning',
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
	'act7-level52-multi-tenancy': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-52-multi-tenancy/Level52MultiTenancy'
			),
		'Level52MultiTenancy',
	),
	'act7-level53-sharding': lazyNamed(
		() =>
			import(
				'@/features/act7-scale/components/level-53-sharding/Level53Sharding'
			),
		'Level53Sharding',
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
