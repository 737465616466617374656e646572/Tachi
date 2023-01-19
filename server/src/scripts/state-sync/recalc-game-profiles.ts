/* eslint-disable no-await-in-loop */
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { UpdateUsersGamePlaytypeStats } from "lib/score-import/framework/profile-calculated-data/update-ugs";
import { WrapScriptPromise } from "utils/misc";
import { FormatUserDoc } from "utils/user";
import type { Game, Playtype, ScoreDocument } from "tachi-common";

const logger = CreateLogCtx(__filename);

export async function RecalcGameProfiles() {
	const users = await db.users.find({});

	for (const user of users) {
		const gpts: Array<ScoreDocument & { _id: { game: Game; playtype: Playtype } }> =
			await db.scores.aggregate([
				{
					$match: {
						userID: user.id,
					},
				},
				{
					$group: {
						_id: {
							game: "$game",
							playtype: "$playtype",
						},
					},
				},
			]);

		logger.info(`Found ${gpts.length} GPTs for ${FormatUserDoc(user)}`);

		for (const gpt of gpts) {
			const { game, playtype } = gpt._id;

			logger.info(`Updating ${FormatUserDoc(user)}'s ${game} ${playtype} stats.`);
			await UpdateUsersGamePlaytypeStats(game, playtype, user.id, null, logger);
		}
	}

	logger.info(`Done.`);
}

if (require.main === module) {
	WrapScriptPromise(RecalcGameProfiles(), logger);
}
