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
  },
}));

// Gets the user that the Access Token we provided above belongs to.
client.request('GET', 'users/current')
.then(response => {
  userInfo = response.body;
  if(config.debug) {
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
  this.id = data.id;
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
function createChatSocket (userId, channelId, endpoints, authkey) {
  // Chat connection
  const socket = new Mixer.Socket(ws, endpoints).boot();

  // Greet a joined user
  socket.on('UserJoin', data => {
    socket.call('msg', [`@${data.username} Welcome Back to the Stream!`]);
    socket.call('whisper', [data.username, "Welcome Back to the Stream!"])
  });

  // React to our !pong command
  socket.on('ChatMessage', data => {
    //Debug Messages
    if(config.debug) {
      console.log("CHATMESSAGE:");
      console.log(data);
    }
    //Commands
    if (data.message.message[0].data.toLowerCase().startsWith('!ping')) {
      socket.call('msg', [`@${data.user_name} PONG!`]);
      console.log(`Ponged ${data.user_name}`);
    }
    else if (data.message.message[0].data.toLowerCase().startsWith('!gt')) {
      team.team.map(mem => {
        socket.call('msg', [mem.username + "\'s xbox gt is \"" + mem.gamertag.xbox + "\"."]);
      });
      console.log(`Gave ${data.user_name} gamertags!`);
    }
    else if (data.message.message[0].data.toLowerCase().startsWith('!joinrules')) {
      socket.call('whipser', [data.user_name, config.joinrules]);
      console.log(`Printed joinrules for ${data.user_name}`);
    }
    else if (data.message.message[0].data.toLowerCase().startsWith('!dab')) {
      socket.call('msg', [`DAB HYPE`]);
      console.log(`Dab Hype for ${data.user_name}`);
    }
    else if (data.message.message[0].data.toLowerCase().startsWith('!yeet')) {
      socket.call('msg', [`YEET HYPE`]);
      console.log(`Yeet Hype for ${data.user_name}`);
    }
    else if (data.message.message[0].data.toLowerCase().startsWith('!join')) {
      socket.call('whisper', [data.user_name, "You have now joined the queue, please make sure you meet the requirements (use !joinrules to view the rules) and enjoy the stream!"]);
      joinQueue.push(data);
      console.log(`Printed joinrules for ${data.user_name}`);
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
