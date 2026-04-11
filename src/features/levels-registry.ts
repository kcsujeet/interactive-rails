/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 * Levels without a custom component use the generic pipeline builder.
 *
 * CURRICULUM STRUCTURE (56 levels, 8 acts):
 *
 * Act 1: The Foundation (L1-L8, 8 levels)
 * - Environment, First Boot, Model, CRUD, Routes, Controller, Serializers, Associations
 *
 * Act 2: Guards & Gates (L9-L15, 7 levels)
 * - Authentication, Validations, Callbacks, Authorization, Testing, Strong Params, CORS
 *
 * Act 3: Clean Architecture (L16-L22, 7 levels)
 * - Service Objects, Concerns, Validation Contracts, Query Objects, Error Handling, Action Mailer, Background Jobs
 *
 * Act 4: Performance (L23-L31, 9 levels)
 * - N+1 Problem, Eager Loading, Narrow Fetching, Indexing, Counter Caches, Pagination, Search, Caching, HTTP Caching & CDNs
 *
 * Act 5: Production Features (L32-L40, 9 levels)
 * - Polymorphic, Transactions, Locking, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning
 *
 * Act 6: Reliability (L41-L47, 7 levels)
 * - Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Data Lifecycle, Error Monitoring
 *
 * Act 7: Scale (L48-L53, 6 levels)
 * - Multi-Database, State Machines, Multi-Tenancy, Observability, Modular Monolith, Domain Events
 *
 * Act 8: Mastery (L54-L56, 3 levels)
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
import { Level1Environment } from './act1-foundation/components/Level1Environment';
import { Level2FirstBoot } from './act1-foundation/components/Level2FirstBoot';
import { Level3Model } from './act1-foundation/components/Level3Model';
import { Level4CRUD } from './act1-foundation/components/Level4CRUD';
import { Level5Routes } from './act1-foundation/components/Level5Routes';
import { Level6Controller } from './act1-foundation/components/Level6Controller';
import { Level7Serializers } from './act1-foundation/components/Level7Serializers';
import { Level8Associations } from './act1-foundation/components/Level8Associations';

// ===========================================
// Act 2: Users & Security (Levels 9-15)
// ===========================================
import { Level9Authentication } from './act2-users-security/components/Level9Authentication';
import { Level10Validations } from './act2-users-security/components/Level10Validations';
import { Level11Callbacks } from './act2-users-security/components/Level11Callbacks';
import { Level12Authorization } from './act2-users-security/components/Level12Authorization';
import { Level13Testing } from './act2-users-security/components/Level13Testing';
import { Level14StrongParams } from './act2-users-security/components/Level14StrongParams';
import { Level15CORS } from './act2-users-security/components/Level15CORS';

// ===========================================
// Act 3: Clean Architecture (Levels 16-22)
// ===========================================
import { Level16ServiceObjects } from './act3-clean-architecture/components/Level16ServiceObjects';
import { Level17Concerns } from './act3-clean-architecture/components/Level17Concerns';
import { Level18ValidationContracts } from './act3-clean-architecture/components/Level18ValidationContracts';
import { Level19QueryObjects } from './act3-clean-architecture/components/Level19QueryObjects';
import { Level20ErrorHandling } from './act3-clean-architecture/components/Level20ErrorHandling';
import { Level21ActionMailer } from './act3-clean-architecture/components/Level21ActionMailer';
import { Level22BackgroundJobs } from './act3-clean-architecture/components/Level22BackgroundJobs';

// ===========================================
// Act 4: Performance (Levels 23-31)
// ===========================================
import { Level23N1Problem } from './act4-performance/components/Level23N1Problem';
import { Level24EagerLoading } from './act4-performance/components/Level24EagerLoading';
import { Level25NarrowFetching } from './act4-performance/components/Level25NarrowFetching';
import { Level26Indexing } from './act4-performance/components/Level26Indexing';
import { Level27CounterCaches } from './act4-performance/components/Level27CounterCaches';
import { Level28Pagination } from './act4-performance/components/Level28Pagination';
import { Level29Search } from './act4-performance/components/Level29Search';
import { Level30Caching } from './act4-performance/components/Level30Caching';
import { Level31HTTPCaching } from './act4-performance/components/Level31HTTPCaching';

