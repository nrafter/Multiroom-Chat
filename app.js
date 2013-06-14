/**
 * Module dependencies.
 */


var express = require('express');
var http = require('http');
var path = require('path');
var fs = require('fs');
var mysql = require('mysql');

var app = express();

//log requests to file
//var expressStream = fs.createWriteStream(path.join(__dirname, 'express-log.txt'), {encoding: 'utf8', flags: 'a'});

// all environments
app.locals.pretty = true;
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('sea anemone'));
app.use(express.session({
	key:'sea anemone'
}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

require('./routes/index')(app);

var server = http.createServer(app);
server.listen(3000, app.get('port'), function () {
	console.log('Express server listening on port ' + app.get('port'));
});

var db = mysql.createConnection({
	host: '127.0.0.1',
	user: 'testadmin',
	password: 'password'
});

db.connect();

db.query('CREATE  DATABASE chat', function(err, result) {
	if(err){
	} else {
		db.query('USE chat', function(err, result){
			db.query('CREATE TABLE messages (role VARCHAR(6), room VARCHAR(32), timestamp INT(32) unsigned, username ' +
				'varchar(24), message text);', function (err, result){
				console.log('chat database and messages table created');
			});
		});
	}
});

db.query('USE chat');

/**
 * this is hash map that holds all userdata for every unique socket connection.  you get at a sockets userdata by
 * passing in the socket.id and accessing either user, room, or role properties e.g. chatClient[socket.id].user.
 * each unique socket connection is added to this immediately on connection.  it allows me to avoid having to
 * request information from within socketio using a sockets .get method and supplying a callback.
 */
chatClients = new Object();

/**
 * this is a hash map that holds all message data for votable messages (i.e. i opted to consider every message
 * from a worker as a potential votable message) each votable message has a unique id generated on initial
 * submission from the worker. when a worker supports a candidate opinion, he submits a vote containing the uuid and
 * his socketid is stored in an array in the votable messages object.  the amount of sockets contained in this array
 * (i.e. how many votes a message has) is found by using candidateMessages[uuid].voted.length
 */
candidateMessages = new Object();

var io = require('socket.io').listen(server);

io.configure(function () {

	// disables heartbeats, but leaves handshakes
	io.set('log level', 2)
});

var adminSocket = io.of('/admin');
var workerSocket = io.of('/worker');
var userSocket = io.of('/user');

adminSocket.on('connection', function (socket) {

	socket.emit('login');

	/**
	 * handle login request
	 * user object contains nick, room, and role variables
	 */
	socket.on('login', function(user) {

		//add users to clients hash table if not already there
		if(!chatClients[socket.id]){
			chatClients[socket.id] = user;
		}

		//join room
		var room = db.escape(chatClients[socket.id].room);

		socket.join(room);

		db.query('SELECT * FROM messages WHERE room = ' + room +
			' ORDER BY timestamp DESC LIMIT 25', function(err, result){
			if (err){
				console.log(err);
			} else {
				result.forEach(function (message) {
					var timestamp = new Date(0);
					timestamp.setUTCSeconds(message.timestamp);
					socket.emit('serverMessage', timestamp.toLocaleTimeString() + ' : ' + message.username + ' : ' +
						message.message);
				})
			}
		});

		//broadcast join message after user receives logs, so that it only requires one broadcast.
		//the alternative is broadcast to everyone as soon as he joins, and the user as soon as he receives all the
		// logs
		adminSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' joined.');

		//useradd message
		socket.broadcast.to(chatClients[socket.id].room).emit('userAdd', chatClients[socket.id].nick);

		//get usernames list for the joining user
		var usernames = [];
		adminSocket.clients(user.room).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});
		workerSocket.clients(user.room).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});
		userSocket.clients(user.room).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});

		//send list
		socket.to(user.room).emit('userList', usernames);


	});

	/**
	 *  handle messages
	 */
	socket.on('clientMessage', function(message) {

		var role = db.escape(chatClients[socket.id].role);
		var room = db.escape(chatClients[socket.id].room);
		var username = db.escape(chatClients[socket.id].nick);

		//broadcast message to sockets (including sender, so it introduces a single entry in logging)
		adminSocket.to(room).emit('serverMessage', (new Date()).toLocaleTimeString() + ' : ' +
			chatClients[socket.id].nick + ' : ' +
			message);

		db.query('INSERT INTO messages (role, room, username, timestamp, message) VALUES (' + role + ',' +  room +
			',' + username + ', UNIX_TIMESTAMP(NOW()),' + db.escape(message) + ')');
	});

	/**
	 * handle disconnects (for updating userlists)
	 */
	socket.on('disconnect', function () {
		socket.broadcast.to(chatClients[socket.id].room).emit('userRemove', chatClients[socket.id].nick);
		socket.broadcast.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' left.');
		delete chatClients[socket.id];
	});
});


