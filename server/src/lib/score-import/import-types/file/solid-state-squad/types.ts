import type { integer } from "tachi-common";

export interface S3Score {
	id: integer;
	diff: "A" | "A14" | "B" | "B14" | "L7" | "L14" | 5 | 7 | 14;
	songname: string;
	exscore: integer;
	styles: string;
	scorebreakdown?: {
		justgreats: integer;
		greats: integer;
		good: integer;
		bad: integer;
		poor: integer;
	};
	mods: {
		hardeasy?: "E" | "H";
	};
	cleartype: "cleared" | "combo" | "comboed" | "perfect" | "perfected" | "played";
	date: string;
	comment?: string;
}
