/**
 * Standard animation timing constants.
 *
 * Use these across all level components to keep animation pacing consistent.
 */

/**
 * Standard duration per animated element (ms).
 *
 * This is the time each individual element (lane, zone, node, block) takes
 * to complete its animation. Total animation time scales with element count:
 * e.g., 4 lanes = 4 * 1500ms stagger start-to-start = 6000ms total.
 */
export const ANIMATION_DURATION_MS = 1500;
