﻿// commands made by Basti for use of the Bot
import Discord, { Message } from 'discord.js';

export async function findMember(
  guild: Discord.Guild,
  ment: string,
): Promise<string | null> {
  if (!ment) {
    return null;
  }
  const mention = ment.toLowerCase();
  if (mention.startsWith('<@') && mention.endsWith('>')) {
    let id = mention.slice(2, -1);
    if (id.startsWith('!')) {
      id = id.substr(1);
    }
    return id;
  }
  // this only works if its not a username, but the ID (NOT a mention)
  const user = guild.member(mention);
  if (user) {
    return user.id;
  }

  if (mention.length >= 3) {
    // behavior of this query has not been tested!
    // if it finds too many, maybe we want to filter before checking for length
    const potentialMembers = await guild.members.fetch({
      query: mention,
      limit: 2, // for performance reasons, as two is already too many
    });
    if (potentialMembers.size === 1) {
      return potentialMembers.first()!.id;
    }
  }
  return null;
}

export async function findRole(guild: Discord.Guild, ment: string) {
  if (!ment) {
    return false;
  }
  const mention = ment.toLowerCase();
  if (mention.startsWith('<@&') && mention.endsWith('>')) {
    const id = mention.substr(3).slice(0, -1);
    return id;
  }
  const role = await guild.roles.fetch(mention);
  if (role) {
    return role.id;
  }
  // todo maybe adjust this funcion just as member search was changed (fetch query)
  if (mention.length >= 3) {
    let roleArray = guild.roles.cache.filter((rol) => rol.name.toLowerCase().startsWith(mention));
    if (roleArray.size === 1) {
      return roleArray[0].id;
    }
    if (roleArray.size === 0) {
      roleArray = guild.roles.cache.filter((rol) => rol.name.toLowerCase().includes(mention));
      if (roleArray.size === 1) {
        return roleArray[0].id;
      }
    }
  }
  return false;
}
// this is an idea to implement rather reusable confirmation processes.
// ; abortMessage, timeoutMessage and time are optional parameters
export async function yesOrNo(
  msg: Discord.Message,
  question: string,
  abortMessage?: string,
  timeoutMessage?: string,
  tim?: number,
) {
  return msg.channel.send(question).then(async (mess) => {
    const filter = (reaction: Discord.MessageReaction, user: Discord.User) => (reaction.emoji.name === '☑' || reaction.emoji.name === '❌')
      && user.id === msg.author.id;
    await (mess as Message).react('☑');
    await (mess as Message).react('❌');
    let time = tim;
    if (!time) {
      time = 20000;
    }
    return (mess as Message)
      .awaitReactions(filter, { max: 1, time })
      .then(async (reacts) => {
        (mess as Message).delete();
        const firstReacts = reacts.first();
        if (firstReacts && firstReacts.emoji.name === '☑') {
          return true;
        }
        if (firstReacts) {
          if (abortMessage) {
            msg.channel.send(abortMessage);
          }
          return false;
        }
        let message = timeoutMessage;
        if (!message) {
          message = 'Cancelled due to timeout.';
        }
        await msg.channel.send(message);
        return false;
      });
  });
}

export function printError(error) {
  console.error(
    `Errorstatus: ${error.response.status} ${error.response.statusText}`,
  );
}

export async function asyncForEach<T, F, O>(
  array: Array<T>,
  callback: (input: T, index: number, optionalParameters?: O) => Promise<F>,
  optionalParams?: O,
) {
  const arr = array.map((e, i) => callback(e, i, optionalParams));
  return Promise.all<F>(arr);
}
