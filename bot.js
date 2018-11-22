const Mixer = require('@mixer/client-node');
const ws = require('ws');
const config = require('./config.json');
const team = require('./team.json');
const cmds = require('./commands.json');

const joinID = 29519300;
var userInfo;
var joinQueue = [];
var openQueue = true;
var channels = [];
var debug = config.debug;
const client = new Mixer.Client(new Mixer.DefaultRequestRunner());

config.channels.map(mem => channels.push(mem));

// With OAuth we don't need to log in. The OAuth Provider will attach
// the required information to all of our requests after this call.
client.use(new Mixer.OAuthProvider(client, {
  tokens: {
    access: config.client_oauth,
    expires: Date.now() + (365 * 24 * 60 * 60 * 1000)
  }
}));

// Gets the user that the Access Token we provided above belongs to.
client.request('GET', 'users/current')
  .then(response => {
    userInfo = response.body;
    if (debug) {
      console.log("REQUEST:");
      console.log(userInfo);
    }
    return new Mixer.ChatService(client).join(joinID);
  })
  .then(response => {
    const body = response.body;
    if (debug) {
      console.log("REQUEST:");
      console.log(userInfo);
    }
    return createChatSocket(userInfo.id, joinID, body.endpoints, body.authkey);
  })
  .catch(error => {
    console.error('Something went wrong.');
    console.error(error);
  });

function formatMsg(data) {
  let fullmsg = "";
  data.message.message.map(msg => {
    fullmsg += msg.text;
  });
  return fullmsg;
}

function UserData(data) {
  this.user_name = data.user_name;
  this.user_id = data.user_id;
  this.user_roles = data.user_roles;
  this.channel_id = data.channel;
}

function getCommand(cmdName) {
  let commands = cmds.cmds.filter(cmd => {
    return cmd.alias.filter(p => p.trim().toLowerCase() == cmdName.trim().toLowerCase()).length > 0;
  });
  return commands[0];
}

function getTeam(member) {
  return team.team.filter(mem => mem.social.mixer && mem.social.mixer == member)[0];
}

function ifFollower(data, channel_id) {
  client.request('GET', `channels/${channel_id}/follow`)
    .then(response => {
      return response.body.filter(mem => mem.username == data.user_name).length != 0;
    });
}

/**
 * Creates a Mixer chat socket and sets up listeners to various chat events.
 * @param {number} userId The user to authenticate as
 * @param {number} channelId The channel id to join
 * @param {string[]} endpoints An array of endpoints to connect to
 * @param {string} authkey An authentication key to connect with
 * @returns {Promise.<>}
 */
