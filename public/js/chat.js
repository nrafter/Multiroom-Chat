/**
 * Created with JetBrains WebStorm.
 * User: metaljello
 * Date: 6/8/13
 * Time: 12:00 AM
 * To change this template use File | Settings | File Templates.
 */
	//todo: add "cursor: pointer;" to .vote
	//todo: show number of votes beside each message

	//todo: http://roc.cs.rochester.edu/convInterface/chorus/indexRoles.php?role=crowd&part=c&task=nick1&workerId=ww2&assignmentId=&hitId=&turkSubmitTo=&min=
	//todo: change the role to ?role=requester
	//todo: http://roc.cs.rochester.edu/convInterface/memory/index.php


var messagesElement = document.getElementById('messages');
var lastMessageElement = null;

$("window").load(function () {
	$('body').removeClass('preload');
});

function addMessage(message) {
	var newMessageElement = document.createElement('div');
	var newMessageText = null;

	if(typeof message == 'object'){
		var colon = ' : ';
		for(element in message){
			newMessageText = document.createTextNode(message[element].timestamp +
				colon + message[element].nick +
				colon + message[element].message);
			newMessageElement.appendChild(newMessageText);
			$('#messages').append(newMessageElement);
			lastMessageElement = newMessageElement;
			newMessageElement = document.createElement('div');
			newMessageText = null;
		}
	}

	if (typeof message === 'string') {
		newMessageText = document.createTextNode(message);
	}

	newMessageElement.appendChild(newMessageText);
	if(lastMessageElement){
		$(newMessageElement).insertAfter(lastMessageElement);
	}
	else{
		$('#messages').append(newMessageElement);
	}
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
	$('#messages').scrollTop($('#messages')[0].scrollHeight);
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
	if (message.uuid){
		addVote(message);
	}
	else{
		addMessage(message);
	}
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