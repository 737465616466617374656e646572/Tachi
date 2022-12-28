import db from "external/mongo/db";
import type { ScoreDocument, SessionDocument } from "tachi-common";

/**
 * Returns all the score documents inside a session.
 * @param session The session to retrieve the score documents of.
 */
export function GetScoresFromSession(session: SessionDocument) {
	return db.scores.find({
		scoreID: { $in: session.scoreIDs },
	});
}

/**
 * Returns the session a score belongs to, if there is one. A score can only be part of one session implicitly.
 * @param score The score to return the associated session of.
 */
export function GetSessionFromScore(score: ScoreDocument) {
	return db.sessions.findOne({
		scoreIDs: score.scoreID,
	});
}
