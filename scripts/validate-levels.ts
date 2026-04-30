import { ACTS, getAllLevels } from '../src/lib/acts-registry';

const errors: string[] = [];
const allLevels = getAllLevels();

const levelIds = new Set<string>();
const levelNumbers = new Set<number>();

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
