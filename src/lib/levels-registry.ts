/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 * Levels without a custom component use the generic pipeline builder.
 *
 * CURRICULUM STRUCTURE (58 levels, 8 acts):
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
 * Act 6: Operations (L41-L49, 9 levels)
 * - Middleware, Deployment (Kamal), Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Data Lifecycle, Error Monitoring, Feature Flags
 *
 * Act 7: Scale (L50-L55, 6 levels)
 * - Multi-Database, State Machines, Multi-Tenancy, Observability, Modular Monolith, Domain Events
 *
 * Act 8: Mastery (L56-L58, 3 levels)
 * - API Gateway, Database Sharding, The Architect (Capstone)
 */

import type { ComponentType } from 'react';

// Shared exports
export * from '@/components/levels';

// Level component props interface
export interface LevelComponentProps {
	onComplete: (data?: {
		stars?: number;
		decisions?: Record<string, string>;
	}) => void;
}

// ===========================================
// Act 1: The Foundation (Levels 1-8)
// ===========================================
import { Level1Environment } from '@/features/act1-foundation/components/level-1-environment/Level1Environment';
import { Level2FirstBoot } from '@/features/act1-foundation/components/level-2-first-boot/Level2FirstBoot';
import { Level3Model } from '@/features/act1-foundation/components/level-3-model/Level3Model';
import { Level4CRUD } from '@/features/act1-foundation/components/level-4-crud/Level4CRUD';
import { Level5Routes } from '@/features/act1-foundation/components/level-5-routes/Level5Routes';
import { Level6Controller } from '@/features/act1-foundation/components/level-6-controller/Level6Controller';
import { Level7Serializers } from '@/features/act1-foundation/components/level-7-serializers/Level7Serializers';
import { Level8Associations } from '@/features/act1-foundation/components/level-8-associations/Level8Associations';

// ===========================================
// Act 2: Users & Security (Levels 9-15)
// ===========================================
import { Level9Authentication } from '@/features/act2-users-security/components/level-9-authentication/Level9Authentication';
import { Level10Validations } from '@/features/act2-users-security/components/level-10-validations/Level10Validations';
import { Level11Callbacks } from '@/features/act2-users-security/components/level-11-callbacks/Level11Callbacks';
import { Level12Authorization } from '@/features/act2-users-security/components/level-12-authorization/Level12Authorization';
import { Level13Testing } from '@/features/act2-users-security/components/level-13-testing/Level13Testing';
import { Level14StrongParams } from '@/features/act2-users-security/components/level-14-strong-params/Level14StrongParams';
import { Level15CORS } from '@/features/act2-users-security/components/level-15-cors/Level15CORS';

// ===========================================
// Act 3: Clean Architecture (Levels 16-22)
// ===========================================
import { Level16ServiceObjects } from '@/features/act3-clean-architecture/components/level-16-service-objects/Level16ServiceObjects';
import { Level17Concerns } from '@/features/act3-clean-architecture/components/level-17-concerns/Level17Concerns';
import { Level18ValidationContracts } from '@/features/act3-clean-architecture/components/level-18-validation-contracts/Level18ValidationContracts';
import { Level19QueryObjects } from '@/features/act3-clean-architecture/components/level-19-query-objects/Level19QueryObjects';
import { Level20ErrorHandling } from '@/features/act3-clean-architecture/components/level-20-error-handling/Level20ErrorHandling';
import { Level21ActionMailer } from '@/features/act3-clean-architecture/components/level-21-action-mailer/Level21ActionMailer';
import { Level22BackgroundJobs } from '@/features/act3-clean-architecture/components/level-22-background-jobs/Level22BackgroundJobs';

// ===========================================
// Act 4: Performance (Levels 23-31)
// ===========================================
import { Level23N1Problem } from '@/features/act4-performance/components/level-23-n1-problem/Level23N1Problem';
import { Level24EagerLoading } from '@/features/act4-performance/components/level-24-eager-loading/Level24EagerLoading';
import { Level25NarrowFetching } from '@/features/act4-performance/components/level-25-narrow-fetching/Level25NarrowFetching';
import { Level26Indexing } from '@/features/act4-performance/components/level-26-indexing/Level26Indexing';
import { Level27CounterCaches } from '@/features/act4-performance/components/level-27-counter-caches/Level27CounterCaches';
import { Level28Pagination } from '@/features/act4-performance/components/level-28-pagination/Level28Pagination';
import { Level29Search } from '@/features/act4-performance/components/level-29-search/Level29Search';
import { Level30Caching } from '@/features/act4-performance/components/level-30-caching/Level30Caching';
import { Level31HTTPCaching } from '@/features/act4-performance/components/level-31-http-caching/Level31HTTPCaching';

