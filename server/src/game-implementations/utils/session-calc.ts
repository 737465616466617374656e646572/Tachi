import type { SessionCalculator } from "game-implementations/types";
import type { GPTString, ScoreDocument, integer } from "tachi-common";

export function SessionAverageBestN(vals: Array<number | null | undefined>, n = 10) {
	const numbers = vals.filter((e) => typeof e === "number") as Array<number>;

	if (numbers.length < n) {
		return null;
	}

	return (
		numbers
			.sort((a, b) => b - a)
			.slice(0, n)
			.reduce((a, e) => a + e, 0) / n
	);
}

export function SessionAvgBest10For<GPT extends GPTString>(
	prop: keyof ScoreDocument<GPT>["calculatedData"]
): SessionCalculator<GPT> {
	return (arr) =>
		SessionAverageBestN(
			arr.map((e) => e[prop]),
			10
		);
}

export function SessionAvgBestNFor<GPT extends GPTString>(
	prop: keyof ScoreDocument<GPT>["calculatedData"],
	n: integer
): SessionCalculator<GPT> {
	return (arr) =>
		SessionAverageBestN(
			arr.map((e) => e[prop]),
			n
		);
}