// ===========================================
// Act 5: Production Features (Levels 32-40)
// ===========================================
import { Level32Polymorphic } from './act5-production/components/Level32Polymorphic';
import { Level33Transactions } from './act5-production/components/Level33Transactions';
import { Level34Locking } from './act5-production/components/Level34Locking';
import { Level35ActiveStorage } from './act5-production/components/Level35ActiveStorage';
import { Level36Encryption } from './act5-production/components/Level36Encryption';
import { Level37RealTime } from './act5-production/components/Level37RealTime';
import { Level38ExternalAPIs } from './act5-production/components/Level38ExternalAPIs';
import { Level39Webhooks } from './act5-production/components/Level39Webhooks';
import { Level40APIVersioning } from './act5-production/components/Level40APIVersioning';

// ===========================================
// Act 6: Reliability (Levels 41-47)
// ===========================================
import { Level41Middleware } from './act6-reliability/components/Level41Middleware';
import { Level42RateLimiting } from './act6-reliability/components/Level42RateLimiting';
import { Level43SoftDeletes } from './act6-reliability/components/Level43SoftDeletes';
import { Level44SafeMigrations } from './act6-reliability/components/Level44SafeMigrations';
import { Level45RecurringJobs } from './act6-reliability/components/Level45RecurringJobs';
import { Level46DataLifecycle } from './act6-reliability/components/Level46DataLifecycle';
import { Level47ErrorMonitoring } from './act6-reliability/components/Level47ErrorMonitoring';

// ===========================================
// Act 7: Scale (Levels 48-53)
// ===========================================
import { Level48MultiDatabase } from './act7-scale/components/Level48MultiDatabase';
import { Level49StateMachines } from './act7-scale/components/Level49StateMachines';
import { Level50MultiTenancy } from './act7-scale/components/Level50MultiTenancy';
import { Level51Observability } from './act7-scale/components/Level51Observability';
import { Level52ModularMonolith } from './act7-scale/components/Level52ModularMonolith';
import { Level53DomainEvents } from './act7-scale/components/Level53DomainEvents';

// ===========================================
// Act 8: Mastery (Levels 54-56)
// ===========================================
import { Level54APIGateway } from './act8-mastery/components/Level54APIGateway';
import { Level55Sharding } from './act8-mastery/components/Level55Sharding';
import { Level56Architect } from './act8-mastery/components/Level56Architect';

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
	// Act 5: Production Features
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
	// Act 6: Reliability
	// ============================================
	'act6-level41-middleware': Level41Middleware,
	'act6-level42-rate-limiting': Level42RateLimiting,
	'act6-level43-soft-deletes': Level43SoftDeletes,
	'act6-level44-safe-migrations': Level44SafeMigrations,
	'act6-level45-recurring-jobs': Level45RecurringJobs,
	'act6-level46-data-lifecycle': Level46DataLifecycle,
	'act6-level47-error-monitoring': Level47ErrorMonitoring,

	// ============================================
	// Act 7: Scale
	// ============================================
	'act7-level48-multi-database': Level48MultiDatabase,
	'act7-level49-state-machines': Level49StateMachines,
	'act7-level50-multi-tenancy': Level50MultiTenancy,
	'act7-level51-observability': Level51Observability,
	'act7-level52-modular-monolith': Level52ModularMonolith,
	'act7-level53-domain-events': Level53DomainEvents,

	// ============================================
	// Act 8: Mastery
	// ============================================
	'act8-level54-api-gateway': Level54APIGateway,
	'act8-level55-sharding': Level55Sharding,
	'act8-level56-architect': Level56Architect,
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
export { Level1Environment } from './act1-foundation/components/Level1Environment';
export { Level2FirstBoot } from './act1-foundation/components/Level2FirstBoot';
export { Level3Model } from './act1-foundation/components/Level3Model';
export { Level4CRUD } from './act1-foundation/components/Level4CRUD';
export { Level5Routes } from './act1-foundation/components/Level5Routes';
export { Level6Controller } from './act1-foundation/components/Level6Controller';
export { Level7Serializers } from './act1-foundation/components/Level7Serializers';
export { Level8Associations } from './act1-foundation/components/Level8Associations';
