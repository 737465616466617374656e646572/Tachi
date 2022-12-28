import CreateLogCtx from "lib/logger/logger";
import { TachiConfig } from "lib/setup/config";
import redis from "redis";

/**
 * This code has been stubbed out! It doesn't really have a use at the moment.
 * At some point, though, we might actually need this. (Maybe for a logging framework)
 *
 * This was used to communicate with other processes running on the same host as this server.
 * The idea was the use it for the discord bot, however, we have webhooks now that do this (better).
 * Thanks!
 */

const logger = CreateLogCtx(__filename);

// Stub types. In the future, we may actually use this.
export type RedisIPCChannels = "";
export interface RedisIPCData {
	"": unknown;
}

type RedisSubCallback<T extends RedisIPCChannels> = (data: RedisIPCData[T]) => void;

type SubCallbacksType = {
	[K in RedisIPCChannels]: Array<RedisSubCallback<K>>;
};

const SubCallbacks: Partial<SubCallbacksType> = {};

// Redis doesn't allow one client to subscribe and publish
// There's little to no overhead to having these three clients,
// so - that's why its like this.
const SubClient = redis.createClient();
const PubClient = redis.createClient();

const PREFIX = TachiConfig.NAME.toUpperCase();

export function RedisPub<T extends RedisIPCChannels>(channel: T, data: RedisIPCData[T]) {
	PubClient.publish(`${PREFIX}-${channel}`, JSON.stringify(data));
}

export function RedisSub<T extends RedisIPCChannels>(channel: T, callback: RedisSubCallback<T>) {
	if (SubCallbacks[channel]) {
		SubCallbacks[channel]!.push(callback);
		logger.debug(`Pushed callback ${callback.name} to channel ${channel}.`);
	} else {
		// @ts-expect-error see above.
		SubCallbacks[channel] = [callback];
		SubClient.subscribe(`${PREFIX}-${channel}`);
		logger.debug(`Added first callback ${callback.name} to channel ${channel}.`);
	}
}

SubClient.on("message", (channel, strData) => {
	if (!channel.startsWith(`${PREFIX}-`)) {
		// not our business
		return;
	}

	const ktChannel = channel.slice(`${PREFIX}-`.length) as RedisIPCChannels;

	if (!Object.prototype.hasOwnProperty.call(SubCallbacks, ktChannel)) {
		// no callbacks to call
		return;
	}

	const jsData = JSON.parse(strData) as unknown;

	for (const cb of SubCallbacks[ktChannel]!) {
		try {
			cb(jsData);
		} catch (err) {
			logger.error(`Error calling callback ${cb.name} for channel ${ktChannel}`, { err });
		}
	}
});

// Awful...
// Function is near-impossible to test.
/* istanbul ignore next */
export function CloseRedisPubSub() {
	return new Promise<void>((resolve, reject) => {
		PubClient.quit((err: unknown) => {
			if (err !== null && err !== undefined) {
				logger.crit(`PubClient QUIT error`, { err });
				reject(err);
			}

			SubClient.quit((err: unknown) => {
				if (err !== null && err !== undefined) {
					logger.crit(`SubClient QUIT error`, { err });
					reject(err);
				}

				resolve();
			});
		});
	});
}