workerSocket.on('connection', function (socket) {

	/**
	 * emit login signal on connection
	 */
	socket.emit('login');

	/**
	 * handle login request
	 * user object contains nick, room, and role variables
	 */
	socket.on('login', function (user) {

		//add users to clients hash table if not already there
		if (!chatClients[socket.id]) {
			chatClients[socket.id] = user;
		}

		//join room
		socket.join(chatClients[socket.id].room);

		//join message
		workerSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' joined.');
		adminSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' joined.');

		//useradd message
		socket.broadcast.to(chatClients[socket.id].room).emit('userAdd', chatClients[socket.id].nick);
		adminSocket.to(chatClients[socket.id].room).emit('userAdd', chatClients[socket.id].nick);

		//get usernames list for the joining user
		var usernames = [];
		(workerSocket.clients(user.room)).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});
		(userSocket.clients(user.room)).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});

		//send list
		socket.to(user.room).emit('userList', usernames);
	});

	/**
	 * handle messages
	 */
	socket.on('clientMessage', function (message) {
		var timestamp = new Date().toLocaleTimeString();

		var uuid = generateId();

		//push message onto message array with a uuid for voting purposes
		candidateMessages[uuid] = {
			timestamp: timestamp,
			socketid: socket.id,
			message: message,
			nick: chatClients[socket.id].nick,
			uuid: uuid
		};
		candidateMessages[uuid].voted = new Array();
		candidateMessages[uuid].voted.push(socket.id);

		workerSocket.to(chatClients[socket.id].room).emit('serverMessage', candidateMessages[uuid]);
		adminSocket.to(chatClients[socket.id].room).emit('serverMessage', timestamp + ' : ' + chatClients[socket.id].nick + ' : ' +
			message);
	});

	/**
	 * keep track of votes using socket.id and uuid of candidate opinion
	 */
	socket.on('vote', function (uuid){
		if (candidateMessages[uuid].voted.indexOf(socket.id) === -1){
			candidateMessages[uuid].voted.push(socket.id);
		}

		if (candidateMessages[uuid].voted.length >= 3){
			adminSocket.to(chatClients[socket.id].room).emit('serverMessage', candidateMessages[uuid]);
			userSocket.to(chatClients[socket.id].room).emit('serverMessage', candidateMessages[uuid]);
		}
	});

	/**
	 * handle disconnects (for updating userlists)
	 */
	socket.on('disconnect', function (){
		socket.broadcast.to(chatClients[socket.id].room).emit('userRemove', chatClients[socket.id].nick);
		socket.broadcast.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' left.');
		delete chatClients[socket.id];
	})
});

userSocket.on('connection', function (socket) {

	/**
	 * emit login signal on connection
	 */
	socket.emit('login');

	/**
	 * handle login request
	 * user object contains nick, room, and role variables
	 */
	socket.on('login', function (user) {


		//add users to clients hash table if not already there
		if (!chatClients[socket.id]) {
			chatClients[socket.id] = user;
		}

		//join room
		socket.join(chatClients[socket.id].room);

		//join message
		workerSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' joined.');
		adminSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' joined.');
		userSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' joined.');

		//useradd message
		socket.broadcast.to(chatClients[socket.id].room).emit('userAdd', chatClients[socket.id].nick);
		workerSocket.to(chatClients[socket.id].room).emit('userAdd', chatClients[socket.id].nick);
		adminSocket.to(chatClients[socket.id].room).emit('userAdd', chatClients[socket.id].nick);

		//get usernames list for the joining user
		var usernames = [];
		(userSocket.clients(user.room)).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});
		//send list
		socket.emit('userList', usernames);
	});

	/**
	 *  handle messages
	 */
	socket.on('clientMessage', function (message) {
		var timestamp = new Date().toLocaleTimeString();

		 //broadcast message to sockets (including sender, so it introduces a single entry in logging)
		workerSocket.to(chatClients[socket.id].room).emit('serverMessage', timestamp + ' : ' +
			chatClients[socket.id].nick + ' : ' + message);
		adminSocket.to(chatClients[socket.id].room).emit('serverMessage', timestamp + ' : ' +
			chatClients[socket.id].nick + ' : ' + message);
		userSocket.to(chatClients[socket.id].room).emit('serverMessage', timestamp + ' : ' +
			chatClients[socket.id].nick + ' : ' + message);
		io.sockets.emit('serverMessage', timestamp + ' : ' + chatClients[socket.id].nick + ' : ' + message);
	});

	/**
	 * handle disconnects (for updating userlists)
	 */
	socket.on('disconnect', function () {
		socket.broadcast.to(chatClients[socket.id].room).emit('userRemove', chatClients[socket.id].nick);
		socket.broadcast.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick + ' left.');
		delete chatClients[socket.id];
	})
});

function generateId() {
	var S4 = function () {
		return (((1 + Math.random()) * 0x10000) |
			0).toString(16).substring(1);
	};
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" +
		S4() + "-" + S4() + S4() + S4());
}