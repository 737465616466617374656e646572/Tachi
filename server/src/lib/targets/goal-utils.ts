import db from "external/mongo/db";
import { GenericCalculatePercent } from "lib/score-import/framework/common/score-utils";
import { FormatGame, GetGamePTConfig } from "tachi-common";
import { GetFolderForIDGuaranteed, HumaniseChartID } from "utils/db";
import { GetFolderChartIDs } from "utils/folder";
import { FormatMaxDP, HumanisedJoinArray } from "utils/misc";
import type { ChartDocument, Game, GoalDocument, Playtype } from "tachi-common";

export async function CreateGoalTitle(
	charts: GoalDocument["charts"],
	criteria: GoalDocument["criteria"],
	game: Game,
	playtype: Playtype
) {
	const formattedCriteria = FormatCriteria(criteria, game, playtype);

	const datasetName = await FormatCharts(charts, criteria, game);

	// Formatting this stuff into english is hard and excruciatingly manual.
	switch (criteria.mode) {
		case "single":
			switch (charts.type) {
				case "single":
					return `${formattedCriteria} ${datasetName}`;

				case "multi": {
					if (charts.data.length === 2) {
						// CLEAR either A or B
						return `${formattedCriteria} either ${datasetName}`;
					}

					// CLEAR any of A, B or C.
					return `${formattedCriteria} any one of ${datasetName}`;
				}

				case "folder":
					return `${formattedCriteria} any chart in ${datasetName}`;
			}

		// Eslint can't figure out that the above switches are safely exhastive. Ah well.
		// eslint-disable-next-line no-fallthrough
		case "absolute":
			switch (charts.type) {
				case "multi": {
					// CLEAR all of A, B and C
					if (criteria.countNum === charts.data.length) {
						return `${formattedCriteria} ${datasetName}`;
					}

					// CLEAR any 2 of A, B or C
					return `${formattedCriteria} any ${criteria.countNum} of ${datasetName}`;
				}

				case "folder":
					return `${formattedCriteria} ${criteria.countNum} charts in ${datasetName}`;
				case "single":
					throw new Error(
						`Invalid goal -- absolute mode cannot be paired with a charts.type of 'single'.`
					);
			}

		// See above about switch exhaustivity
		// eslint-disable-next-line no-fallthrough
		case "proportion": {
			const propFormat = FormatMaxDP(criteria.countNum * 100);

			switch (charts.type) {
				case "multi":
					return `${formattedCriteria} ${propFormat}% of ${datasetName}`;
				case "folder":
					return `${formattedCriteria} ${propFormat}% of the charts in ${datasetName}`;
				case "single":
					throw new Error(
						`Invalid goal -- absolute mode cannot be paired with a charts.type of 'single'.`
					);
			}
		}
	}
}

async function FormatCharts(
	charts: GoalDocument["charts"],
	criteria: GoalDocument["criteria"],
	game: Game
) {
	switch (charts.type) {
		case "single":
			return HumaniseChartID(game, charts.data);
		case "multi": {
			// @inefficient
			// This could be done with significantly less db queries.
			const formattedTitles = await Promise.all(
				charts.data.map((chartID) => HumaniseChartID(game, chartID))
			);

			// In the case where this is an absolute query for *all* of these charts
			// we want it to be A, B and C
			// instead of A, B or C
			// for things like CLEAR A, B or C.
			if (criteria.mode === "absolute" && criteria.countNum === charts.data.length) {
				return HumanisedJoinArray(formattedTitles, "and");
			}

			return HumanisedJoinArray(formattedTitles);
		}

		case "folder": {
			const folder = await GetFolderForIDGuaranteed(charts.data);

			return `the ${folder.title} folder`;
		}

		default:
			throw new Error(
				`Invalid goal charts.type -- got ${
					(charts as GoalDocument["charts"]).type
				}, which we don't support?`
			);
	}
}

function FormatCriteria(criteria: GoalDocument["criteria"], game: Game, playtype: Playtype) {
	const gptConfig = GetGamePTConfig(game, playtype);

	switch (criteria.key) {
		case "scoreData.gradeIndex":
			return gptConfig.grades[criteria.value];
		case "scoreData.lampIndex":
			return gptConfig.lamps[criteria.value];
		case "scoreData.percent":
			return `Get ${FormatMaxDP(criteria.value)}% on`;
		case "scoreData.score":
			return `Get a score of ${criteria.value.toLocaleString("en-GB")} on`;
	}
}

/**
 * Given a goals' charts and criteria properties, evaluate whether those two make
 * any sense at all. There are certain combinations that are illegal, or values that
 * in general just should be constrained out.
 *
 * @warn This function is disgusting. This should have never happened.
 */
