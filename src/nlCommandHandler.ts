import { Message } from 'discord.js';
import { findMember } from './bamands';
import { transferredPoints } from './database/allModels';
import { hogwartsHouse } from './types/enums';

export async function handle(msg: Message) {
  console.log('got into natural language handler');
  const args = msg.content.split(' ');
  console.log('args: ', args);
  if (args.length < 4 || args[1].toLowerCase() !== 'punkte') {
    return null;
  }
  const amount = args[0];
  console.log('amount:', amount);
  if (typeof amount !== 'number') {
    return null;
  }
  if (amount % 10 !== 0) {
    msg.reply('Invalid number of points supplied.');
    /* .then((mess) => (mess as Discord.Message).delete({ timeout: 5000 })); */
  }
  const addition: boolean = args[2].toLowerCase() === 'für';
  console.log('addition?:', addition);

  if (!addition) {
    if (
      !(args[2].toLowerCase() === 'abzug' && args[3].toLowerCase() === 'für')
    ) {
      return null;
    }
  }
  console.log('still addition?:', addition);

  const mentionedUser = addition ? args[4] : args[5];
  console.log('mentioned user:', mentionedUser);

  const mentionedUserId = findMember(msg.guild!, mentionedUser);
  console.log('userID found:', mentionedUserId);

  // do something with our info
  transferredPoints.upsert({
    giver_id: msg.member!.id,
    receiver_id: mentionedUserId,
    amount: addition ? amount : amount * -1,
    date: new Date(),
    house: hogwartsHouse.Slytherin, // TODO
    season: 1,
  });

  return msg.reply('done.');
}
