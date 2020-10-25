﻿import Discord, { DiscordAPIError } from 'discord.js';
import Umzug from 'umzug';
import { Sequelize } from 'sequelize';
import { sequelize } from './database/allModels';
import { PREFIX, TOKEN, setUser } from './shared_assets';
// eslint-disable-next-line import/no-cycle
import { checkCommand } from './commandHandler';
// eslint-disable-next-line import/no-cycle
import { catchErrorOnDiscord } from './sendToMyDiscord';

const umzug = new Umzug({
  storage: 'sequelize',
  storageOptions: {
    sequelize, // here should be a sequelize instance, not the Sequelize module
  },
  migrations: {
    params: [
      sequelize.getQueryInterface(),
      Sequelize, // Sequelize constructor - the required module
    ],
    path: './migrations',
    pattern: /\.js$/,
  },
});

export const bot = new Discord.Client();

process.on('uncaughtException', async (err) => {
  console.error(`Uncaught Exception:\n${err.stack ? err.stack : err}`);
  await catchErrorOnDiscord(
    `**Uncaught Exception:**\n\`\`\`${err.stack ? err.stack : err}\`\`\``,
  );
});
process.on('unhandledRejection', async (
  err: any, /* to fix weird type issues */
) => {
  console.error(`Unhandled promise rejection:\n${err}`);
  if (err) {
    if (err instanceof DiscordAPIError) {
      await catchErrorOnDiscord(
        `**DiscordAPIError (${err.message || 'NONE'}):**\n\`\`\`${
          err.message
        }\`\`\`\`\`\`${err.stack ? err.stack.substring(0, 1200) : ''}\`\`\``,
      );
    } else {
      await catchErrorOnDiscord(
        `**Outer Unhandled promise rejection:**\n\`\`\`${err}\`\`\`\`\`\`${
          err.stack ? err.stack.substring(0, 1200) : ''
        }\`\`\``,
      );
    }
  }
});

// fires on startup and on reconnect
let justStartedUp = true;
bot.on('ready', async () => {
  try {
    console.info('[UMZUG] Applying pending migrations.');
    const migrations = await umzug.up();
    if (migrations.length > 0) {
      console.info('[UMZUG] Applied migrations:');
      /* eslint-disable no-restricted-syntax */
      for (const m of migrations) {
        console.info(` -  ${m.file}`);
      }
      /* eslint-enable no-restricted-syntax */
    } else {
      console.info('[UMZUG] Database is up to date.');
    }
  } catch (e) {
    console.error('[UMZUG] Failed migrating database:');
    console.error(e);
    process.exit();
  }

  const syncSequelizeModels = true;
  if (syncSequelizeModels && process.env.NODE_ENV === 'development') {
    console.info(
      '[SEQUELIZE] Starting to sync defined tables to DB because we are in dev mode.',
    );
    const wipeDB = false; // set to true if you changed the DB and are in dev mode
    // sync force apparently also wipes the SequelizeMeta table,
    // which then errors on re-trying migrations
    await sequelize.sync({
      force: wipeDB && process.env.NODE_ENV === 'development',
    });
    console.info('[SEQUELIZE] Finished syncing defined tables to DB.');
  }

  if (!bot.user) {
    throw new Error('FATAL Bot has no user.');
  }
  setUser(bot.user); // give user ID to other code
  const chann = await bot.channels.fetch('382233880469438465');
  if (!chann || chann.type !== 'text') {
    console.error('Teabots Server Channel not found.');
  }
  if (justStartedUp) {
    (chann as Discord.TextChannel).send('Running startup...');

    data.startup(bot);
    justStartedUp = false;
  } else {
    (chann as Discord.TextChannel).send('Just reconnected to Discord...');
  }
  await bot.user.setPresence({
    activity: {
      name: `${PREFIX}.help`,
      type: 'WATCHING',
      url: 'https://bots.ondiscord.xyz/bots/384820232583249921',
    },
    status: 'online',
  });
  data.getPrefixesE(bot);

  statcord.autopost();
});

bot.on('message', async (msg) => {
  try {
    await checkCommand(msg as Discord.Message);
  } catch (err) {
    console.error(err);
  }
});

async function guildPrefixStartup(guild) {
  try {
    await data.addGuild(guild.id);
    PREFIXES[guild.id] = await data.getPrefixE(guild.id);
  } catch (err) {
    console.error(err);
  }
}

