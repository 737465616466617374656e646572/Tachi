import { IsNonEmptyString } from "utils/misc";
import fs from "fs";
import path from "path";

const SNAP_PATH = path.join(__dirname, "./snapshots/snapshot-data.json");

type Snapshots = Record<string, boolean | number | string>;

function ReadSnapshotData() {
	let snapshots: Snapshots = {};

	if (fs.existsSync(SNAP_PATH)) {
		snapshots = JSON.parse(fs.readFileSync(SNAP_PATH, "utf-8")) as Snapshots;
	}

	return snapshots;
}

export function WriteSnapshotData() {
	fs.writeFileSync(SNAP_PATH, JSON.stringify(snapshotData, null, "\t"));
}

const snapshotData = ReadSnapshotData();

export function TestSnapshot(t: Tap.Test, value: any, testName: string) {
	if (IsNonEmptyString(process.env.TAP_SNAPSHOT)) {
		snapshotData[testName] = value;
		WriteSnapshotData();
	} else {
		if (snapshotData[testName] === undefined) {
			return t.fail(`No snapshot exists for ${testName}. Have you ran pnpm snap?`);
		}

		t.strictSame(value, snapshotData[testName], `Snapshot: ${testName}`);
	}
}