export async function ValidateGoalChartsAndCriteria(
	charts: GoalDocument["charts"],
	criteria: GoalDocument["criteria"],
	game: Game,
	playtype: Playtype
) {
	let chartCount = 0;

	// Validating the charts supplied

	switch (charts.type) {
		case "single": {
			const chart = await db.charts[game].findOne({
				playtype,
				chartID: charts.data,
			});

			if (!chart) {
				throw new Error(
					`A chart with id ${charts.data} does not exist for ${game}:${playtype}.`
				);
			}

			chartCount = 1;
			break;
		}

		case "folder": {
			const folder = await db.folders.findOne({
				game,
				playtype,
				folderID: charts.data,
			});

			if (!folder) {
				throw new Error(
					`A folder with id ${charts.data} does not exist for ${game}:${playtype}.`
				);
			}

			chartCount = (await GetFolderChartIDs(charts.data)).length;
			break;
		}

		case "multi": {
			if (charts.data.length < 2) {
				throw new Error(
					`Invalid charts.data for 'multi' charts. Must specify atleast two charts.`
				);
			}

			const multiCharts = await db.charts[game].find({
				playtype,
				chartID: { $in: charts.data },
			});

			if (multiCharts.length !== charts.data.length) {
				throw new Error(
					`Expected charts.data to match ${charts.data.length} charts. Instead, it only matched ${multiCharts.length}. Are all of these chartIDs valid?`
				);
			}

			chartCount = multiCharts.length;
			break;
		}

		default:
			// @ts-expect-error Charts is stated to be never here, but if we get to this point it's
			// effectively unknown
			throw new Error(`Invalid goal.charts.type of ${charts.type}.`);
	}

	// Validating criteria.mode against countNum.
	if (criteria.mode === "proportion") {
		if (criteria.countNum <= 0 || criteria.countNum > 1) {
			throw new Error(
				`Invalid countNum for goal with criteria.mode of 'proportion'. Expected a decimal in (0, 1]`
			);
		}

		if (Math.floor(chartCount * criteria.countNum) === 0) {
			throw new Error(
				`countNum (${criteria.countNum}) is too small for a goal with ${chartCount} charts. Would result in requiring 0 charts to achieve the goal.`
			);
		}
	} else if (
		criteria.mode === "absolute" &&
		(criteria.countNum > chartCount ||
			!Number.isInteger(criteria.countNum) ||
			criteria.countNum < 2)
	) {
		throw new Error(
			`Invalid countNum for goal with criteria.mode of 'absolute'. Expected a whole number less than the total amount of charts available and greater than 1. (Got ${criteria.countNum}, while total charts was ${chartCount}.)`
		);
	}

	// checking whether the key and value make sense
	const gptConfig = GetGamePTConfig(game, playtype);

	if (criteria.key === "scoreData.gradeIndex" && !gptConfig.grades[criteria.value]) {
		throw new Error(
			`Invalid value of ${criteria.value} for grade goal. No such grade exists at that index.`
		);
	} else if (criteria.key === "scoreData.lampIndex" && !gptConfig.lamps[criteria.value]) {
		throw new Error(
			`Invalid value of ${criteria.value} for lamp goal. No such lamp exists at that index.`
		);
	} else if (
		criteria.key === "scoreData.percent" &&
		(criteria.value <= 0 || criteria.value > gptConfig.percentMax)
	) {
		throw new Error(
			`Invalid value of ${criteria.value} for percent goal. Percents must be between 0 and ${gptConfig.percentMax}.`
		);
	} else if (criteria.key === "scoreData.score") {
		if (criteria.value < 0) {
			throw new Error(`Invalid score value for goal. Can't be negative.`);
		}

		// troublemaker games where score is relative to notecount
		if (game === "iidx" || game === "bms" || game === "pms") {
			if (charts.type !== "single") {
				throw new Error(
					`Invalid key for ${game} with multiple charts. Creating score goals on multiple charts where score is relative to notecount is a terrible idea, and has been disabled.`
				);
			}

			const relatedChart = (await db.charts[game].findOne({
				playtype,
				chartID: charts.data,
			})) as ChartDocument<
				"bms:7K" | "bms:14K" | "iidx:DP" | "iidx:SP" | "pms:Controller" | "pms:Keyboard"
			>;

			const notecount = relatedChart.data.notecount;

			if (criteria.value > notecount * 2) {
				throw new Error(
					`Invalid value of ${
						criteria.value
					} for goal. Maximum score possible on this chart is ${notecount * 2}.`
				);
			}
		} else if (GenericCalculatePercent(game, criteria.value) >= gptConfig.percentMax) {
			throw new Error(
				`Score of ${criteria.value} is too large for ${FormatGame(game, playtype)}.`
			);
		}
	}

	if (charts.type === "single" && criteria.mode !== "single") {
		throw new Error(`Criteria Mode must be 'single' if Charts Type is 'single'.`);
	}

	if (charts.type === "multi" && criteria.mode === "proportion") {
		throw new Error(
			`Criteria Mode must be 'single' or 'absolute' if Charts Type is 'multi'. Doesn't make sense to have proportional goals when you're capped at 10 charts.`
		);
	}
}
