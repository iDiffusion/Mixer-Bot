const Mixer = require('@mixer/client-node');
const ws = require('ws');
const config = require('./config.json');
const team = require('./team.json');

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
    switch (args[0].toLowerCase().substring(1)) {
      case 'ping':
        socket.call('whisper', [data.user_name, `PONG!`]);
        break;

      case 'commands':
      case 'cmds':
        cmds = cmds.filter(cmd => {
          return cmd.enable == true && cmd.permission.filter(p => p == "Everyone").length > 0);
        }).join(", ");
        socket.call('msg', [`The list of commands is: ${cmds}. Please use \"${config.prefix}\" as the prefix.`]);
        break;

      case 'rules':
      case 'rule':
        socket.call('msg', [`The list of rules is currently unavailable, please try again later.`]);
        break;

      case 'say':
        //TODO limit to mods only
        socket.call('deleteMessage', [data.id]);
        socket.call('msg', [args.slice(1).join(" ")]);
        console.log(`${data.user_name} has told me to say \"${args.slice(1).join(" ")}\"`);
        break;

      /* Moderation commands for mods*/
      case 'clear':
        socket.call('clearMessages', []);
        console.log(`${data.user_name} cleared messages from chat.`);
        break;

      /* Fun commands for audience */
      case 'dab':
        socket.call('deleteMessage', [data.id]);
        socket.call('msg', [`DAB HYPE`]);
        break;

      case 'yeet':
        socket.call('deleteMessage', [data.id]);
        socket.call('msg', [`YEET HYPE`]);
        break;

      /* Player Join Queue Commands*/
      case 'gt':
        team.team.map(mem => {
          socket.call('msg', [mem.username + "\'s xbox gt is \"" + mem.gamertag.xbox + "\"."]);
        });
        break;

      case 'joinrule':
      case 'joinrules':
        socket.call('deleteMessage', [data.id]);
        if(args.length >= 3 && args[1].toLowerCase().trim().equals("-a")){
          let newRule = args.slice(2).join(" ");
          //TODO Add rule to list of join rules
        }
        else if(args.length >= 3 && args[1].toLowerCase().trim().equals("-r")){
          let num = args[2];
          //TODO remove rule from list of join rules
        }
        else {
          socket.call('whisper', [data.user_name, "The join rules are: " + config.joinrules.join(", ") + "."]);
        }
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

      case 'queue':
        let num = 0;
        let users = [];
        joinQueue.map(mem => {
          if (num++ < 5)
            users.push(mem.user_name);
        });
        socket.call('msg', ["The join queue is: " + users.join(", ") + "."]);
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
