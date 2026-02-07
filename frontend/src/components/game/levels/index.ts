/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 * Levels without a custom component use the generic pipeline builder.
 *
 * CURRICULUM STRUCTURE (50 levels, 8 acts):
 *
 * Act 1: The Foundation (7 levels)
 * - Stack Choice, Model, CRUD, Controller, Serializers, Routes, Associations
 *
 * Act 2: Users & Security (7 levels)
 * - Authentication, Validations, Callbacks, Authorization, Testing, Security, Scopes & Enums
 *
 * Act 3: Clean Architecture (7 levels)
 * - Service Objects, Concerns, Form Objects, Custom Validators, Error Handling, Action Mailer, Background Jobs
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
// Act 1: The Foundation (Levels 1-7)
// ===========================================
import { Level1StackChoice } from './act1/Level1StackChoice';
import { Level2Model } from './act1/Level2Model';
import { Level3CRUD } from './act1/Level3CRUD';
import { Level4Controller } from './act1/Level4Controller';
import { Level8Associations as Level7Associations } from './act1/Level8Associations';

// Level component registry
// Levels not listed here use the generic pipeline builder view
const LEVEL_COMPONENTS: Record<string, ComponentType<LevelComponentProps>> = {
	// ============================================
	// Act 1: The Foundation
	// ============================================
	'act1-level1-stack-choice': Level1StackChoice,
	'act1-level2-model': Level2Model,
	'act1-level3-crud': Level3CRUD,
	'act1-level4-controller': Level4Controller,
	'act1-level7-associations': Level7Associations,

	// ============================================
	// Acts 2-8: Custom components will be added as they are built
	// The generic pipeline builder handles levels without custom components
	// ============================================
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
export { Level1StackChoice } from './act1/Level1StackChoice';
export { Level2Model } from './act1/Level2Model';
export { Level3CRUD } from './act1/Level3CRUD';
export { Level4Controller } from './act1/Level4Controller';
export { Level8Associations as Level7Associations } from './act1/Level8Associations';
