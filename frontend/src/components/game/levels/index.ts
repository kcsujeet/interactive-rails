/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 *
 * CURRICULUM STRUCTURE (35 levels, 6 acts):
 *
 * Act 1: Rails Fundamentals (8 levels)
 * - Stack Choice, Model, CRUD, Controller, Views, MVC Pipeline, Persistence, Associations
 *
 * Act 2: Clean Code (7 levels)
 * - Security, Scopes, Separation of Concerns, Service Objects, Form Objects, Authorization, View Components
 *
 * Act 3: Performance (6 levels)
 * - N+1 Problem, Eager Loading, Query Optimization, Pagination, Caching, Background Jobs
 *
 * Act 4: Production Ready (5 levels)
 * - External APIs, Webhooks, File Storage, Idempotency, Health Checks
 *
 * Act 5: Infrastructure (5 levels)
 * - Load Balancing, CDN, Rate Limiting, Connection Pooling, Zero-Downtime Deployments
 *
 * Act 6: System Design (4 levels)
 * - Message Queues, Distributed Caching, API Gateway, Microservices (Capstone)
 */

import type { ComponentType } from 'react';

// Shared exports
export * from './shared';

// Level component props interface
export interface LevelComponentProps {
	onComplete: (data?: {
		stars?: number;
		decisions?: Record<string, string>;
	}) => void;
	onExit: () => void;
}

// ===========================================
// Act 1: Rails Fundamentals (Levels 1-8)
// ===========================================
import {
	Level1StackChoice,
	Level2Model,
	Level3CRUD,
	Level4Controller,
	Level5Views,
	Level6MVCPipeline,
	Level7Persistence,
	Level8Associations,
} from './act1';

// ===========================================
// Act 2: Clean Code (Levels 9-15)
// ===========================================
import {
	Level9Security,
	Level10Scopes,
	Level11SeparationOfConcerns,
	Level12ServiceObjects,
	Level13FormObjects,
	Level14Authorization,
	Level15ViewComponents,
} from './act2';

// ===========================================
// Act 3: Performance (Levels 16-21)
// ===========================================
import {
	Level16N1Problem,
	Level17EagerLoading,
	Level18QueryOptimization,
	Level19Pagination,
	Level20Caching,
	Level21BackgroundJobs,
} from './act3';

// ===========================================
// Act 4: Production Ready (Levels 22-26)
// ===========================================
import {
	Level22ExternalAPIs,
	Level23Webhooks,
	Level24FileStorage,
	Level25Idempotency,
	Level26HealthChecks,
} from './act4';

// ===========================================
// Act 5: Infrastructure (Levels 27-31)
// ===========================================
import {
	Level27LoadBalancing,
	Level28CDN,
	Level29RateLimiting,
	Level30ConnectionPooling,
	Level31Deployments,
} from './act5';

// ===========================================
// Act 6: System Design (Levels 32-35)
// ===========================================
import {
	Level32MessageQueues,
	Level33DistributedCaching,
	Level34APIGateway,
	Level35Microservices,
} from './act6';

// Level component registry
const LEVEL_COMPONENTS: Record<string, ComponentType<LevelComponentProps>> = {
	// ============================================
	// Act 1: Rails Fundamentals (8 levels)
	// ============================================
	'act1-level1-stack-choice': Level1StackChoice,
	'act1-level2-model': Level2Model,
	'act1-level3-crud': Level3CRUD,
	'act1-level4-controller': Level4Controller,
	'act1-level5-views': Level5Views,
	'act1-level6-mvc-pipeline': Level6MVCPipeline,
	'act1-level7-persistence': Level7Persistence,
	'act1-level8-associations': Level8Associations,

	// ============================================
	// Act 2: Clean Code (7 levels)
	// ============================================
	'act2-level9-security': Level9Security,
	'act2-level10-scopes': Level10Scopes,
	'act2-level11-separation-of-concerns': Level11SeparationOfConcerns,
	'act2-level12-service-objects': Level12ServiceObjects,
	'act2-level13-form-objects': Level13FormObjects,
	'act2-level14-authorization': Level14Authorization,
	'act2-level15-view-components': Level15ViewComponents,

	// ============================================
	// Act 3: Performance (6 levels)
	// ============================================
	'act3-level16-n1-problem': Level16N1Problem,
	'act3-level17-eager-loading': Level17EagerLoading,
	'act3-level18-query-optimization': Level18QueryOptimization,
	'act3-level19-pagination': Level19Pagination,
	'act3-level20-caching': Level20Caching,
	'act3-level21-background-jobs': Level21BackgroundJobs,

	// ============================================
	// Act 4: Production Ready (5 levels)
	// ============================================
	'act4-level22-external-apis': Level22ExternalAPIs,
	'act4-level23-webhooks': Level23Webhooks,
	'act4-level24-file-storage': Level24FileStorage,
	'act4-level25-idempotency': Level25Idempotency,
	'act4-level26-health-checks': Level26HealthChecks,

	// ============================================
	// Act 5: Infrastructure (5 levels)
	// ============================================
	'act5-level27-load-balancing': Level27LoadBalancing,
	'act5-level28-cdn': Level28CDN,
	'act5-level29-rate-limiting': Level29RateLimiting,
	'act5-level30-connection-pooling': Level30ConnectionPooling,
	'act5-level31-deployments': Level31Deployments,

	// ============================================
	// Act 6: System Design (4 levels) - CAPSTONE
	// ============================================
	'act6-level32-message-queues': Level32MessageQueues,
	'act6-level33-distributed-caching': Level33DistributedCaching,
	'act6-level34-api-gateway': Level34APIGateway,
	'act6-level35-microservices': Level35Microservices,
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

// Re-export individual level components for direct import
// Act 1
export {
	Level1StackChoice,
	Level2Model,
	Level3CRUD,
	Level4Controller,
	Level5Views,
	Level6MVCPipeline,
	Level7Persistence,
	Level8Associations,
} from './act1';
// Act 2
export {
	Level9Security,
	Level10Scopes,
	Level11SeparationOfConcerns,
	Level12ServiceObjects,
	Level13FormObjects,
	Level14Authorization,
	Level15ViewComponents,
} from './act2';
// Act 3
export {
	Level16N1Problem,
	Level17EagerLoading,
	Level18QueryOptimization,
	Level19Pagination,
	Level20Caching,
	Level21BackgroundJobs,
} from './act3';
// Act 4
export {
	Level22ExternalAPIs,
	Level23Webhooks,
	Level24FileStorage,
	Level25Idempotency,
	Level26HealthChecks,
} from './act4';
// Act 5
export {
	Level27LoadBalancing,
	Level28CDN,
	Level29RateLimiting,
	Level30ConnectionPooling,
	Level31Deployments,
} from './act5';
// Act 6
export {
	Level32MessageQueues,
	Level33DistributedCaching,
	Level34APIGateway,
	Level35Microservices,
} from './act6';
