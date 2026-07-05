/**
 * Print `{ actId, levelId, levelNumber, name }` for every level as JSON.
 * Consumed by the Playwright smoke tests (which run under node and cannot
 * import the React-heavy registry directly); run via `bun`.
 */

import { ACTS } from '@/lib/acts-registry';

const levels = ACTS.flatMap((act) =>
	act.levels.map((level) => ({
		actId: act.id,
		levelId: level.id,
		levelNumber: level.levelNumber,
		name: level.name,
	})),
);

console.log(JSON.stringify(levels));