function createChatSocket(userId, channelId, endpoints, authkey) {
  // Chat connection
  const socket = new Mixer.Socket(ws, endpoints).boot();

  // Greet a joined user
  socket.on('UserJoin', data => {
    if (data.username == userInfo.username) return;
    team.team.map(mem => {
      if (mem.social.mixer && channels.includes(mem.social.mixer)) {
        socket.call('whisper', [mem.social.mixer, `${data.username} has joined the chat!`]);
      }
    });
    // socket.call('whisper', [data.username, "Welcome Back to the Stream!"]);
    console.log(`${data.username} has joined the chat!`);
    if (debug) {
      console.log(data);
    }
  });

  // React to our !pong command
  socket.on('ChatMessage', data => {
    //Debug Messages
    if (debug) {
      console.log("CHATMESSAGE:");
      console.log(data);
    }
    //Format arguments
    let args = formatMsg(data).trim().replace(/  +/g, ' ').split(" ");
    if (debug) console.log(args);
    if (!args[0].startsWith(config.prefix)) return;

    //Obtain Command
    var cmd = getCommand(args[0].slice(1));
    if (!cmd) return;
    if (cmd.delete) socket.call('deleteMessage', [data.id]).catch(console.error);
    if (!cmd.enable) {
      let message = `\"${cmd.name}\" command is current unavailable, but should be up and running shortly. Please try again later.`;
      return socket.call('whisper', [data.user_name, message]);
    }

    //Check permission (host, team, editor, mod, follwer, user, none)
    if (data.user_name == "Its_Diffusion");
    else if (data.user_name == config.host);
    else if (cmd.permission.includes('Team') && channels.includes(data.user_name));
    else if (cmd.permission.includes('Editor') && data.user_roles.includes('ChannelEditor') && config.channels.filter(mem => getTeam(mem) && getTeam(mem).channel_id && getTeam(mem).channel_id == data.channel).length != 0);
    else if (cmd.permission.includes('Editor') && data.user_roles.includes('ChannelEditor'));
    else if (cmd.permission.includes('Mod') && data.user_roles.includes('Mod') && config.channels.filter(mem => getTeam(mem) && getTeam(mem).channel_id && getTeam(mem).channel_id == data.channel).length != 0);
    else if (cmd.permission.includes('Mod') && data.user_roles.includes('Mod'));
    else if (cmd.permission.includes('Follower') && config.channels.filter(mem => getTeam(mem) && getTeam(mem).channel_id && ifFollower(data, getTeam(mem).channel_id)).length == config.channels.length);
    else if (cmd.permission.includes('Follower') && data.user_roles.includes('User'));
    else if (cmd.permission.includes('User') && data.user_roles.includes('User'));
    else {
      let message = `Im sorry to inform you that you do not have permission to use the \"${cmd.name}\" command.`;
      if (cmd.permission.includes('Follower')) {
        messge = `Im sorry but in order to use this command, you must be a follower of @${channels.join(", @")} .`;
      }
      return socket.call('whisper', [data.user_name, message]);
    }

    //Perform command
    switch (cmd.name) {
      case 'authkey':
        if (args[1] && args[1].toLowerCase().trim() == "-n") {
          // TODO create new authKeyq
          console.log(`${data.user_name} has renewed the Oauth Key!`);
        } else {
          // TODO obtain current authKey
        }
        break;

      case 'ban':
        if (args.length >= 3) {
          let user = args[1].replace(/@/g, '');
          // TODO check if user exist
          // TODO ban user that was specified
          let reason = args.slice(2).join(" ");
          let message = `@${user} was banned by @${data.user_name} for the following reason: \"${reason}\".`;
          socket.call('whisper', [config.host, message]);
          console.log(message);
        } else {
          socket.call('whisper', [data.user_name, `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`]);
        }
        break;

      case 'blacklist':
        if (args.length >= 3 && args[1].trim().toLowerCase() == "-a") {
          //TODO make sure that the user exist
          //TODO add user that was specified to blacklist
          let user = args[2].replace(/@/g, '');
          let message = "You have been banned from using the bot commands until further notice.";
          if (!cmd.whipser) socket.call('msg', [`@${user}, ${message}`]);
          else socket.call('whisper', [user, message]);
          message = `@${user} was blacklisted by @${data.user_name}.`;
          socket.call('whisper', [config.host, message]);
          console.log(message);
        } else if (args.length >= 3 && args[1].trim().toLowerCase() == "-r") {
          //TODO make sure that the user exist
          //TODO remove user that was specified from blacklist
          let user = args[2].replace(/@/g, '');
          let message = "You are now able to use the bot.";
          if (!cmd.whipser) socket.call('msg', [`@${user}, ${message}`]);
          else socket.call('whisper', [user, message]);
          message = `@${user} was unblacklisted by @${data.user_name}.`;
          socket.call('whisper', [config.host, message]);
          console.log(message);
        } else if (args.length == 1) {
          //TODO Whisper the blacklist to the host and post it to the console
        } else {
          socket.call('whisper', [data.user_name, `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`]);
        }
        break;

      case 'clear':
        socket.call('clearMessages', []).catch(console.error);
        console.log(`${data.user_name} cleared messages from chat.`);
        break;

      case 'cmds':
        {
          let str = [];
          cmds.cmds.filter(cmmd => {
            return cmmd.enable == true && cmmd.permission.filter(rol => rol == "User" || rol == "Follower").length > 0;
          }).map(cmmd => str.push(config.prefix + cmmd.name));
          if (cmd.whisper) {
            socket.call('whisper', [data.user_name, `The list of commands is: ${str.join(", ")}.`]);
          } else {
            socket.call('msg', [`The list of commands is: ${str.join(", ")}.`]);
          }
        }
        break;

      case 'creator':
        socket.call('msg', [`This bot is programmed and created by \"Its_Diffusion\"!`]);
        break;

      case 'dab':
        socket.call('msg', [`DAB HYPE`]);
        break;

      case 'discord':
        if (cmd.whisper) {
          socket.call('whisper', [data.username, `The discord link is ${config.discord}`]);
        } else {
          socket.call('msg', [`The discord link is ${config.discord}`]);
        }
        break;

      case 'followme':
        {
          var channel_id;
          client.request('GET', `users/${data.user_id}`)
          .then(r1 => {
            channel_id = r1.body.channel.id;
            console.log(`The channel is ${channel_id}.`);
            console.log(r1.body);
          })
          .then(r2 =>
            client.request('POST', `channels/${channel_id}/follow`)
            .then(r3 => console.log(r3.body))
          );
        }
        break;

      case 'games':
        team.team.map(mem => {
          if (mem.social.mixer && channels.includes(mem.social.mixer) && mem.games && mem.games.length > 0)
            socket.call('msg', [`${mem.social.mixer} likes to stream ${mem.games.join(", ")}.`]);
        });
        break;

      case 'get':
        if (args[1].toLowerCase() == 'channel') {
          client.request('GET', `users/${args[2]}`).then(response => {
            socket.call('whisper', [data.user_name, `The channel id of ${response.body.username} is ${response.body.channel.id}`]);
            if (debug) console.log(response.body);
          });
        } else if (args[1].toLowerCase() == 'id') {
          let user = args[2].replace(/@/g, '');
          let member = team.team.filter(mem => mem.social.mixer && mem.social.mixer.toLowerCase() == user.toLowerCase())[0];
          if (member && member.social.mixer && member.user_id) socket.call(`The user id of ${mem.social.mixer} is ${member.user_id}`);
          if (member && debug) console.log(member);
        }
        break;

      case 'gt':
        team.team.map(mem => {
          if (mem.social.mixer && channels.includes(mem.social.mixer) && mem.gamertag.xbox)
            socket.call('msg', [`${mem.social.mixer}\'s xbox gt is \"${mem.gamertag.xbox}\".`]);
        });
        break;

      case 'gucci':
        socket.call('msg', [`GUCCI HYPE`]);
        break;

      case 'host':
        if (args[1] && args[1].trim().toLowerCase() == 'team') {
          //TODO host members on the team
        } else if (args[1]) {
          let user = args[1].replace(/@/g, '');
          //TODO check if the user is valid
          //TODO host target's channel
        } else {
          //TODO stop hosting current channel
        }
        break;

      case 'howtojoin':
        if (channels.length < 1) channels.add(config.host);
        socket.call('msg', [`If anyone would like to join please be sure you are following @${channels.join(", @")} . Then join the queue by typing !join in chat, read the rules by typing !joinrules and send one of us a message on xbox !gt`]);
        break;

      case 'join':
        let player = new UserData(data);
        if (joinQueue.filter(u => u.user_name == player.user_name).length > 0) {
          let message = "You have already been added to the queue, please make sure you read the rules (use !rules to view the rules) and requirements (use !joinrules to view the requirements) and enjoy the stream!";
          if (cmd.whisper) socket.call('whisper', [data.user_name, message]);
          else socket.call('msg', [`${data.user_name}, ${message}`]);
        } else if (!openQueue) {
          let message = "I'm sorry, but the queue is closed at this time, please try again later.";
          if (cmd.whisper) socket.call('whisper', [data.user_name, message]);
          else socket.call('msg', [`${data.user_name}, ${message}`]);
        } else {
          joinQueue.push(player);
          let message = `${data.user_name} has joined the queue!`
          team.team.map(mem => {
            if (mem.social.mixer && channels.includes(mem.social.mixer))
              socket.call('whisper', [mem.social.mixer, message]);
          });
          console.log(message);
          message = "You have now joined the queue, please make sure you meet the requirements (use !joinrules to view them) and enjoy the stream!";
          if (cmd.whisper) socket.call('whisper', [data.user_name, message]);
          else socket.call('msg', [`${data.user_name}, ${message}`]);
        }
        break;

      case 'joinrules':
        if (args.length >= 3 && args[1].toLowerCase().trim().equals("-a")) {
          let newRule = args.slice(2).join(" ");
          //TODO Add rule to list of join rules
        } else if (args.length >= 3 && args[1].toLowerCase().trim().equals("-r")) {
          let num = args[2];
          //TODO remove rule from list of join rules
        } else {
          if (cmd.whisper) {
            socket.call('whisper', [data.user_name, `The join rules are: ${config.joinrules.join(", ")}.`]);
          } else {
            socket.call('msg', [`The join rules are: ${config.joinrules.join(", ")}.`]);
          }
        }
        break;

      case 'parden':
        if (args[1]) {
          let user = args[1].replace(/@/g, '');
          //TODO check if username is valid
          socket.call('timeout', [user, 'clear']).cathc(console.error);
          socket.call('whisper', [user, 'You are now able to talk in chat.']);
          console.log(`${data.user_name} has enabled @${user} to chat.`);
        } else {
          socket.call('whisper', [data.user_name, `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`]);
        }
        break;

      case 'permit':
        if (args[1]) {
          let user = args[1].replace(/@/g, '');
          //TODO check if username is valid
          //TODO only allow followers to be permitted
          //TODO permit user to post without filtering
          socket.call('whisper', [user, 'You have temporarily been allowed to chat wilhout filter.']);
          console.log(`${data.user_name} has allowed ${user} to chat without filter.`);
        } else {
          socket.call('whisper', [data.user_name, `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`]);
        }
        break;

      case 'ping':
        if (cmd.whisper) {
          socket.call('whisper', [data.user_name, `PONG!`]);
        } else {
          socket.call('msg', [`@${data.user_name} PONG!`]);
        }
        break;

      case 'points':
        if (data.user_roles.filter(rol => rol == 'Mod' || rol == 'Owner').length == 0) {
          //TODO display user points
          break;
        }
        if (args.length >= 4 && args[2].trim().toLowerCase() == "-a") {
          //TODO check for valid arguements
          //TODO add points to a specific user
          let user = args[1].replace(/@/g, '');
          socket.call('whisper', [config.host, `${args[3]} points have been given to @${user} by @${data.user_name}.`]);
          console.log(`${args[3]} points have been given to @${user} by @${data.user_name}.`);
        } else if (args.length >= 4 && args[2].trim().toLowerCase() == "-r") {
          //TODO check for valid arguements
          //TODO remove points from a specific user
          let user = args[1].replace(/@/g, '');
          socket.call('whisper', [userInfo.user_name, `${args[3]} points have been removed from @${user} by @${data.user_name}.`]);
          console.log(`${args[3]} points have been removed from @${user} by @${data.user_name}.`);
        } else if (args.length == 2) {
          //TODO print out the list of points of a specific user
          let user = args[1].replace(/@/g, '');
        } else if (args.length == 1) {
          //TODO print out the list of points of the caller
        } else {
          let message = `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`;
          if (!cmd.whipser) socket.call('msg', [message]);
          else socket.call('whisper', [data.user_name, message]);
        }
        break;

      case 'pop':
        if (joinQueue.length > 0) {
          let player = joinQueue[0];
          joinQueue.shift();
          let message = `The next person in queue is @${player.user_name}!`;
          if (cmd.whisper) {
            team.team.map(mem => {
              if (mem.social.mixer && channels.includes(mem.social.mixer))
                socket.call('whisper', [mem.social.mixer, message]);
            });
          } else {
            socket.call('msg', [message]);
          }
          console.log(message);
        } else {
          socket.call('whisper', [data.user_name, `There is currently no one in the queue.`]);
        }
        break;

      case 'purge':
        if (args[1]) {
          let user = args[1].replace(/@/g, '');
          socket.call('purge', [user]).catch(console.error);
          console.log(`${data.user_name} has purged @${user} messages from chat.`);
        } else {
          socket.call('whisper', [data.user_name, `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`]);
        }
        break;

      case 'queue':
        if ((data.user_roles.filter(rol => rol == 'Mod' || rol == 'Editor' || rol == 'Owner').length == 0 &&
            channels.filter(mem => mem == data.user_name).length == 0) || args.length == 1) {
          if (joinQueue.length > 0) {
            let users = [];
            joinQueue.map(mem => {
              users.push(mem.user_name);
            });
            let message = `The join queue contains: ${users.join(", ")}.`;
            if (cmd.whisper) {
              socket.call('whisper', [data.user_name, message]);
            } else {
              socket.call('msg', [message]);
            }
          } else {
            let message = `The join queue is: EMPTY.`;
            if (cmd.whisper) {
              socket.call('whisper', [data.user_name, message]);
            } else {
              socket.call('msg', [message]);
            }
          }
        } else if (args[1].toLowerCase().includes("stop")) {
          openQueue = false;
          team.team.map(mem => {
            if (mem.social.mixer && channels.includes(mem.social.mixer))
              socket.call('whisper', [mem.social.mixer, `The queue has stopped taking players.`]);
          });
          console.log(`${data.user_name} has stopped the queue.`);
        } else {
          openQueue = true;
          team.team.map(mem => {
            if (mem.social.mixer && channels.includes(mem.social.mixer))
              socket.call('whisper', [mem.social.mixer, `The queue has resumed taking players.`]);
          });
          console.log(`${data.user_name} has started the queue.`);
        }
        break;

      case 'rank':
        if (data.user_roles.filter(rol => rol == 'Mod' || rol == 'Owner').length == 0 || args.length == 1) {
          //TODO calculate and print the rank of the calling user
        } else {
          let user = args[1].replace(/@/g, '');
          //TODO calculate and print the rank of the specified user
        }
        break;

      case 'reee':
        socket.call('msg', [`REEEEEEEEE`]);
        break;

      case 'rip':
        if (args.length > 1) {
          let user = args.slice(1).join(" ").replace(/@/g, "");
          socket.call('msg', [`Rest in peace ${user}, you will forever be missed.`]);
        } else {
          socket.call('msg', [`Rest in peace, you will forever be missed.`]);
        }
        break;

      case 'roulette':
        if (args[1] && args[1].trim.toLowerCase() == "all") {
          let user = data.user_name;
          //TODO wager all of the calling users points away
        } else if (args[1] && !isNaN(+args[1])) {
          let user = data.user_name;
          let points = +args[1];
          //TODO wager a certain number of users points away
        } else {
          let message = `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`;
          if (!cmd.whipser) socket.call('msg', [message]);
          else socket.call('whisper', [data.user_name, message]);
        }
        break;

      case 'rules':
        {
          let message = `The chat rules are : ${config.chatrules.join(", ")}.`;
          if (cmd.whisper) {
            socket.call('msg', [message]);
          } else {
            socket.call('msg', [data.user_name, message]);
          }
        }
        break;

      case 'say':
        socket.call('msg', [args.slice(1).join(" ")]);
        console.log(`${data.user_name} has told me to say \"${args.slice(1).join(" ").trim()}\"`);
        break;

      case 'server':
        {
          let message = 'ARK Server Name = \'[US] Prisolis Gaming\', Session Filter = \'Unofficial PC Session\', Map = \'Ragnarok\', Password = Message Diffusion for Password.'
          if (cmd.whisper) {
            socket.call('msg', [message]);
          } else {
            socket.call('msg', [message]);
          }
        }
        break;

      case 'set':
        if (args[1].toLowerCase() == 'debug') {
          if (args[2].toLowerCase() == 'true') {
            debug = true;
          } else {
            debug = false;
          }
        }
        break;

      case 'status':
        socket.call('whisper', [data.user_name, `Team channels are ${channels.join(", ")}. The Join Queue is ${openQueue ? 'open' : 'closed'}. `]);
        break;

      case 'team':
        if (args.length >= 3 && (args[1].toLowerCase() == '-a' || args[1].toLowerCase() == 'add')) {
          let user = args[2].replace(/@/g, '');
          //TODO check if user is valid
          if (channels.filter(mem => mem.toLowerCase() == user.toLowerCase()));
          channels.push(user);
        } else if (args.length >= 3 && (args[1].toLowerCase() == '-r' || args[1].toLowerCase() == 'remove')) {
          let user = args[2].replace(/@/g, '');
          channels = channels.filter(mem => mem.toLowerCase() != user.toLowerCase());
        } else if (args.length >= 2 && args[1].toLowerCase() == 'reset') {
          channels = [];
          config.channels.map(mem => channels.push(mem));
        } else {
          socket.call('whisper', [data.user_name, `The current team is comprised of ${channels.join(", ")} `]);
        }
        break;

      case 'test':
        { // Check if user is following a certain channel
          client.request('GET', `channels/${29519300}/follow`)
          .then(response => {
            response.body.filter(mem => {
              console.log(`${mem.username} == ${data.user_name} is ${mem.username == data.user_name}`);
              return mem.username == data.user_name;
            });
          });
        } { // Check if user is following streamers
          config.channels.filter(mem => {
            console.log(getTeam(mem));
            console.log(getTeam(mem).channel_id);
            console.log(ifFollower(data, getTeam(mem).channel_id));
            return getTeam(mem) && getTeam(mem).channel_id && ifFollower(data, getTeam(mem).channel_id);
          });
        }
        break;

      case 'timeout':
        if (args.length > 2 && +args[2] != "NaN") {
          socket.call('timeout', [args[1].replace(/@/g, ''), +args[2]]);
          let message = `You have been timed out for ${args[2]}.`;
          if (!cmd.whipser) socket.call('msg', [`@${args[1].replace(/@/g, '')}, ${message}`]);
          else socket.call('whisper', [args[1].replace(/@/g, ''), message]);
          console.log(`${args[1].replace(/@/g, '')} has been timed out for ${args[2]} seconds by ${data.user_name} because ${args.slice(4).join(" ")}`);
        } else {
          let message = `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`;
          if (!cmd.whipser) socket.call('msg', [message]);
          else socket.call('whisper', [data.user_name, message]);
        }
        break;

      case 'twitter':
        team.team.map(mem => {
          if (mem.social.mixer && channels.includes(mem.social.mixer) && mem.social.twitter)
            socket.call('msg', [`${mem.social.mixer}\'s twitter is \"${mem.social.twitter}\".`]);
        });
        break;

      case 'warn':
        if (args.length >= 3) {
          let user = args[1].replace(/@/g, '');
          let message = `You have been warned by a Mod because \"${args.slice(2).join(' ')}\".`;
          if (!cmd.whisper) {
            socket.call('msg', [`@${user}, ${message}`]);
          } else {
            socket.call('whisper', [user, message]);
          }
          message = `${args[1]} has been warned by ${data.user_name} for the following reason: ${args.slice(2).join(" ")}`;
          socket.call('whisper', [userInfo.username, message]);
          console.log(message);
        } else {
          socket.call('whisper', [data.user_name, `The correct format for the command \"${cmd.name}\" is \'${cmd.format}\".`]);
        }
        break;

      case 'winner':
        socket.call('giveaway:start', []);
        break;

      case 'yeet':
        socket.call('msg', [`YEET HYPE`]);
        break;

      default:

    }
  });

  // Handle errors
  socket.on('error', error => {
    console.error('Socket error!');
    console.error(error);
  });

  return socket.auth(channelId, userId, authkey)
    .then(() => {
      console.log('Login successful!');
      return socket.call('msg', ['Hi! I\'m Celestial! Write !cmds for a list of commands!']);
    });
}
