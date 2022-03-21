import { Snowflake } from "discord.js";
import { integer } from "tachi-common";

export interface DiscordUserMapDocument {
	userID: integer;
	discordID: Snowflake;
	tachiApiToken: string;
}

export interface QuoteDocument {
	quoteID: string;
	text: string;
	quotedAt: integer;
	quotedBy: integer;
	hits: integer;
}
