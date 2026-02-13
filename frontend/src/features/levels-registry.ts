/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 * Levels without a custom component use the generic pipeline builder.
 *
 * CURRICULUM STRUCTURE (50 levels, 8 acts):
 *
 * Act 1: The Foundation (7 levels)
 * - Stack Choice, Model, CRUD, Routes, Controller, Serializers, Associations
 *
 * Act 2: Users & Security (7 levels)
 * - Authentication, Validations, Callbacks, Authorization, Testing, Security, Scopes & Enums
 *
 * Act 3: Clean Architecture (7 levels)
 * - Service Objects, Concerns, Validation Contracts, Query Objects, Error Handling, Action Mailer, Background Jobs
 *
 * Act 4: Performance (7 levels)
 * - N+1 Problem, Eager Loading, Indexing, Counter Caches, Pagination, Search, Caching
 *
 * Act 5: Production Features (8 levels)
 * - Polymorphic, Transactions, Active Storage, Encryption, Real-Time, External APIs, Webhooks, API Versioning
 *
 * Act 6: Reliability (6 levels)
 * - Middleware, Rate Limiting, Soft Deletes, Safe Migrations, Recurring Jobs, Error Monitoring
 *
 * Act 7: Scale (5 levels)
 * - Multi-Database, State Machines, Multi-Tenancy, Observability, Domain Events
 *
 * Act 8: Mastery (3 levels)
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
// Act 1: The Foundation (Levels 1-7)
// ===========================================
import { Level1StackChoice } from './act1-foundation/components/Level1StackChoice';
import { Level2Model } from './act1-foundation/components/Level2Model';
import { Level3CRUD } from './act1-foundation/components/Level3CRUD';
import { Level4Routes } from './act1-foundation/components/Level4Routes';
import { Level5Controller } from './act1-foundation/components/Level5Controller';
import { Level7Associations } from './act1-foundation/components/Level7Associations';

// ===========================================
// Act 2: Users & Security (Levels 8-14)
// ===========================================
import { Level11Authorization } from './act2-users-security/components/Level11Authorization';
import { Level12Testing } from './act2-users-security/components/Level12Testing';
import { Level13Security } from './act2-users-security/components/Level13Security';
import { Level14ScopesEnums } from './act2-users-security/components/Level14ScopesEnums';

// ===========================================
// Act 3: Clean Architecture (Levels 15-21)
// ===========================================
import { Level15ServiceObjects } from './act3-clean-architecture/components/Level15ServiceObjects';
import { Level16Concerns } from './act3-clean-architecture/components/Level16Concerns';
import { Level17ValidationContracts } from './act3-clean-architecture/components/Level17ValidationContracts';
import { Level18QueryObjects } from './act3-clean-architecture/components/Level18QueryObjects';
import { Level20ActionMailer } from './act3-clean-architecture/components/Level20ActionMailer';
import { Level21BackgroundJobs } from './act3-clean-architecture/components/Level21BackgroundJobs';

// ===========================================
// Act 4: Performance (Levels 22-28)
// ===========================================
import { Level22N1Problem } from './act4-performance/components/Level22N1Problem';
import { Level23EagerLoading } from './act4-performance/components/Level23EagerLoading';
import { Level24Indexing } from './act4-performance/components/Level24Indexing';
import { Level25CounterCaches } from './act4-performance/components/Level25CounterCaches';
import { Level26Pagination } from './act4-performance/components/Level26Pagination';
import { Level27Search } from './act4-performance/components/Level27Search';
import { Level28Caching } from './act4-performance/components/Level28Caching';

// ===========================================
// Act 5: Production Features (Levels 29-36)
// ===========================================
import { Level29Polymorphic } from './act5-production/components/Level29Polymorphic';
import { Level30Transactions } from './act5-production/components/Level30Transactions';
import { Level31ActiveStorage } from './act5-production/components/Level31ActiveStorage';
import { Level32Encryption } from './act5-production/components/Level32Encryption';
import { Level33RealTime } from './act5-production/components/Level33RealTime';
import { Level34ExternalAPIs } from './act5-production/components/Level34ExternalAPIs';
import { Level35Webhooks } from './act5-production/components/Level35Webhooks';
import { Level36APIVersioning } from './act5-production/components/Level36APIVersioning';

// ===========================================
// Act 6: Reliability (Levels 37-42)
// ===========================================
import { Level38RateLimiting } from './act6-reliability/components/Level38RateLimiting';
import { Level39SoftDeletes } from './act6-reliability/components/Level39SoftDeletes';
import { Level40SafeMigrations } from './act6-reliability/components/Level40SafeMigrations';
import { Level41RecurringJobs } from './act6-reliability/components/Level41RecurringJobs';
import { Level42ErrorMonitoring } from './act6-reliability/components/Level42ErrorMonitoring';

