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
			console.log('chat database created');	//javascript timestamp was throwing errors, used varchar instead
			db.query('CREATE TABLE messages (role VARCHAR(6), room VARCHAR(32), timestamp VARCHAR(32), username ' +
				'varchar(24), message text);', function (err, result){
				console.log('messages table created');
			});
			db.query('CREATE TABLE vote_messages (timestamp INT(32) unsigned, socketid VARCHAR(24), message TEXT, ' +
				'username VARCHAR(24), uuid VARCHAR(64), vote_count INT(8) unsigned);', function(err, result){
				console.log('vote_messages table created');
			})
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
		if (!chatClients[socket.id]) {
			chatClients[socket.id] = user;
		}

		//join room
		var room = db.escape(chatClients[socket.id].room);

		socket.join(chatClients[socket.id].room);

		var query = 'SELECT * FROM messages WHERE room = ' + room + ' ORDER BY timestamp DESC LIMIT 25';

		//todo: logs are being received out of order
		//retrieve last 25 messages from database
		db.query(query, function(err, result){
			if (err){ console.log(err);
			} else {
//				console.log(result);
				var messageArr = [];
				result.forEach(function (message) {
					var timestamp = new Date(0);
					timestamp.setUTCSeconds(message.timestamp);
//					socket.emit('serverMessage', timestamp.toLocaleTimeString() + ' : ' + message.username + ' : ' +
//						message.message);
					messageArr.push({
						timestamp: timestamp.toLocaleTimeString(),
						nick: message.username,
						message: message.message
					})
				});

				socket.to(chatClients[socket.id].room).emit('serverMessage', messageArr);

				adminSocket.to(room).emit('serverMessage', chatClients[socket.id].nick + ' joined.');
			}
		});

		//broadcast join message after user receives logs, so that it only requires one broadcast.
		//the alternative is broadcast to everyone as soon as he joins, and the user as soon as he receives all the
		// logs

		//useradd message
		socket.broadcast.to(chatClients[socket.id].room).emit('userAdd', chatClients[socket.id].nick);

		//get usernames list for the joining user
		var usernames = [];
		adminSocket.clients(chatClients[socket.id].room).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});
		workerSocket.clients(chatClients[socket.id].room).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});
		userSocket.clients(chatClients[socket.id].room).forEach(function (client) {
			usernames.push(chatClients[client.id].nick);
		});

		//send list
		socket.to(chatClients[socket.id].room).emit('userList', usernames);


	});

	/**
	 *  handle messages
	 */
	socket.on('clientMessage', function(message) {
		console.log('clientMessage');

		//broadcast message to sockets (including sender, so it introduces a single entry in logging)
		socket.to(chatClients[socket.id].room).emit('serverMessage', (new Date()).toLocaleTimeString() + ' : ' +
			chatClients[socket.id].nick + ' : ' + message);

		var role = db.escape(chatClients[socket.id].role);
		var room = db.escape(chatClients[socket.id].room);
		var username = db.escape(chatClients[socket.id].nick);
		var query = 'INSERT INTO messages (role, room, username, timestamp, message) VALUES (' + role + ',' + room +
			',' + username + ', UNIX_TIMESTAMP(NOW()),' + db.escape(message) + ')';

		db.query(query,function(err){
			if(err) { console.log(err); }
		});
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

		var room = db.escape(chatClients[socket.id].room);
		var query = 'SELECT * FROM messages WHERE room = ' + room + ' AND role NOT IN ("admin") ORDER BY timestamp ' +
			'DESC LIMIT 25';

		db.query(query, function (err, result) {
			if (err) { console.log(err);
			} else {
				result.forEach(function (message) {
					console.log(message);
					var timestamp = new Date(0);
					timestamp.setUTCSeconds(message.timestamp);
					socket.emit('serverMessage', timestamp.toLocaleTimeString() + ' : ' + message.username + ' : ' +
						message.message);
				});

				//join message
				adminSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick +
					' joined.');
				workerSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick +
					' joined.');
			}
		});

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

		var role = db.escape(chatClients[socket.id].role);
		var room = db.escape(chatClients[socket.id].room);
		var username = db.escape(chatClients[socket.id].nick);
		var query = 'INSERT INTO messages (role, room, username, timestamp, message) VALUES (' + role + ',' + room +
			',' + username + ', UNIX_TIMESTAMP(NOW()),' + db.escape(message) + ')';

		db.query(query, function (err) {
			if (err) { console.log(err); }
		});

		workerSocket.to(chatClients[socket.id].room).emit('serverMessage', candidateMessages[uuid]);
		adminSocket.to(chatClients[socket.id].room).emit('serverMessage', timestamp + ' : ' +
			chatClients[socket.id].nick + ' : ' + message);

		var sock = db.escape(candidateMessages[uuid].socketid);
		var emessage = db.escape(candidateMessages[uuid].message);
		var nick = db.escape(candidateMessages[uuid].nick);
		var euuid = db.escape(uuid);
		var votes = db.escape(candidateMessages[uuid].voted.length);
		var query2 = 'INSERT INTO vote_messages (timestamp, socketid, message, username, uuid, vote_count) VALUES' +
			'(UNIX_TIMESTAMP(NOW()),' + sock + ',' + emessage + ',' + nick + ',' + euuid + ',' + votes + ')';

		db.query(query2, function (err) { if(err) { console.log(err); }
		});
	});

	/**
	 * keep track of votes using socket.id and uuid of votable message
	 */
	socket.on('vote', function (uuid){
		if(candidateMessages[uuid].voted.indexOf(socket.id) === -1){
			console.log(candidateMessages[uuid].timestamp)
			var query = 'UPDATE vote_messages SET vote_count =  vote_count + 1 WHERE uuid = "' + uuid + '"';

			db.query(query , function(err, result){
				if(err) { console.log(err);
				} else {
					candidateMessages[uuid].voted.push(socket.id);
				}
			});
		}

		//todo: check votes against database, not this, it's not reliable enough
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

		var room = db.escape(chatClients[socket.id].room);
		var query = 'SELECT timestamp,username,message,role,NULL FROM messages WHERE room = ' + room + ' AND role' +
			' NOT IN ("admin", "worker") UNION SELECT timestamp,username,message,NULL,vote_count FROM' +
			' vote_messages WHERE vote_count >= 3 ORDER BY timestamp DESC LIMIT 25';

		db.query(query, function (err, result) {
			if (err) {
				console.log(err);
			} else {
				result.forEach(function (message) {
					console.log(message);
					var timestamp = new Date(0);
					timestamp.setUTCSeconds(message.timestamp);
					socket.emit('serverMessage', timestamp.toLocaleTimeString() + ' : ' + message.username + ' : ' +
						message.message);
				});

				//join message
				adminSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick +
					' joined.');
				workerSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick +
					' joined.');
				userSocket.to(chatClients[socket.id].room).emit('serverMessage', chatClients[socket.id].nick +
					' joined.');
			}
		});

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

		var role = db.escape(chatClients[socket.id].role);
		var room = db.escape(chatClients[socket.id].room);
		var username = db.escape(chatClients[socket.id].nick);
		var query = 'INSERT INTO messages (role, room, username, timestamp, message) VALUES (' + role + ',' + room + ',' +
			username + ', UNIX_TIMESTAMP(NOW()),' + db.escape(message) + ')';

		db.query(query, function (err){
			if (err) { console.log(err); }
		});

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