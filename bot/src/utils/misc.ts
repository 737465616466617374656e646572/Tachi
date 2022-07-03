import { BotConfig } from "../config";
import humaniseDuration from "humanize-duration";
import _ from "lodash";
import { DateTime } from "luxon";
import { GenericFormatGradeDelta, GetGameConfig, GetGamePTConfig } from "tachi-common";
import type { Client } from "discord.js";
import type {
	ChartDocument,
	Game,
	GoalDocument,
	Grades,
	IDStrings,
	integer,
	PBScoreDocument,
	Playtype,
	Playtypes,
	PublicUserDocument,
	ScoreCalculatedDataLookup,
	ScoreDocument,
	SongDocument,
	UGSRatingsLookup,
	GameConfig,
} from "tachi-common";
import type { GameClassSets } from "tachi-common/game-classes";

/**
 * Random From Array - Selects a random value from an array.
 */
export function RFA<T>(arr: Array<T>): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function TruncateString(string: string, len = 30) {
	if (string.length < len) {
		return string;
	}

	return `${string.substring(0, len - 3)}...`;
}

/**
 * Checks whether a discord user has admin permissions or not. This lets them do
 * slightly more destructive things.
 */
export function IsAdmin(discordID: string) {
	return BotConfig.DISCORD.ADMIN_USERS.includes(discordID);
}

export function Sleep(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
}

export function Pluralise(int: integer, str: string) {
	if (int === 1) {
		return str;
	}

	return `${str}s`;
}

export function FormatProfileRating(
	game: Game,
	playtype: Playtype,
	rating: UGSRatingsLookup[IDStrings],
	value: number | null | undefined
) {
	if (value === null || value === undefined) {
		return "No Data.";
	}

	const formatter = GetGamePTConfig(game, playtype).profileRatingAlgFormatters[rating];

	if (!formatter) {
		return value.toFixed(2);
	}

	return formatter(value);
}

export function FormatScoreRating(
	game: Game,
	playtype: Playtype,
	rating: ScoreCalculatedDataLookup[IDStrings],
	value: number | null | undefined
) {
	if (value === null || value === undefined) {
		return "No Data.";
	}

	const formatter = GetGamePTConfig(game, playtype).scoreRatingAlgFormatters[rating];

	if (!formatter) {
		return value.toFixed(2);
	}

	return formatter(value);
}

/**
 * Typesafe asserted version of Object.entries.
 */
export function Entries<K extends string, V>(rec: Partial<Record<K, V>>): Array<[K, V]> {
	return Object.entries(rec) as Array<[K, V]>;
}

export function ParseGPT(str: string) {
	const spl = str.split(":");

	const game = spl[0] as Game;
	const playtype = spl[1] as Playtype;

	// this is an interesting way of game checking noah
	const gameConfig = GetGameConfig(game) as GameConfig | undefined;

	if (!gameConfig || !gameConfig.validPlaytypes.includes(playtype)) {
		throw new Error(`Invalid GPT Combination '${str}'.`);
	}

	return { game, playtype };
}

export function UppercaseFirst(str: string) {
	if (!str[0]) {
		return "";
	}

	return str[0].toUpperCase() + str.substring(1);
}

export function MillisToSince(ms: number) {
	return DateTime.fromMillis(ms).toRelative();
}

export function FormatTime(ms: number) {
	return DateTime.fromMillis(ms).toLocaleString(DateTime.DATETIME_MED);
}

export function FormatDate(ms: number) {
	return DateTime.fromMillis(ms).toLocaleString(DateTime.DATE_HUGE);
}

export function FormatDuration(ms: number) {
	return humaniseDuration(ms, {
		units: ["d", "h", "m"],
		maxDecimalPoints: 0,
	});
}

export function FormatTimeSmall(ms: number) {
	return DateTime.fromMillis(ms).toLocaleString(DateTime.DATE_SHORT);
}

export function FormatClass(
	game: Game,
	playtype: Playtype,
	classSet: GameClassSets[IDStrings],
	classValue: integer
) {
	const gptConfig = GetGamePTConfig(game, playtype);

	const classInfo = gptConfig.classHumanisedFormat[classSet][classValue];

	if (!classInfo) {
		throw new Error(
			`Couldn't find a class at index ${classValue} for ${game} ${playtype} ${classSet}?`
		);
	}

	return classInfo.display;
}

