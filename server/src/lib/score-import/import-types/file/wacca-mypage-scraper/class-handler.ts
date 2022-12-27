import ScoreImportFatalError from "../../../framework/score-importing/score-import-error";
import { WACCA_STAGEUPS } from "tachi-common";
import type { ClassHandler } from "../../../framework/user-game-stats/types";
import type { MyPagePlayerStage } from "./types";

const STAGES: Record<number, number> = {
	1: WACCA_STAGEUPS.I,
	2: WACCA_STAGEUPS.II,
	3: WACCA_STAGEUPS.III,
	4: WACCA_STAGEUPS.IV,
	5: WACCA_STAGEUPS.V,
	6: WACCA_STAGEUPS.VI,
	7: WACCA_STAGEUPS.VII,
	8: WACCA_STAGEUPS.VIII,
	9: WACCA_STAGEUPS.IX,
	10: WACCA_STAGEUPS.X,
	11: WACCA_STAGEUPS.XI,
	12: WACCA_STAGEUPS.XII,
	13: WACCA_STAGEUPS.XIII,
	14: WACCA_STAGEUPS.XIV,
};

// Keys in this Record should exactly match keys in the STAGES Record.
const STAGE_NAMES: Record<number, string> = {
	1: "I",
	2: "II",
	3: "III",
	4: "IV",
	5: "V",
	6: "VI",
	7: "VII",
	8: "VIII",
	9: "IX",
	10: "X",
	11: "XI",
	12: "XII",
	13: "XIII",
	14: "XIV",
};

export function CreateMyPageScraperClassHandler(stage: MyPagePlayerStage): ClassHandler {
	return (_game, _playtype, _userID, _ratings, logger) => {
		const stageName = STAGE_NAMES[stage.id];

		if (stageName === undefined) {
			throw new ScoreImportFatalError(400, `Unknown stage up id ${stage.id}.`);
		}

		if (`ステージ${stageName}` !== stage.name) {
			logger.warn(
				`Stage up ${stageName} with id ${stage.id} did not correspond to the CSV name ${stage.name}.`
			);
		}

		const stageEnum = STAGES[stage.id];

		if (stageEnum === undefined) {
			// If we can find the stage name but not the enum value, something is
			// seriously wrong. 500 is appropriate.
			throw new ScoreImportFatalError(
				500,
				`Can't find index for stageUp class id ${stageName}.`
			);
		}

		return {
			stageUp: stageEnum,
		};
	};
}
