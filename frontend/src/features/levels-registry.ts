/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 * Levels without a custom component use the generic pipeline builder.
 *
 * CURRICULUM STRUCTURE (55 levels, 8 acts):
 *
 * Act 1: The Foundation (L1-L8, 8 levels)
 * - Environment, First Boot, Model, CRUD, Routes, Controller, Serializers, Associations
 *
 * Act 2: Users & Security (L9-L15, 7 levels)
 * - Authentication, Validations, Callbacks, Authorization, Testing, Security, Scopes & Enums
 *
 * Act 3: Clean Architecture (L16-L22, 7 levels)
 * - Service Objects, Concerns, Validation Contracts, Query Objects, Error Handling, Action Mailer, Background Jobs
 *
 * Act 4: Performance (L23-L31, 9 levels)
 * - N+1 Problem, Eager Loading, Narrow Fetching, Indexing, Counter Caches, Pagination, Search, Caching, HTTP Caching & CDNs
 *
 * Act 5: Production Features (L32-L39, 8 levels)
 * - Polymorphic, Transactions, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning
 *
 * Act 6: Reliability (L40-L46, 7 levels)
 * - Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Data Lifecycle, Error Monitoring
 *
 * Act 7: Scale (L47-L52, 6 levels)
 * - Multi-Database, State Machines, Multi-Tenancy, Observability, Modular Monolith, Domain Events
 *
 * Act 8: Mastery (L53-L55, 3 levels)
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
import { Level8Associations } from './act1-foundation/components/Level8Associations';

// ===========================================
// Act 2: Users & Security (Levels 9-15)
// ===========================================
import { Level12Authorization } from './act2-users-security/components/Level12Authorization';
import { Level13Testing } from './act2-users-security/components/Level13Testing';
import { Level14Security } from './act2-users-security/components/Level14Security';
import { Level15ScopesEnums } from './act2-users-security/components/Level15ScopesEnums';

// ===========================================
// Act 3: Clean Architecture (Levels 16-22)
// ===========================================
import { Level16ServiceObjects } from './act3-clean-architecture/components/Level16ServiceObjects';
import { Level17Concerns } from './act3-clean-architecture/components/Level17Concerns';
import { Level18ValidationContracts } from './act3-clean-architecture/components/Level18ValidationContracts';
import { Level19QueryObjects } from './act3-clean-architecture/components/Level19QueryObjects';
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
// Act 5: Production Features (Levels 32-39)
// ===========================================
import { Level32Polymorphic } from './act5-production/components/Level32Polymorphic';
import { Level33Transactions } from './act5-production/components/Level33Transactions';
import { Level34ActiveStorage } from './act5-production/components/Level34ActiveStorage';
import { Level35Encryption } from './act5-production/components/Level35Encryption';
import { Level36RealTime } from './act5-production/components/Level36RealTime';
import { Level37ExternalAPIs } from './act5-production/components/Level37ExternalAPIs';
import { Level38Webhooks } from './act5-production/components/Level38Webhooks';
import { Level39APIVersioning } from './act5-production/components/Level39APIVersioning';

// ===========================================
// Act 6: Reliability (Levels 40-46)
// ===========================================
import { Level41RateLimiting } from './act6-reliability/components/Level41RateLimiting';
import { Level42SoftDeletes } from './act6-reliability/components/Level42SoftDeletes';
import { Level43SafeMigrations } from './act6-reliability/components/Level43SafeMigrations';
import { Level44RecurringJobs } from './act6-reliability/components/Level44RecurringJobs';
import { Level45DataLifecycle } from './act6-reliability/components/Level45DataLifecycle';
import { Level46ErrorMonitoring } from './act6-reliability/components/Level46ErrorMonitoring';

// ===========================================
// Act 7: Scale (Levels 47-52)
// ===========================================
import { Level47MultiDatabase } from './act7-scale/components/Level47MultiDatabase';
import { Level48StateMachines } from './act7-scale/components/Level48StateMachines';
import { Level49MultiTenancy } from './act7-scale/components/Level49MultiTenancy';
import { Level50Observability } from './act7-scale/components/Level50Observability';
import { Level51ModularMonolith } from './act7-scale/components/Level51ModularMonolith';
import { Level52DomainEvents } from './act7-scale/components/Level52DomainEvents';

// ===========================================
// Act 8: Mastery (Levels 53-55)
// ===========================================
import { Level53APIGateway } from './act8-mastery/components/Level53APIGateway';
import { Level54Sharding } from './act8-mastery/components/Level54Sharding';
import { Level55Architect } from './act8-mastery/components/Level55Architect';

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
	'act1-level8-associations': Level8Associations,

	// ============================================
	// Act 2: Users & Security
	// ============================================
	'act2-level12-authorization': Level12Authorization,
	'act2-level13-testing': Level13Testing,
	'act2-level14-security': Level14Security,
	'act2-level15-scopes-enums': Level15ScopesEnums,

	// ============================================
	// Act 3: Clean Architecture
	// ============================================
	'act3-level16-service-objects': Level16ServiceObjects,
	'act3-level17-concerns': Level17Concerns,
	'act3-level18-validation-contracts': Level18ValidationContracts,
	'act3-level19-query-objects': Level19QueryObjects,
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
	'act5-level34-active-storage': Level34ActiveStorage,
	'act5-level35-encryption': Level35Encryption,
	'act5-level36-realtime': Level36RealTime,
	'act5-level37-external-apis': Level37ExternalAPIs,
	'act5-level38-webhooks': Level38Webhooks,
	'act5-level39-api-versioning': Level39APIVersioning,

	// ============================================
	// Act 6: Reliability
	// ============================================
	'act6-level41-rate-limiting': Level41RateLimiting,
	'act6-level42-soft-deletes': Level42SoftDeletes,
	'act6-level43-safe-migrations': Level43SafeMigrations,
	'act6-level44-recurring-jobs': Level44RecurringJobs,
	'act6-level45-data-lifecycle': Level45DataLifecycle,
	'act6-level46-error-monitoring': Level46ErrorMonitoring,

	// ============================================
	// Act 7: Scale
	// ============================================
	'act7-level47-multi-database': Level47MultiDatabase,
	'act7-level48-state-machines': Level48StateMachines,
	'act7-level49-multi-tenancy': Level49MultiTenancy,
	'act7-level50-observability': Level50Observability,
	'act7-level51-modular-monolith': Level51ModularMonolith,
	'act7-level52-domain-events': Level52DomainEvents,

	// ============================================
	// Act 8: Mastery
	// ============================================
	'act8-level53-api-gateway': Level53APIGateway,
	'act8-level54-sharding': Level54Sharding,
	'act8-level55-architect': Level55Architect,
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
export { Level8Associations } from './act1-foundation/components/Level8Associations';