/**
 * Given a game, return the discord channel it's associated with.
 */
export function GetGameChannel(client: Client, game: Game) {
	const gameChannelID = BotConfig.DISCORD.GAME_CHANNELS[game];

	if (!gameChannelID) {
		throw new Error(
			`Attempted to get channel for ${game}, but no GAME_CHANNEL was registered.`
		);
	}

	const channel = client.channels.cache.find((c) => c.id === gameChannelID);

	if (!channel) {
		throw new Error(`No channel with ID ${gameChannelID} is in the cache for this bot.`);
	}

	if (!channel.isText()) {
		throw new Error(
			`Channel ${gameChannelID} (${game}) is not a text channel. Can't send message.`
		);
	}

	return channel;
}

/**
 * Given a chart and a game, return a link to the site for that chart.
 */
export function CreateChartLink(chart: ChartDocument, game: Game) {
	if (chart.isPrimary) {
		return `${BotConfig.TACHI_SERVER_LOCATION}/dashboard/games/${game}/${
			chart.playtype
		}/songs/${chart.songID}/${encodeURIComponent(chart.difficulty)}`;
	}

	return `${BotConfig.TACHI_SERVER_LOCATION}/dashboard/games/${game}/${chart.playtype}/songs/${chart.songID}/${chart.chartID}`;
}

type ScOrPBDoc<I extends IDStrings> = PBScoreDocument<I> | ScoreDocument<I>;

export function FormatScoreData<I extends IDStrings = IDStrings>(score: ScOrPBDoc<I>) {
	const game = score.game;

	let lampStr: string = score.scoreData.lamp;
	let scoreStr = `${score.scoreData.score.toLocaleString()} (${
		score.scoreData.grade
	}, ${score.scoreData.percent.toFixed(2)}%)`;

	if (game === "iidx" || game === "bms" || game === "pms") {
		const bp = (
			score as ScOrPBDoc<
				"bms:7K" | "bms:14K" | "iidx:DP" | "iidx:SP" | "pms:Controller" | "pms:Keyboard"
			>
		).scoreData.hitMeta.bp;

		lampStr = `${score.scoreData.lamp} (BP: ${bp ?? "No Data"})`;

		const { lower, upper, closer } = GenericFormatGradeDelta(
			game,
			score.playtype,
			score.scoreData.score,
			score.scoreData.percent,
			score.scoreData.grade
		);

		scoreStr = `${closer === "lower" ? lower : upper} (${
			score.scoreData.score
		}, ${score.scoreData.percent.toFixed(2)}%)`;
	}

	return { lampStr, scoreStr };
}

/**
 * Util for getting a games' grade for a given percent.
 */
export function GetGradeFromPercent<I extends IDStrings = IDStrings>(
	game: Game,
	playtype: Playtype,
	percent: number
): Grades[I] {
	const gptConfig = GetGamePTConfig(game, playtype);
	const boundaries = gptConfig.gradeBoundaries;
	const grades = gptConfig.grades;

	if (!boundaries) {
		throw new Error(
			`Invalid call to GetGradeFromPercent! GPT ${game}:${playtype} does not use grade boundaries.`
		);
	}

	// (hey, this for loop is backwards!)
	for (let i = boundaries.length; i >= 0; i--) {
		if (percent + Number.EPSILON >= boundaries[i]!) {
			return grades[i] as Grades[I];
		}
	}

	throw new Error(`Couldn't find grade for ${game}:${playtype} (${percent}%)`);
}

export function FormatIIDXEXScore(
	exscore: integer,
	notecount: integer,
	playtype: Playtypes["iidx"]
) {
	const percent = (exscore * 100) / (notecount * 2);

	const { closer, upper, lower } = GenericFormatGradeDelta(
		"iidx",
		playtype,
		exscore,
		percent,
		GetGradeFromPercent("iidx", playtype, percent)
	);

	return `${closer === "lower" ? lower : upper} (${exscore}, ${percent.toFixed(2)}%)`;
}