// ===========================================
// Act 7: Scale (Levels 43-47)
// ===========================================
import { Level43MultiDatabase } from './act7-scale/components/Level43MultiDatabase';
import { Level44StateMachines } from './act7-scale/components/Level44StateMachines';
import { Level45MultiTenancy } from './act7-scale/components/Level45MultiTenancy';
import { Level46Observability } from './act7-scale/components/Level46Observability';
import { Level47DomainEvents } from './act7-scale/components/Level47DomainEvents';

// ===========================================
// Act 8: Mastery (Levels 48-50)
// ===========================================
import { Level48APIGateway } from './act8-mastery/components/Level48APIGateway';
import { Level49Sharding } from './act8-mastery/components/Level49Sharding';
import { Level50Architect } from './act8-mastery/components/Level50Architect';

// Level component registry
// Levels not listed here use the generic pipeline builder view
const LEVEL_COMPONENTS: Record<string, ComponentType<LevelComponentProps>> = {
	// ============================================
	// Act 1: The Foundation
	// ============================================
	'act1-level1-stack-choice': Level1StackChoice,
	'act1-level2-model': Level2Model,
	'act1-level3-crud': Level3CRUD,
	'act1-level4-routes': Level4Routes,
	'act1-level5-controller': Level5Controller,
	'act1-level7-associations': Level7Associations,

	// ============================================
	// Act 2: Users & Security
	// ============================================
	'act2-level11-authorization': Level11Authorization,
	'act2-level12-testing': Level12Testing,
	'act2-level13-security': Level13Security,
	'act2-level14-scopes-enums': Level14ScopesEnums,

	// ============================================
	// Act 3: Clean Architecture
	// ============================================
	'act3-level15-service-objects': Level15ServiceObjects,
	'act3-level16-concerns': Level16Concerns,
	'act3-level17-validation-contracts': Level17ValidationContracts,
	'act3-level18-query-objects': Level18QueryObjects,
	'act3-level20-action-mailer': Level20ActionMailer,
	'act3-level21-background-jobs': Level21BackgroundJobs,

	// ============================================
	// Act 4: Performance
	// ============================================
	'act4-level22-n1-problem': Level22N1Problem,
	'act4-level23-eager-loading': Level23EagerLoading,
	'act4-level24-database-indexing': Level24Indexing,
	'act4-level25-counter-caches': Level25CounterCaches,
	'act4-level26-pagination': Level26Pagination,
	'act4-level27-search': Level27Search,
	'act4-level28-caching': Level28Caching,

	// ============================================
	// Act 5: Production Features
	// ============================================
	'act5-level29-polymorphic': Level29Polymorphic,
	'act5-level30-transactions': Level30Transactions,
	'act5-level31-active-storage': Level31ActiveStorage,
	'act5-level32-encryption': Level32Encryption,
	'act5-level33-realtime': Level33RealTime,
	'act5-level34-external-apis': Level34ExternalAPIs,
	'act5-level35-webhooks': Level35Webhooks,
	'act5-level36-api-versioning': Level36APIVersioning,

	// ============================================
	// Act 6: Reliability
	// ============================================
	'act6-level38-rate-limiting': Level38RateLimiting,
	'act6-level39-soft-deletes': Level39SoftDeletes,
	'act6-level40-safe-migrations': Level40SafeMigrations,
	'act6-level41-recurring-jobs': Level41RecurringJobs,
	'act6-level42-error-monitoring': Level42ErrorMonitoring,

	// ============================================
	// Act 7: Scale
	// ============================================
	'act7-level43-multi-database': Level43MultiDatabase,
	'act7-level44-state-machines': Level44StateMachines,
	'act7-level45-multi-tenancy': Level45MultiTenancy,
	'act7-level46-observability': Level46Observability,
	'act7-level47-domain-events': Level47DomainEvents,

	// ============================================
	// Act 8: Mastery
	// ============================================
	'act8-level48-api-gateway': Level48APIGateway,
	'act8-level49-sharding': Level49Sharding,
	'act8-level50-architect': Level50Architect,
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
export { Level1StackChoice } from './act1-foundation/components/Level1StackChoice';
export { Level2Model } from './act1-foundation/components/Level2Model';
export { Level3CRUD } from './act1-foundation/components/Level3CRUD';
export { Level4Routes } from './act1-foundation/components/Level4Routes';
export { Level5Controller } from './act1-foundation/components/Level5Controller';
export { Level7Associations } from './act1-foundation/components/Level7Associations';
