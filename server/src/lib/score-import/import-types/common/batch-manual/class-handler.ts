import ScoreImportFatalError from "lib/score-import/framework/score-importing/score-import-error";
import { GetGamePTConfig } from "tachi-common";
import { NotNullish } from "utils/misc";
import type { ClassHandler } from "lib/score-import/framework/profile-calculated-data/types";
import type { GamePTConfig, GPTString } from "tachi-common";
import type { GameClasses, GameClassSets } from "tachi-common/game-classes";

// Note: This is tested by batch-manuals parser.test.ts.
export function CreateBatchManualClassHandler(
	classes: Record<GameClassSets[GPTString], string>
): ClassHandler {
	return (game, playtype, userID, ratings, logger) => {
		const gptConfig = GetGamePTConfig(game, playtype);

		const newObj: Partial<GameClasses<GPTString>> = {};

		for (const [s, classID] of Object.entries(classes)) {
			const set = s as GameClassSets[GPTString];

			const index = ClassIDToIndex(gptConfig, set, classID);

			if (index === null) {
				logger.warn(
					`User passed invalid class of ${classID} for set ${set}. Expected any of ${gptConfig.classHumanisedFormat[
						set
					]
						.map((e) => e.id)
						.join(", ")}`
				);

				throw new ScoreImportFatalError(
					400,
					`Invalid class of ${classID} for set ${set}. Expected any of ${gptConfig.classHumanisedFormat[
						set
					]
						.map((e) => e.id)
						.join(", ")}`
				);
			}

			newObj[set] = index;
		}

		return newObj;
	};
}

/**
 * Given a gpt classes ID, return its index value.
 *
 * Returns null if the classID doesn't exist.
 * @returns
 */
function ClassIDToIndex(
	gptConfig: GamePTConfig,
	classSet: GameClassSets[GPTString],
	classID: string
) {
	const classes = gptConfig.classHumanisedFormat[classSet];

	for (let i = 0; i < classes.length; i++) {
		const classInfo = NotNullish(classes[i]);

		// Object.entries on an array returns [string, T], counterintuitively.
		// Ah well. We'll just iterate over it like this.
		if (classInfo.id === classID) {
			return i;
		}
	}

	return null;
}
