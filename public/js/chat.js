/**
 * Created with JetBrains WebStorm.
 * User: metaljello
 * Date: 6/8/13
 * Time: 12:00 AM
 * To change this template use File | Settings | File Templates.
 */

var messagesElement = document.getElementById('messages');
var lastMessageElement = null;

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

user.nick = prompt('enter username', '');

while (!user.nick) {
	user.nick = prompt('enter username', '');
}

var socket = io.connect('http://24.126.26.31/' + user.role);

socket.on('login', function() {
//	alert('login');
	socket.emit('login', user);
});

socket.on('serverMessage', function(message) {
//	alert('serverMessage');
	if (typeof message == 'string')
		addMessage(message);
	else if (typeof message == 'object')
		addVote(message)
});

socket.on('userList', function(usernames) {
//	alert('userList');
	usernames.forEach(function(username){
		$('#userlist').append("<div id='" + username + "'>" + username + "</div>");
	});
});

socket.on('userAdd', function(username) {
//	alert('userAdd');
	$('#userlist').append("<div id='" + username + "'>" + username + "</div>");
});

socket.on('userRemove', function(username) {
//	alert('userRemove');
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
	$(this).attr('class', 'voted');
	socket.emit('vote', this.id);
}));