export function GetChartPertinentInfo<I extends IDStrings>(game: Game, chart: ChartDocument<I>) {
	if (game === "iidx") {
		const ch = chart as ChartDocument<"iidx:DP" | "iidx:SP">;

		if (ch.data.kaidenAverage === null || ch.data.worldRecord === null) {
			return null;
		}

		return `皆伝 Average: ${FormatIIDXEXScore(
			ch.data.kaidenAverage,
			ch.data.notecount,
			ch.playtype
		)}
e-amusement WR: ${FormatIIDXEXScore(ch.data.worldRecord, ch.data.notecount, ch.playtype)}`;
	}

	return null;
}

export function FormatChartTierlistInfo(game: Game, chart: ChartDocument) {
	const gptConfig = GetGamePTConfig(game, chart.playtype);

	if (gptConfig.tierlists.length === 0) {
		return null;
	}

	const fmts = [];

	for (const tierlist of gptConfig.tierlists) {
		const data = chart.tierlistInfo[tierlist];

		if (!data) {
			continue;
		}

		fmts.push(
			`${tierlist}: ${data.text} (${data.value}${
				data.individualDifference === true ? " ⚖️" : ""
			})`
		);
	}

	if (fmts.length === 0) {
		return null;
	}

	return fmts.join("\n");
}

export function ConvertInputIntoGenerousRegex(input: string) {
	const inputSafeRegex = _.escapeRegExp(input);

	// for any non-ascii input, replace them with a ".?", representing maybe. This
	// is so users can say things like "Re Master" or "Remaster" for "Re:Master".
	// It also generally gives lenience.
	// We match based on what the string starts with case-insensitively.
	// "A" will match "ANOTHER", but not "NORMAL".
	const regex = new RegExp(`^${inputSafeRegex.replace(/[^a-zA-Z]/gu, ".?")}`, "iu");

	return regex;
}

export function CreateSongMap<G extends Game = Game>(songs: Array<SongDocument<G>>) {
	const songMap = new Map<integer, SongDocument<G>>();

	for (const song of songs) {
		songMap.set(song.id, song);
	}

	return songMap;
}

export function CreateUserMap(users: Array<PublicUserDocument>) {
	const userMap = new Map<integer, PublicUserDocument>();

	for (const user of users) {
		userMap.set(user.id, user);
	}

	return userMap;
}

export function CreateGoalMap(goals: Array<GoalDocument>) {
	const goalMap = new Map<string, GoalDocument>();

	for (const goal of goals) {
		goalMap.set(goal.goalID, goal);
	}

	return goalMap;
}

export function CreateChartIDMap<T extends { chartID: string }>(arr: Array<T>): Map<string, T> {
	const map = new Map<string, T>();

	for (const t of arr) {
		map.set(t.chartID, t);
	}

	return map;
}

export function CreateChartMap<I extends IDStrings = IDStrings>(charts: Array<ChartDocument<I>>) {
	const chartMap = new Map<string, ChartDocument<I>>();

	for (const chart of charts) {
		chartMap.set(chart.chartID, chart);
	}

	return chartMap;
}

export function CreateScoreIDMap<I extends IDStrings = IDStrings>(scores: Array<ScoreDocument<I>>) {
	const scoreMap = new Map<string, ScoreDocument<I>>();

	for (const score of scores) {
		scoreMap.set(score.scoreID, score);
	}

	return scoreMap;
}

/**
 * Sorts On Value numerically.
 * @returns A sorting function
 */
export function NumericSOV<T>(getValueFn: (data: T) => number, reverse = false) {
	if (reverse) {
		return (a: T, b: T) => getValueFn(b) - getValueFn(a);
	}

	return (a: T, b: T) => getValueFn(a) - getValueFn(b);
}

/**
 * Sorts On Value using locale compare.
 * @returns A sorting function
 */
export function StrSOV<T>(getValueFn: (data: T) => string) {
	return (a: T, b: T) => getValueFn(a).localeCompare(getValueFn(b));
}

export function UniqueOnKey<T>(prop: keyof T) {
	const seenBefore = new Set<T[keyof T]>();

	return (item: T) => {
		if (seenBefore.has(item[prop])) {
			return false;
		}

		seenBefore.add(item[prop]);

		return true;
	};
}

export const ONE_SECOND = 1000;
export const ONE_MINUTE = ONE_SECOND * 60;
export const ONE_HOUR = ONE_MINUTE * 60;
export const ONE_DAY = ONE_HOUR * 24;
export const ONE_WEEK = ONE_DAY * 7;
