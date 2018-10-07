const Mixer = require('@mixer/client-node');
const ws = require('ws');
const config = require('./config.json');
const team = require('./team.json');
const cmds = require('./commands.json');

var userInfo;
var joinQueue = [];

const client = new Mixer.Client(new Mixer.DefaultRequestRunner());

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
    if (config.debug) {
      console.log("REQUEST:");
      console.log(userInfo);
    }
    return new Mixer.ChatService(client).join(response.body.channel.id);
  })
  .then(response => {
    const body = response.body;
    return createChatSocket(userInfo.id, userInfo.channel.id, body.endpoints, body.authkey);
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
}

function getCommand(cmdName) {
  let commands = cmds.cmds.filter(cmd => {
    return cmd.alias.filter(p => p == cmdName).length > 0;
  });
  return commands[0];
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
    //TODO Whiper to all streamers that a user has joined the chat
    socket.call('whisper', [userInfo.username, `${data.username} has joined the chat!`]);
    socket.call('whisper', [data.username, "Welcome Back to the Stream!"])
  });

  // React to our !pong command
  socket.on('ChatMessage', data => {
    //Debug Messages
    if (config.debug) {
      console.log("CHATMESSAGE:");
      console.log(data);
    }
    //Commands
    let args = formatMsg(data).trim().split(" ");
    if (config.debug) console.log(args);
    if (!args[0].startsWith(config.prefix)) return;

    var cmd = getCommand(args[0]);
    if (!cmd) return;
    if (cmd.delete) socket.call('deleteMessage', [data.id])
    if (cmd.enable == false) return;

    switch (getCommand(args[0].toLowerCase().substring(1))) {
      case 'audience':
        let newaud = args.slice(1).join(" ");
        //TODO set channel audience to variable
        if (cmd.whisper) {
          socket.call('whisper', [data.user_name, `The new channel audience has been set to${newaud}}.`]);
        } else {
          socket.call('msg', [`The new channel audience has been set to${newaud}}.`]);
        }
        break;

        case 'authkey':
          if(args[1] && args[1].toLowerCase().equals("-n")){
            //TODO create new authKey
          }
          else {
            //TODO obtain current authKey
          }
          if()
      case 'clear':
        socket.call('clearMessages', []);
        console.log(`${data.user_name} cleared messages from chat.`);
        break;

      case 'cmds':
        let commands = cmds.cmds.filter(cmmd => {
          return cmmd.enable == true && cmmd.permission.filter(p => p == "Everyone").length > 0;
        });
        let str = [];
        commands.map(cmmd => str.push(config.prefix + cmmd.name));
        if (cmd.whisper) {
          socket.call('whisper', [data.user_name, `The list of commands is: ${str.join(", ")}.`]);
        } else {
          socket.call('msg', [`The list of commands is: ${str.join(", ")}.`]);
        }
        break;

      case 'dab':
        socket.call('deleteMessage', [data.id]);
        socket.call('msg', [`DAB HYPE`]);
        break;

      case 'gt':
        team.team.map(mem => {
          socket.call('msg', [`${mem.username}\'s xbox gt is \"${mem.gamertag.xbox}\".`]);
        });
        break;

      case 'join':
        let user = new UserData(data);
        socket.call('deleteMessage', [data.id]);
        //TODO check if user follows streamers
        if (joinQueue.filter(u => u.username == user.username).length > 0) {
          socket.call('whisper', [data.user_name, "You have already been added to the queue, please make sure you read the rules (use !rules to view the rules) and requirements (use !joinrules to view the requirements) and enjoy the stream!"]);
        } else {
          joinQueue.push(user);
          socket.call('whisper', [data.user_name, "You have now joined the queue, please make sure you meet the requirements (use !joinrules to view them) and enjoy the stream!"]);
          socket.call('whisper', [userInfo.username, `${data.user_name} has joined the queue!`]);
          console.log(`${data.user_name} has joined the queue.`);
        }
        break;

      case 'joinrules':
        socket.call('deleteMessage', [data.id]);
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

      case 'ping':
        if (cmd.whisper) {
          socket.call('whisper', [data.user_name, `PONG!`]);
        } else {
          socket.call('msg', [`@${data.user_name} PONG!`]);
        }
        break;

      case 'queue':
        let num = 0;
        let users = [];
        joinQueue.map(mem => {
          if (num++ < 5)
            users.push(mem.user_name);
        });
        if (cmd.whisper) {
          socket.call('whisper', [data.user_name, `The join queue is: ${users.join(", ")}.`]);
        } else {
          socket.call('msg', [`The join queue is: ${users.join(", ")}.`]);
        }
        break;

      case 'rules':
        socket.call('msg', [`The list of rules is currently unavailable, please try again later.`]);
        break;

      case 'say':
        //TODO limit to mods only
        socket.call('deleteMessage', [data.id]);
        socket.call('msg', [args.slice(1).join(" ")]);
        console.log(`${data.user_name} has told me to say \"${args.slice(1).join(" ")}\"`);
        break;

      case 'yeet':
        socket.call('deleteMessage', [data.id]);
        socket.call('msg', [`YEET HYPE`]);
        break;
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
