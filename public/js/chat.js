/**
 * Created with JetBrains WebStorm.
 * User: metaljello
 * Date: 6/8/13
 * Time: 12:00 AM
 * To change this template use File | Settings | File Templates.
 */

var messagesElement = document.getElementById('messages');
var lastMessageElement = null;

var context = new webkitAudioContext(),
	sineWave = context.createOscillator(),
	gainNode = context.createGainNode();

sineWave.frequency.value = 300;
//sineWave.connect(gainNode);
gainNode.connect(context.destination);
sineWave.noteOn(0);

$("window").load(function () {
	$('body').removeClass('preload');
});

function addMessage(message) {
	var newMessageElement = document.createElement('div');
	var newMessageText = document.createTextNode(message);

	newMessageElement.appendChild(newMessageText);
	if(lastMessageElement)
		$(newMessageElement).insertAfter(lastMessageElement);
	else $('#messages').append(newMessageElement);
	lastMessageElement = newMessageElement;
	$('#messages').scrollTop($('#messages')[0].scrollHeight);
}

function addVote(message) {
	var newMessageElement = document.createElement('div');
	newMessageElement.id = message.uuid;
	newMessageElement.className = 'vote';
	var newMessageText = document.createTextNode(message.timestamp + ' : ' + message.nick + ' : ' +  message.message);

	newMessageElement.appendChild(newMessageText);
	if (lastMessageElement)
		$(newMessageElement).insertAfter(lastMessageElement);
	else $('#messages').append(newMessageElement);
	lastMessageElement = newMessageElement;
}

var user = {
	nick: null,
	room: $('#room').text(),
	role: $('#role').text()
};
$(document).ready(function(){
	user.nick = prompt('enter username', '');

	while (!user.nick) {
		user.nick = prompt('enter username', '');
	}
});

var socket = io.connect('http://24.126.26.31/' + user.role);

socket.on('login', function() {
	console.log('received login request, sending username');
	socket.emit('login', user);
});

socket.on('serverMessage', function(message) {
	if (typeof message == 'string')
		addMessage(message);
	else if (typeof message == 'object')
		addVote(message)
});

socket.on('userList', function(usernames) {
	usernames.forEach(function(username){
		console.log(username);
		$('#userlist').append("<div id='" + username + "'>" + username + "</div>");
	});
});

socket.on('userAdd', function(username) {
	$('#userlist').append("<div id='" + username + "'>" + username + "</div>");
});

socket.on('userRemove', function(username) {
	$('#' + username).remove();
});

var inputElement = document.getElementById('input');

inputElement.onkeydown = function (keyboardEvent) {
	if (keyboardEvent.keyCode === 13) {
		socket.emit('clientMessage', inputElement.value);
		inputElement.value = '';
		return false;
	} else {
		return true;
	}
};

$($('#messages').on('click', '.vote', function (element) {
//	$(this).attr('class', 'voted');
	socket.emit('vote', this.id);
}));

/**
 *
 *   Debugging shit
 *
 */

socket.on('connecting', function () {
	console.log('connecting..');
});

socket.on('connect', function () {
	console.log('connected!');
});

socket.on('disconnect', function () {
	console.log('disconnected. http://i.imgur.com/pnPI8AU.png');
});

socket.on('connect_failed', function () {
	console.log('connect_failed');
});

socket.on('error', function () {
	console.log('error');
});

socket.on('message', function (message, callback) {
	console.log('message');
});

socket.on('anything', function (data, callback) {
	console.log('anything');
});

socket.on('reconnect_failed', function () {
	console.log('reconnect_failed');
});

socket.on('reconnect', function () {
	$('#messages').empty();
	$('#userlist').empty();
	console.log('reconnect');
});

socket.on('reconnecting', function () {
	console.log('reconnecting');
});