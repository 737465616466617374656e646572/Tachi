import { Router } from "express";
import db from "external/mongo/db";
import { GetRivalUsers } from "lib/rivals/rivals";
import { SearchSpecificGameSongsAndCharts } from "lib/search/search";
import prValidate from "server/middleware/prudence-validate";
import { AggressiveRateLimitMiddleware } from "server/middleware/rate-limiter";
import { GetGamePTConfig } from "tachi-common";
import { GetRelevantSongsAndCharts } from "utils/db";
import { IsValidScoreAlg } from "utils/misc";
import { GetAdjacentAbove, GetAdjacentBelow } from "utils/queries/pbs";
import { GetUGPT } from "utils/req-tachi-data";
import { FilterChartsAndSongs, GetPBOnChart, GetScoreIDsFromComposed } from "utils/scores";
import { GetUsersWithIDs } from "utils/user";

const router: Router = Router({ mergeParams: true });

/**
 * Searches a user's personal bests.
 *
 * @param search - The search criteria.
 *
 * @name GET /api/v1/users/:userID/games/:game/:playtype/pbs
 */
router.get("/", async (req, res) => {
	const { user, game, playtype } = GetUGPT(req);

	if (typeof req.query.search !== "string") {
		return res.status(400).json({
			success: false,
			description: `Invalid value of for search parameter.`,
		});
	}

	const { songs: allSongs, charts: allCharts } = await SearchSpecificGameSongsAndCharts(
		game,
		req.query.search,
		playtype
	);

	const pbs = await db["personal-bests"].find(
		{
			chartID: { $in: allCharts.map((e) => e.chartID) },
			userID: user.id,
		},
		{
			sort: {
				timeAchieved: -1,
			},
			limit: 30,
		}
	);

	const { songs, charts } = FilterChartsAndSongs(pbs, allCharts, allSongs);

	return res.status(200).json({
		success: true,
		description: `Retrieved ${pbs.length} personal bests.`,
		body: {
			pbs,
			songs,
			charts,
		},
	});
});

/**
 * Returns all of a users personal bests.
 *
 * @warn This endpoint is probably quite expensive. We'll need to do
 * some performance tests.
 *
 * @name GET /api/v1/users/:userID/games/:game/:playtype/pbs/all
 */
router.get("/all", AggressiveRateLimitMiddleware, async (req, res) => {
	const { user, game, playtype } = GetUGPT(req);

	const pbs = await db["personal-bests"].find({
		userID: user.id,
		game,
		playtype,
		isPrimary: true,
	});

	const { songs, charts } = await GetRelevantSongsAndCharts(pbs, game);

	return res.status(200).json({
		success: true,
		description: `Returned ${pbs.length} PBs.`,
		body: { pbs, songs, charts },
	});
});

/**
 * Returns a users best 100 personal-bests for this game.
 *
 * @param alg - Specifies an override for the default algorithm
 * to sort on.
 *
 * @name GET /api/v1/users/:userID/games/:game/:playtype/pbs/best
 */
router.get("/best", prValidate({ alg: "*string" }), async (req, res) => {
	const { user, game, playtype } = GetUGPT(req);

	const gptConfig = GetGamePTConfig(game, playtype);

	if (req.query.alg !== undefined && !IsValidScoreAlg(gptConfig, req.query.alg)) {
		return res.status(400).json({
			success: false,
			description: `Invalid score algorithm. Expected any of ${Object.keys(
				gptConfig.scoreRatingAlgs
			).join(", ")}`,
		});
	}

	const alg = (req.query.alg as string | undefined) ?? gptConfig.defaultScoreRatingAlg;

	const pbs = await db["personal-bests"].find(
		{
			userID: user.id,
			game,
			playtype,
			isPrimary: true,
		},
		{
			limit: 100,
			sort: {
				[`calculatedData.${alg}`]: -1,
			},
		}
	);

	const { songs, charts } = await GetRelevantSongsAndCharts(pbs, game);

	return res.status(200).json({
		success: true,
		description: `Retrieved ${pbs.length} personal bests.`,
		body: {
			pbs,
			songs,
			charts,
		},
	});
});

/**
 * Returns a user's PB on the given chart. If the user has not played this chart, 404 is
 * returned.
 *
 * @param getComposition - Also retrieves the score documents that composed this PB.
 *
 * @name GET /api/v1/users/:userID/games/:game/:playtype/pbs/:chartID
 */
router.get("/:chartID", async (req, res) => {
	const { user, game, playtype } = GetUGPT(req);

	const chart = await db.anyCharts[game].findOne({
		chartID: req.params.chartID,
		playtype,
	});

	if (!chart) {
		return res.status(404).json({
			success: false,
			description: `This chart does not exist.`,
		});
	}

	const pb = await db["personal-bests"].findOne({
		chartID: req.params.chartID,
		userID: user.id,
	});

	if (!pb) {
		return res.status(404).json({
			success: false,
			description: `This user has not played this chart.`,
		});
	}

	if (req.query.getComposition !== undefined) {
		const scoreIDs = GetScoreIDsFromComposed(pb);

		const scores = await db.scores.find({
			scoreID: { $in: scoreIDs },
		});

		return res.status(200).json({
			success: true,
			description: `Successfully retrieved PB for user.`,
			body: {
				scores,
				chart,
				pb,
			},
		});
	}

	return res.status(200).json({
		success: true,
		description: `Successfully retrieved PB for user.`,
		body: {
			pb,
			chart,
		},
	});
});

/**
 * Returns a user's PB on the given chart, and all of their rivals performances aswell.
 *
 * @name GET /api/v1/users/:userID/games/:game/:playtype/pbs/:chartID/rivals
 */
router.get("/:chartID/rivals", async (req, res) => {
	const { user, game, playtype } = GetUGPT(req);

	const rivals = await GetRivalUsers(user.id, game, playtype);

	const pbs = await db["personal-bests"].find({
		userID: { $in: rivals.map((e) => e.id) },
		chartID: req.params.chartID,
	});

	const usersPB = await GetPBOnChart(user.id, req.params.chartID);

	if (usersPB) {
		pbs.push(usersPB);
	}

	return res.status(200).json({
		success: true,
		description: `Retrieved PBs and Rival PBs.`,
		body: {
			pbs,
			rivals,
		},
	});
});

/**
 * Return this users PB on this chart, and 5 nearby players on the
 * leaderboard.
 *
 * @name GET /api/v1/users/:userID/games/:game/:playtype/pbs/:chartID/leaderboard-adjacent
 */
router.get("/:chartID/leaderboard-adjacent", async (req, res) => {
	const { user, game, playtype } = GetUGPT(req);

	const chart = await db.anyCharts[game].findOne({
		chartID: req.params.chartID,
		playtype,
	});

	if (!chart) {
		return res.status(404).json({
			success: false,
			description: `This chart does not exist.`,
		});
	}

	const pb = await db["personal-bests"].findOne({
		chartID: req.params.chartID,
		userID: user.id,
	});

	if (!pb) {
		return res.status(404).json({
			success: false,
			description: `This user has not played this chart.`,
		});
	}

	const [adjacentAbove, adjacentBelow] = await Promise.all([
		GetAdjacentAbove(pb),
		GetAdjacentBelow(pb),
	]);

	const users = await GetUsersWithIDs([...adjacentAbove, ...adjacentBelow].map((e) => e.userID));

	return res.status(200).json({
		success: true,
		description: `Successfully retrieved PB for user.`,
		body: {
			pb,
			chart,
			adjacentAbove,
			adjacentBelow,
			users,
		},
	});
});

export default router;
