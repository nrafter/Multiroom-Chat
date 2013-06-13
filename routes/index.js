
/*
 * GET home page.
 */

module.exports = function (app) {

	app.locals({
		room: function (req, res) {
			return req.params.room;
		},

		role: function (req, res) {
			return req.params.role;

		}
	});

	app.get('/', function(req, res) {
		res.render('index', { title: 'Express' });
	});

	app.get('/chat/:room/:role', function(req, res) {
		res.locals.room = req.params.room;
		res.locals.role = req.params.role;
		res.render('chat', { title: "Node.js WebSocket chat" });
	})

};