// ===========================================
// Act 5: Advanced Features (Levels 32-40)
// ===========================================
import { Level32Polymorphic } from '@/features/act5-production/components/level-32-polymorphic/Level32Polymorphic';
import { Level33Transactions } from '@/features/act5-production/components/level-33-transactions/Level33Transactions';
import { Level34Locking } from '@/features/act5-production/components/level-34-locking/Level34Locking';
import { Level35ActiveStorage } from '@/features/act5-production/components/level-35-active-storage/Level35ActiveStorage';
import { Level36Encryption } from '@/features/act5-production/components/level-36-encryption/Level36Encryption';
import { Level37RealTime } from '@/features/act5-production/components/level-37-real-time/Level37RealTime';
import { Level38ExternalAPIs } from '@/features/act5-production/components/level-38-external-apis/Level38ExternalAPIs';
import { Level39Webhooks } from '@/features/act5-production/components/level-39-webhooks/Level39Webhooks';
import { Level40APIVersioning } from '@/features/act5-production/components/level-40-api-versioning/Level40APIVersioning';

// ===========================================
// Act 6: Operations (Levels 41-49)
// ===========================================
import { Level41Middleware } from '@/features/act6-operations/components/level-41-middleware/Level41Middleware';
import { Level42Deployment } from '@/features/act6-operations/components/level-42-deployment/Level42Deployment';
import { Level43RateLimiting } from '@/features/act6-operations/components/level-43-rate-limiting/Level43RateLimiting';
import { Level44SoftDeletes } from '@/features/act6-operations/components/level-44-soft-deletes/Level44SoftDeletes';
import { Level45SafeMigrations } from '@/features/act6-operations/components/level-45-safe-migrations/Level45SafeMigrations';
import { Level46RecurringJobs } from '@/features/act6-operations/components/level-46-recurring-jobs/Level46RecurringJobs';
import { Level47DataLifecycle } from '@/features/act6-operations/components/level-47-data-lifecycle/Level47DataLifecycle';
import { Level48ErrorMonitoring } from '@/features/act6-operations/components/level-48-error-monitoring/Level48ErrorMonitoring';
import { Level49FeatureFlags } from '@/features/act6-operations/components/level-49-feature-flags/Level49FeatureFlags';

// ===========================================
// Act 7: Scale (Levels 50-55)
// ===========================================
import { Level50MultiDatabase } from '@/features/act7-scale/components/level-50-multi-database/Level50MultiDatabase';
import { Level51StateMachines } from '@/features/act7-scale/components/level-51-state-machines/Level51StateMachines';
import { Level52MultiTenancy } from '@/features/act7-scale/components/level-52-multi-tenancy/Level52MultiTenancy';
import { Level53Observability } from '@/features/act7-scale/components/level-53-observability/Level53Observability';
import { Level54ModularMonolith } from '@/features/act7-scale/components/level-54-modular-monolith/Level54ModularMonolith';
import { Level55DomainEvents } from '@/features/act7-scale/components/level-55-domain-events/Level55DomainEvents';

// ===========================================
// Act 8: Mastery (Levels 56-58)
// ===========================================
import { Level56APIGateway } from '@/features/act8-mastery/components/level-56-api-gateway/Level56APIGateway';
import { Level57Sharding } from '@/features/act8-mastery/components/level-57-sharding/Level57Sharding';
import { Level58Architect } from '@/features/act8-mastery/components/level-58-architect/Level58Architect';