bot.on('guildCreate', async (guild) => {
  if (guild.available) {
    await guildPrefixStartup(guild);
    if (guild.owner) {
      guild.owner
        .send(
          `Hi there ${guild.owner.displayName}.\nThanks for adding me to your server! If you have any need for help or want to help develop the bot by reporting bugs and requesting features, just join https://discord.gg/2Evcf4T\n\nTo setup the bot, use \`${PREFIX}:help setup\`.\nYou should:\n\t- setup an admin role, as only you and users with administrative permission are able to use admin commands (\`${PREFIX}:setup admin @role\`)\n\t- add some text channels where users can use the bot (\`${PREFIX}:setup command\`)\n\t- add voice channels in which the bot is allowed to `
            + `join to use joinsounds (\`${PREFIX}:setup join\`)\n\t- add a notification channel where bot updates and information will be posted (\`${PREFIX}:setup notification\`)\n\nTo make sure the bot can use all its functions consider giving it a role with administrative rights, if you have not done so yet in the invitation.\n\nThanks for being part of this project,\nBasti aka. the MagiBot Dev`,
        )
        .catch(() => {});
    }
    const chan = await bot.channels.fetch('408611226998800390');
    if (chan && chan.type === 'text') {
      (chan as Discord.TextChannel).send(
        `:white_check_mark: joined **${guild.name}** from ${guild.region} (${guild.memberCount} users, ID: ${guild.id})\nOwner is: <@${guild.ownerID}> (ID: ${guild.ownerID})`,
      );
    }
  }
});

bot.on('guildDelete', async (guild) => {
  if (guild.available) {
    const chan = await bot.channels.fetch('408611226998800390');
    if (chan && chan.type === 'text') {
      (chan as Discord.TextChannel).send(
        `:x: left ${guild.name} (${guild.memberCount} users, ID: ${guild.id})`,
      );
    }
  }
});

bot.on('error', (err) => {
  console.error(err);
});

bot.on('voiceStateUpdate', async (o, n) => {
  try {
    const newVc = n.channel;
    // check if voice channel actually changed, don't mute bots
    if (
      n.member
      && !n.member.user.bot
      && (!o.channel || !newVc || o.channel.id !== newVc.id)
    ) {
      // is muted and joined a vc? maybe still muted from queue
      if (n.serverMute && (await data.isStillMuted(n.id, n.guild.id))) {
        n.setMute(
          false,
          'was still muted from a queue which user disconnected from',
        );
        data.toggleStillMuted(n.id, n.guild.id, false);
      } else if (
        !n.serverMute
        && newVc
        && queueVoiceChannels[n.guild.id]
        && queueVoiceChannels[n.guild.id] === newVc.id
      ) {
        // user joined a muted channel
        n.setMute(true, 'joined active queue voice channel');
      } else if (
        o.serverMute
        && queueVoiceChannels[o.guild.id]
        && o.channel
        && queueVoiceChannels[o.guild.id] === o.channel.id
      ) {
        // user left a muted channel
        if (newVc) {
          n.setMute(false, 'left active queue voice channel');
        } else {
          // save the unmute for later
          data.toggleStillMuted(n.id, n.guild.id, true);
        }
      } else if (
        newVc
        && n.guild.me
        && !n.guild.me.voice.channel
        && n.id !== bot.user!.id
        && !(await data.isBlacklistedUser(n.id, n.guild.id))
        && (await data.joinable(n.guild.id, newVc.id))
      ) {
        const perms = newVc.permissionsFor(n.guild.me);
        if (perms && perms.has('CONNECT')) {
          const sound = await data.getSound(n.id, n.guild.id);
          if (sound) {
            const connection = await newVc.join();
            const dispatcher = connection.play(sound, {
              seek: 0,
              volume: 0.5,
              bitrate: 'auto',
            });
            playedJoinsound();
            // disconnect after 10 seconds if for some reason we don't get the events
            const timeoutID = setTimeout(() => {
              try {
                connection.disconnect();
              } catch (err) {
                catchErrorOnDiscord(
                  `**Error in timeout (${
                    (err.toString && err.toString()) || 'NONE'
                  }):**\n\`\`\`
                ${err.stack || 'NO STACK'}
                \`\`\``,
                );
              }
              dispatcher.removeAllListeners(); // To be sure noone listens to this anymore
            }, 10 * 1000);
            dispatcher.once('finish', () => {
              clearTimeout(timeoutID);
              try {
                connection.disconnect();
              } catch (err) {
                catchErrorOnDiscord(
                  `**Error in once finish (${
                    (err.toString && err.toString()) || 'NONE'
                  }):**\n\`\`\`
                ${err.stack || 'NO STACK'}
                \`\`\``,
                );
              }
              dispatcher.removeAllListeners(); // To be sure noone listens to this anymore
            });
            dispatcher.on('error', (err) => {
              clearTimeout(timeoutID);
              dispatcher.removeAllListeners(); // To be sure noone listens to this anymore
              catchErrorOnDiscord(
                `**Dispatcher Error (${
                  (err.toString && err.toString()) || 'NONE'
                }):**\n\`\`\`
                ${err.stack || 'NO STACK'}
                \`\`\``,
              ).then(() => connection.disconnect());
            });
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
});

bot.on('disconnect', () => {
  console.log('Disconnected!');
});

bot.login(TOKEN); // connect to discord
