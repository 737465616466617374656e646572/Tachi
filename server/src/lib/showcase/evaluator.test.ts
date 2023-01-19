import { EvaluateShowcaseStat } from "./evaluator";
import deepmerge from "deepmerge";
import db from "external/mongo/db";
import { IIDX_LAMPS } from "tachi-common";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { Testing511SPA, TestingIIDXFolderSP10, TestingIIDXSPScorePB } from "test-utils/test-data";
import { CreateFolderChartLookup } from "utils/folder";

/* eslint-disable no-return-await */
// causes a race condition otherwise due to weird tap interaction

t.test("#EvaluateShowcaseStat", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(async () => {
		await CreateFolderChartLookup(TestingIIDXFolderSP10, true);
	});
	t.beforeEach(
		async () => await db["personal-bests"].insert(deepmerge(TestingIIDXSPScorePB, {}))
	);

	t.test("Should evaluate a folder stat.", async (t) => {
		const data = await EvaluateShowcaseStat(
			"iidx:SP",
			{
				folderID: TestingIIDXFolderSP10.folderID,
				mode: "folder",
				metric: "lamp",
				gte: IIDX_LAMPS.HARD_CLEAR,
			},
			1
		);

		t.strictSame(data, {
			value: 1,
			outOf: 1,
		});

		t.end();
	});

	t.test("Should evaluate a chart stat.", async (t) => {
		const data = await EvaluateShowcaseStat(
			"iidx:SP",
			{
				chartID: Testing511SPA.chartID,
				mode: "chart",
				metric: "score",
			},
			1
		);

		t.strictSame(data, {
			value: 1479,
		});

		t.end();
	});

	t.test("Should return null if the user has no score on this chart.", async (t) => {
		const data = await EvaluateShowcaseStat(
			"iidx:SP",
			{
				chartID: "nonsense",
				mode: "chart",
				metric: "score",
			},
			1
		);

		t.strictSame(data, {
			value: null,
		});

		t.end();
	});

	t.end();
});
