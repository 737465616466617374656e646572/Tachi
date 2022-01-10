import t from "tap";
import { ImportDocument, ScoreDocument, SessionDocument } from "tachi-common";
import deepmerge from "deepmerge";
import { TestingIIDXSPScore } from "test-utils/test-data";
import db from "external/mongo/db";
import UpdateScore from "./update-score";
import { CreateScoreID } from "lib/score-import/framework/score-importing/score-id";
import ResetDBState from "test-utils/resets";
import { rootLogger } from "lib/logger/logger";

const mockImportDocument: ImportDocument = {
	userID: 1,
	userIntent: false,
	classDeltas: [],
	createdSessions: [],
	errors: [],
	goalInfo: [],
	idStrings: [],
	importID: "mockImportID",
	importType: "file/batch-manual",
	milestoneInfo: [],
	scoreIDs: ["scoreid_1", "scoreid_2"],
	timeFinished: 1000,
	timeStarted: 0,
	game: "iidx",
	playtypes: ["SP"],
};

const mockSessionDocument: SessionDocument = {
	userID: 1,
	calculatedData: {},
	desc: "",
	game: "iidx",
	playtype: "SP",
	highlight: false,
	importType: "file/batch-manual",
	name: "",
	scoreInfo: [
		{
			isNewScore: true,
			scoreID: "scoreid_1",
		},
		{
			isNewScore: true,
			scoreID: "scoreid_2",
		},
	],
	sessionID: "mockSessionID",
	timeEnded: 1000,
	timeInserted: 0,
	timeStarted: 0,
	views: 0,
};

t.test("#UpdateScore", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should update a score and everything pertaining to it", async (t) => {
		TestingIIDXSPScore.scoreID = "scoreid_1";

		const score = deepmerge<ScoreDocument>(TestingIIDXSPScore, {
			scoreData: { score: 1020 },
		} as any);

		delete score._id;

		const newScoreID = CreateScoreID(score.userID, score, score.chartID);

		rootLogger.crit(newScoreID);

		await db.imports.insert(mockImportDocument);
		await db.sessions.insert(mockSessionDocument);

		await db.scores.insert(TestingIIDXSPScore);

		// This function doesn't return anything, instead,
		// we need to check external state.
		await UpdateScore(TestingIIDXSPScore, score);

		const dbScore = await db.scores.findOne({
			scoreID: "scoreid_1",
		});

		t.equal(dbScore, null, "Should have updated the scoreID from the database.");

		const dbNewScore = await db.scores.findOne({
			scoreID: newScoreID,
		});

		t.hasStrict(
			dbNewScore?.scoreData,
			score.scoreData,
			"The new score inserted into the database should have the new scoreData."
		);

		const dbImport = await db.imports.findOne({
			importID: "mockImportID",
		});

		t.strictSame(
			dbImport?.scoreIDs,
			[newScoreID, "scoreid_2"],
			"Should update scoreid_1 to the new hash."
		);

		const dbSession = await db.sessions.findOne({
			sessionID: "mockSessionID",
		});

		t.strictSame(
			dbSession?.scoreInfo,
			[
				{
					isNewScore: true,
					scoreID: newScoreID,
				},
				{
					isNewScore: true,
					scoreID: "scoreid_2",
				},
			],
			"Should update scoreid_1 to the new hash."
		);

		t.end();
	});

	t.end();
});
