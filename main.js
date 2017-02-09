var io = require('socket.io-client');

var socket = io('http://botws.generals.io');


var user_id = 'bobpancakebot55';
var username = 'Bob Pancake';
var replay = false;

process.argv.forEach(function (val, index, array) {
	if (index >= 2) {
		if (val == "-r") {
			replay = true;
		}
	}
});

// Terrain Constants.
// Any tile with a nonnegative value is owned by the player corresponding to its value.
// For example, a tile with value 1 is owned by the player with playerIndex = 1.
var TILE_EMPTY = -1;
var TILE_MOUNTAIN = -2;
var TILE_FOG = -3;
var TILE_FOG_OBSTACLE = -4; // Cities and Mountains show up as Obstacles in the fog of war.

// Game data.
var playerIndex;
var generals;
var cities = [];
var map = [];

socket.on('game_start', function(data) {
	// Get ready to start playing the game.
	playerIndex = data.playerIndex;
	var replay_url = 'http://bot.generals.io/replays/' + encodeURIComponent(data.replay_id);
	console.log('Game starting! The replay will be available after the game at ' + replay_url);
});

socket.on('game_update', function(data) {
	// Patch the city and map diffs into our local variables.
	cities = patch(cities, data.cities_diff);
	map = patch(map, data.map_diff);
	generals = data.generals;

	// The first two terms in |map| are the dimensions.
	var width = map[0];
	var height = map[1];
	var size = width * height;

	// The next |size| terms are army values.
	// armies[0] is the top-left corner of the map.
	var armies = map.slice(2, size + 1);

	// The last |size| terms are terrain values.
	// terrain[0] is the top-left corner of the map.
	var terrain = map.slice(size + 2, map.length - 1);

	// Make a random move.
	while (true) {
		// Pick a random tile.
		var index = Math.floor(Math.random() * size);
	
		// If we own this tile, make a random move starting from it.
		if (terrain[index] === playerIndex) {
			var row = Math.floor(index / width);
			var col = index % width;
			var endIndex = index;
	
			var rand = Math.random();
			if (rand < 0.25 && col > 0) { // left
				endIndex--;
			} else if (rand < 0.5 && col < width - 1) { // right
				endIndex++;
			} else if (rand < 0.75 && row < height - 1) { // down
				endIndex += width;
			} else if (row > 0) { //up
				endIndex -= width;
			} else {
				continue;
			}
	
			// Would we be attacking a city? Don't attack cities.
			if (cities.indexOf(endIndex) >= 0) {
				continue;
			}
	
			socket.emit('attack', index, endIndex);
			break;
		}
	}
});

socket.on('disconnect', function() {
	console.error('Disconnected from server.');
	process.exit(1);
});

socket.on('connect', function() {
	console.log('Connected to server.');
	/* Don't lose this user_id or let other people see it!
	 * Anyone with your user_id can play on your bot's account and pretend to be your bot.
	 * If you plan on open sourcing your bot's code (which we strongly support), we recommend
	 * replacing this line with something that instead supplies the user_id via an environment variable, e.g.
	 * var user_id = process.env.BOT_USER_ID;
	 */

	// Set the username for the bot.
	socket.emit('set_username', user_id, username);

	// Join a custom game and force start immediately.
	// Custom games are a great way to test your bot while you develop it because you can play against your bot!
	var custom_game_id = 'bobs_bot_game';
	socket.emit('join_private', custom_game_id, user_id);
	socket.emit('set_force_start', custom_game_id, true);
	console.log('Joined custom game at http://bot.generals.io/games/' + encodeURIComponent(custom_game_id));
});

/* Returns a new array created by patching the diff into the old array.
 * The diff formatted with alternating matching and mismatching segments:
 * <Number of matching elements>
 * <Number of mismatching elements>
 * <The mismatching elements>
 * ... repeated until the end of diff.
 * Example 1: patching a diff of [1, 1, 3] onto [0, 0] yields [0, 3].
 * Example 2: patching a diff of [0, 1, 2, 1] onto [0, 0] yields [2, 0].
 */
function patch(old, diff) {
	var out = [];
	var i = 0;
	while (i < diff.length) {
		if (diff[i]) {  // matching
			Array.prototype.push.apply(out, old.slice(out.length, out.length + diff[i]));
		}
		i++;
		if (i < diff.length && diff[i]) {  // mismatching
			Array.prototype.push.apply(out, diff.slice(i + 1, i + 1 + diff[i]));
			i += diff[i];
		}
		i++;
	}
	return out;
}

function leaveGame() {
	socket.emit('leave_game');
}

socket.on('game_lost', function() {
	leaveGame();
	if (!replay) {
		process.exit();
	}
	var custom_game_id = 'bobs_bot_game';
        socket.emit('join_private', custom_game_id, user_id);
        socket.emit('set_force_start', custom_game_id, true);
});

socket.on('game_won', function() {
	leaveGame();
	if (!replay) {
		process.exit();
	}
	var custom_game_id = 'bobs_bot_game';
        socket.emit('join_private', custom_game_id, user_id);
        socket.emit('set_force_start', custom_game_id, true);
});
