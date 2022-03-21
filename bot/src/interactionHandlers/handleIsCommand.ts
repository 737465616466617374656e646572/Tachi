import { CommandInteraction, MessageEmbed } from "discord.js";
import { SLASH_COMMANDS } from "../commands/commands";
import { LoggerLayers } from "../data/data";
import { DiscordUserMapDocument } from "../database/documents";
import { CreateLayeredLogger } from "../utils/logger";

const logger = CreateLayeredLogger(LoggerLayers.slashCommands);

/**
 * Handles incoming command requests by resolving the interaction to the command
 * it refers to, and calling it.
 *
 * @param interaction - The interaction the user made. This contains things like what
 * command they called and with what arguments.
 * @param requestingUser - The user who interacted with this command.
 */
export async function handleIsCommand(
	interaction: CommandInteraction,
	requestingUser: DiscordUserMapDocument
) {
	try {
		const command = SLASH_COMMANDS.get(interaction.commandName);

		if (!command) {
			throw new Error(`A command was requested that does not exist.`);
		}

		if (command) {
			logger.verbose(`Running ${command.info.name} interaction.`);
			try {
				const response = await command.exec(interaction, requestingUser);

				if (response instanceof MessageEmbed) {
					await interaction.reply({ embeds: [response] });
				} else {
					await interaction.reply(response);
				}
			} catch (err) {
				logger.error(`An error occured while executing a command.`, { command, err });
				interaction.reply(
					`An error has occured while executing this command. This has been reported.`
				);
			}
		}
	} catch (e) {
		logger.error("Failed to handle isCommand interaction", { error: e });
		throw e;
	}
}
