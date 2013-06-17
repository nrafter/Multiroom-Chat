Multiroom-Chat
==============

Multiroom-Chat is a chat application that allows workers to transparently suggest and vote on answers
to users questions, that are then shown to users once a suggestion reaches a certain number of votes.  It allows
multiple workers to answer questions in a vox populi fashion, without the user ever knowing how many people
contributed to the answer.

How it works
---

There are three roles in any given chat:  admin, worker, and user.  Three namespaced sockets are
created on server side, and when a client visits a url, e.g. www.testing.com/chat/test/admin,
a socket to the role specified by the last url parameter is opened and the user information (username, room,
role/namespace) is sent to the server.  When a client sends a message it's received and broadcast out to everyone on
that socket including the user who sent it, and possibly on other sockets, depending on the role of the client who
sent it.

* Admins can see admin, worker, and user messages and names in the userlist.
* Workers can see worker, and user messages and names in the userlist.
* Users can only see user messages and names in the userlist, and popular suggestions from workers.

Workers messages constitute a special kind of message on the server side, because they are votable.  Worker's
suggestions are broadcast as votable messages to other workers, and as simple messages to admins.  Workers can click on
 other worker's suggestions to send a vote to the server, and when a suggestion receives a number of votes it's shown
  to both admins and users.

Socket events
----

All 3 namespaces share these 3 receiving events.

1.	login
2.	clientMessage
3.	disconnect

The worker namespace has an additional receiving event.

4.	vote

The chat clients receives an event serverMessage and decides whether it is a vote or a message based on it's type of
either string or object.

How to use
---