// Level component registry
// Levels not listed here use the generic pipeline builder view
const LEVEL_COMPONENTS: Record<string, ComponentType<LevelComponentProps>> = {
	// ============================================
	// Act 1: The Foundation
	// ============================================
	'act1-level1-environment': Level1Environment,
	'act1-level2-first-boot': Level2FirstBoot,
	'act1-level3-model': Level3Model,
	'act1-level4-crud': Level4CRUD,
	'act1-level5-routes': Level5Routes,
	'act1-level6-controller': Level6Controller,
	'act1-level7-serializers': Level7Serializers,
	'act1-level8-associations': Level8Associations,

	// ============================================
	// Act 2: Users & Security
	// ============================================
	'act2-level9-authentication': Level9Authentication,
	'act2-level10-validations': Level10Validations,
	'act2-level11-callbacks': Level11Callbacks,
	'act2-level12-authorization': Level12Authorization,
	'act2-level13-testing': Level13Testing,
	'act2-level14-strong-params': Level14StrongParams,
	'act2-level15-cors': Level15CORS,

	// ============================================
	// Act 3: Clean Architecture
	// ============================================
	'act3-level16-service-objects': Level16ServiceObjects,
	'act3-level17-concerns': Level17Concerns,
	'act3-level18-validation-contracts': Level18ValidationContracts,
	'act3-level19-query-objects': Level19QueryObjects,
	'act3-level20-error-handling': Level20ErrorHandling,
	'act3-level21-action-mailer': Level21ActionMailer,
	'act3-level22-background-jobs': Level22BackgroundJobs,

	// ============================================
	// Act 4: Performance
	// ============================================
	'act4-level23-n1-problem': Level23N1Problem,
	'act4-level24-eager-loading': Level24EagerLoading,
	'act4-level25-narrow-fetching': Level25NarrowFetching,
	'act4-level26-database-indexing': Level26Indexing,
	'act4-level27-counter-caches': Level27CounterCaches,
	'act4-level28-pagination': Level28Pagination,
	'act4-level29-search': Level29Search,
	'act4-level30-caching': Level30Caching,
	'act4-level31-http-caching': Level31HTTPCaching,

	// ============================================
	// Act 5: Advanced Features
	// ============================================
	'act5-level32-polymorphic': Level32Polymorphic,
	'act5-level33-transactions': Level33Transactions,
	'act5-level34-locking': Level34Locking,
	'act5-level35-active-storage': Level35ActiveStorage,
	'act5-level36-encryption': Level36Encryption,
	'act5-level37-realtime': Level37RealTime,
	'act5-level38-external-apis': Level38ExternalAPIs,
	'act5-level39-webhooks': Level39Webhooks,
	'act5-level40-api-versioning': Level40APIVersioning,

	// ============================================
	// Act 6: Operations
	// ============================================
	'act6-level41-middleware': Level41Middleware,
	'act6-level42-deployment': Level42Deployment,
	'act6-level43-rate-limiting': Level43RateLimiting,
	'act6-level44-soft-deletes': Level44SoftDeletes,
	'act6-level45-safe-migrations': Level45SafeMigrations,
	'act6-level46-recurring-jobs': Level46RecurringJobs,
	'act6-level47-data-lifecycle': Level47DataLifecycle,
	'act6-level48-error-monitoring': Level48ErrorMonitoring,
	'act6-level49-feature-flags': Level49FeatureFlags,

	// ============================================
	// Act 7: Scale
	// ============================================
	'act7-level50-multi-database': Level50MultiDatabase,
	'act7-level51-state-machines': Level51StateMachines,
	'act7-level52-multi-tenancy': Level52MultiTenancy,
	'act7-level53-observability': Level53Observability,
	'act7-level54-modular-monolith': Level54ModularMonolith,
	'act7-level55-domain-events': Level55DomainEvents,

	// ============================================
	// Act 8: Mastery
	// ============================================
	'act8-level56-api-gateway': Level56APIGateway,
	'act8-level57-sharding': Level57Sharding,
	'act8-level58-architect': Level58Architect,
};

/**
 * Get the custom component for a level, or undefined if not found.
 */
export function getLevelComponent(
	levelId: string,
): ComponentType<LevelComponentProps> | undefined {
	return LEVEL_COMPONENTS[levelId];
}

/**
 * Check if a level has a custom component.
 */
export function hasCustomComponent(levelId: string): boolean {
	return levelId in LEVEL_COMPONENTS;
}

// Re-export Act 1 level components for direct import
export { Level1Environment } from '@/features/act1-foundation/components/level-1-environment/Level1Environment';
export { Level2FirstBoot } from '@/features/act1-foundation/components/level-2-first-boot/Level2FirstBoot';
export { Level3Model } from '@/features/act1-foundation/components/level-3-model/Level3Model';
export { Level4CRUD } from '@/features/act1-foundation/components/level-4-crud/Level4CRUD';
export { Level5Routes } from '@/features/act1-foundation/components/level-5-routes/Level5Routes';
export { Level6Controller } from '@/features/act1-foundation/components/level-6-controller/Level6Controller';
export { Level7Serializers } from '@/features/act1-foundation/components/level-7-serializers/Level7Serializers';
export { Level8Associations } from '@/features/act1-foundation/components/level-8-associations/Level8Associations';
