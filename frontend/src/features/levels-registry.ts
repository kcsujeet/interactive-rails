/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 * Levels without a custom component use the generic pipeline builder.
 *
 * CURRICULUM STRUCTURE (51 levels, 8 acts):
 *
 * Act 1: The Foundation (L1-L8, 8 levels)
 * - Environment, Hello Rails, Model, CRUD, Routes, Controller, Serializers, Associations
 *
 * Act 2: Users & Security (L9-L15, 7 levels)
 * - Authentication, Validations, Callbacks, Authorization, Testing, Security, Scopes & Enums
 *
 * Act 3: Clean Architecture (L16-L22, 7 levels)
 * - Service Objects, Concerns, Validation Contracts, Query Objects, Error Handling, Action Mailer, Background Jobs
 *
 * Act 4: Performance (L23-L29, 7 levels)
 * - N+1 Problem, Eager Loading, Indexing, Counter Caches, Pagination, Search, Caching
 *
 * Act 5: Production Features (L30-L37, 8 levels)
 * - Polymorphic, Transactions, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning
 *
 * Act 6: Reliability (L38-L43, 6 levels)
 * - Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Error Monitoring
 *
 * Act 7: Scale (L44-L48, 5 levels)
 * - Multi-Database, State Machines, Multi-Tenancy, Observability, Domain Events
 *
 * Act 8: Mastery (L49-L51, 3 levels)
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
	onExit: () => void;
}

// ===========================================
// Act 1: The Foundation (Levels 1-8)
// ===========================================
import { Level1Environment } from './act1-foundation/components/Level1Environment';
import { Level2HelloRails } from './act1-foundation/components/Level2HelloRails';
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
// Act 4: Performance (Levels 23-29)
// ===========================================
import { Level23N1Problem } from './act4-performance/components/Level23N1Problem';
import { Level24EagerLoading } from './act4-performance/components/Level24EagerLoading';
import { Level25Indexing } from './act4-performance/components/Level25Indexing';
import { Level26CounterCaches } from './act4-performance/components/Level26CounterCaches';
import { Level27Pagination } from './act4-performance/components/Level27Pagination';
import { Level28Search } from './act4-performance/components/Level28Search';
import { Level29Caching } from './act4-performance/components/Level29Caching';

// ===========================================
// Act 5: Production Features (Levels 30-37)
// ===========================================
import { Level30Polymorphic } from './act5-production/components/Level30Polymorphic';
import { Level31Transactions } from './act5-production/components/Level31Transactions';
import { Level32ActiveStorage } from './act5-production/components/Level32ActiveStorage';
import { Level33Encryption } from './act5-production/components/Level33Encryption';
import { Level34RealTime } from './act5-production/components/Level34RealTime';
import { Level35ExternalAPIs } from './act5-production/components/Level35ExternalAPIs';
import { Level36Webhooks } from './act5-production/components/Level36Webhooks';
import { Level37APIVersioning } from './act5-production/components/Level37APIVersioning';

// ===========================================
// Act 6: Reliability (Levels 38-43)
// ===========================================
import { Level39RateLimiting } from './act6-reliability/components/Level39RateLimiting';
import { Level40SoftDeletes } from './act6-reliability/components/Level40SoftDeletes';
import { Level41SafeMigrations } from './act6-reliability/components/Level41SafeMigrations';
import { Level42RecurringJobs } from './act6-reliability/components/Level42RecurringJobs';
import { Level43ErrorMonitoring } from './act6-reliability/components/Level43ErrorMonitoring';

// ===========================================
// Act 7: Scale (Levels 44-48)
// ===========================================
import { Level44MultiDatabase } from './act7-scale/components/Level44MultiDatabase';
import { Level45StateMachines } from './act7-scale/components/Level45StateMachines';
import { Level46MultiTenancy } from './act7-scale/components/Level46MultiTenancy';
import { Level47Observability } from './act7-scale/components/Level47Observability';
import { Level48DomainEvents } from './act7-scale/components/Level48DomainEvents';

// ===========================================
// Act 8: Mastery (Levels 49-51)
// ===========================================
import { Level49APIGateway } from './act8-mastery/components/Level49APIGateway';
import { Level50Sharding } from './act8-mastery/components/Level50Sharding';
import { Level51Architect } from './act8-mastery/components/Level51Architect';

// Level component registry
// Levels not listed here use the generic pipeline builder view
const LEVEL_COMPONENTS: Record<string, ComponentType<LevelComponentProps>> = {
	// ============================================
	// Act 1: The Foundation
	// ============================================
	'act1-level1-environment': Level1Environment,
	'act1-level2-hello-rails': Level2HelloRails,
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
	'act4-level25-database-indexing': Level25Indexing,
	'act4-level26-counter-caches': Level26CounterCaches,
	'act4-level27-pagination': Level27Pagination,
	'act4-level28-search': Level28Search,
	'act4-level29-caching': Level29Caching,

	// ============================================
	// Act 5: Production Features
	// ============================================
	'act5-level30-polymorphic': Level30Polymorphic,
	'act5-level31-transactions': Level31Transactions,
	'act5-level32-active-storage': Level32ActiveStorage,
	'act5-level33-encryption': Level33Encryption,
	'act5-level34-realtime': Level34RealTime,
	'act5-level35-external-apis': Level35ExternalAPIs,
	'act5-level36-webhooks': Level36Webhooks,
	'act5-level37-api-versioning': Level37APIVersioning,

	// ============================================
	// Act 6: Reliability
	// ============================================
	'act6-level39-rate-limiting': Level39RateLimiting,
	'act6-level40-soft-deletes': Level40SoftDeletes,
	'act6-level41-safe-migrations': Level41SafeMigrations,
	'act6-level42-recurring-jobs': Level42RecurringJobs,
	'act6-level43-error-monitoring': Level43ErrorMonitoring,

	// ============================================
	// Act 7: Scale
	// ============================================
	'act7-level44-multi-database': Level44MultiDatabase,
	'act7-level45-state-machines': Level45StateMachines,
	'act7-level46-multi-tenancy': Level46MultiTenancy,
	'act7-level47-observability': Level47Observability,
	'act7-level48-domain-events': Level48DomainEvents,

	// ============================================
	// Act 8: Mastery
	// ============================================
	'act8-level49-api-gateway': Level49APIGateway,
	'act8-level50-sharding': Level50Sharding,
	'act8-level51-architect': Level51Architect,
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
export { Level2HelloRails } from './act1-foundation/components/Level2HelloRails';
export { Level3Model } from './act1-foundation/components/Level3Model';
export { Level4CRUD } from './act1-foundation/components/Level4CRUD';
export { Level5Routes } from './act1-foundation/components/Level5Routes';
export { Level6Controller } from './act1-foundation/components/Level6Controller';
export { Level8Associations } from './act1-foundation/components/Level8Associations';
