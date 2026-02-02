/**
 * Level Components Registry
 *
 * Maps level IDs to their custom components.
 */

import type { ComponentType } from 'react';

// Shared exports
export * from './shared';

// Level component props interface
export interface LevelComponentProps {
  onComplete: (data?: { stars?: number; decisions?: Record<string, string> }) => void;
  onExit: () => void;
}

// Import level components
// Act 1: Foundation
import {
  Level1StackChoice,
  Level2FirstRequest,
  Level3Associations,
  Level4Persistence,
  Level5Security,
} from './act1';

// Act 2: Domain Layer
import {
  Level6FatController,
  Level7Services,
  Level8Commands,
  Level9Contracts,
  Level10Forms,
  Level11Authorization,
  Level12Components,
} from './act2';

// Act 3: Ecosystem
import {
  Level13ExternalAPIs,
  Level14BackgroundJobs,
  Level15Idempotency,
  Level16Caching,
  Level17Webhooks,
  Level18Storage,
} from './act3';

// Act 4: Hyperscale
import {
  Level19EventDriven,
  Level20FeatureFlags,
  Level21ReadWriteSplit,
  Level22Sharding,
  Level23CircuitBreakers,
  Level24Observability,
  Level25Microservices,
} from './act4';

// Level component registry
const LEVEL_COMPONENTS: Record<string, ComponentType<LevelComponentProps>> = {
  // Act 1: Foundation
  'act1-level1-stack-choice': Level1StackChoice,
  'act1-level2-first-request': Level2FirstRequest,
  'act1-level3-associations': Level3Associations,
  'act1-level4-persistence': Level4Persistence,
  'act1-level5-security': Level5Security,

  // Act 2: Domain Layer
  'act2-level6-fat-controller': Level6FatController,
  'act2-level7-service-objects': Level7Services,
  'act2-level8-command-pattern': Level8Commands,
  'act2-level9-data-contracts': Level9Contracts,
  'act2-level10-form-objects': Level10Forms,
  'act2-level11-authorization': Level11Authorization,
  'act2-level12-view-components': Level12Components,

  // Act 3: Ecosystem
  'act3-level13-third-party-apis': Level13ExternalAPIs,
  'act3-level14-background-jobs': Level14BackgroundJobs,
  'act3-level15-idempotency': Level15Idempotency,
  'act3-level16-caching': Level16Caching,
  'act3-level17-webhooks': Level17Webhooks,
  'act3-level18-file-storage': Level18Storage,

  // Act 4: Hyperscale
  'act4-level19-event-driven': Level19EventDriven,
  'act4-level20-feature-flags': Level20FeatureFlags,
  'act4-level21-read-write-splitting': Level21ReadWriteSplit,
  'act4-level22-sharding': Level22Sharding,
  'act4-level23-circuit-breakers': Level23CircuitBreakers,
  'act4-level24-observability': Level24Observability,
  'act4-level25-microservices': Level25Microservices,
};

/**
 * Get the custom component for a level, or undefined if not found.
 */
export function getLevelComponent(levelId: string): ComponentType<LevelComponentProps> | undefined {
  return LEVEL_COMPONENTS[levelId];
}

/**
 * Check if a level has a custom component.
 */
export function hasCustomComponent(levelId: string): boolean {
  return levelId in LEVEL_COMPONENTS;
}

// Export individual level components for direct import
export { Level1StackChoice } from './act1/Level1StackChoice';
export { Level2FirstRequest } from './act1/Level2FirstRequest';
export { Level3Associations } from './act1/Level3Associations';
export { Level4Persistence } from './act1/Level4Persistence';
export { Level5Security } from './act1/Level5Security';
