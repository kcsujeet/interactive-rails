/**
 * Curriculum-wide validation. Runs in CI; fails the build if any level's
 * id, levelNumber, or actId disagrees with what acts-registry imports.
 *
 * The slug-shape check (`act{N}-level{M}-{kebab-name}`) catches renumbering
 * bugs where a directory was moved but the slug inside content was not
 * updated, and vice versa.
 */

import { ACTS, getAllLevels } from '../src/lib/acts-registry';

const errors: string[] = [];
const allLevels = getAllLevels();

const levelIds = new Set<string>();
const levelNumbers = new Set<number>();
const slugPattern = /^act(\d+)-level(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

for (const act of ACTS) {
	for (const level of act.levels) {
		if (!level.id) errors.push(`Level missing id in act ${act.id}`);
		if (levelIds.has(level.id)) errors.push(`Duplicate level id: ${level.id}`);
		levelIds.add(level.id);

		if (level.actId !== act.id) {
			errors.push(
				`Level ${level.id} actId (${level.actId}) does not match act ${act.id}`,
			);
		}
		if (!level.levelNumber)
			errors.push(`Level ${level.id} missing levelNumber`);
		if (levelNumbers.has(level.levelNumber)) {
			errors.push(`Duplicate levelNumber: ${level.levelNumber}`);
		}
		levelNumbers.add(level.levelNumber);

		if (!level.name) errors.push(`Level ${level.id} missing name`);
		if (!level.trigger?.description)
			errors.push(`Level ${level.id} missing trigger description`);
		if (!level.problem?.observation)
			errors.push(`Level ${level.id} missing problem observation`);
		if (!level.learningContent?.title)
			errors.push(`Level ${level.id} missing learningContent title`);
		if (!level.learningContent?.railsCodeExample) {
			errors.push(`Level ${level.id} missing learningContent railsCodeExample`);
		}

		// Slug shape: actN-levelM-kebab
		const match = level.id.match(slugPattern);
		if (!match) {
			errors.push(
				`Level ${level.id} slug does not match pattern act{N}-level{M}-{kebab-name}`,
			);
		} else {
			const slugActId = Number(match[1]);
			const slugLevelNumber = Number(match[2]);
			if (slugActId !== level.actId) {
				errors.push(
					`Level ${level.id} slug encodes actId ${slugActId} but level.actId is ${level.actId}`,
				);
			}
			if (slugLevelNumber !== level.levelNumber) {
				errors.push(
					`Level ${level.id} slug encodes levelNumber ${slugLevelNumber} but level.levelNumber is ${level.levelNumber}`,
				);
			}
		}
	}
}

// Levels must be contiguously numbered across the curriculum (1..N).
const sortedNumbers = Array.from(levelNumbers).sort((a, b) => a - b);
for (let i = 0; i < sortedNumbers.length; i++) {
	const expected = i + 1;
	if (sortedNumbers[i] !== expected) {
		errors.push(
			`Level numbers have a gap or duplicate at position ${i}: ` +
				`expected ${expected}, got ${sortedNumbers[i]}`,
		);
		break;
	}
}

const expectedCount = 58;
if (allLevels.length !== expectedCount) {
	errors.push(
		`Expected ${expectedCount} total levels, found ${allLevels.length}`,
	);
}

if (errors.length) {
	console.error('Level validation failed:');
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log(
	`Level validation passed: ${allLevels.length} levels across ${ACTS.length} acts.`,
);
