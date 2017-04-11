var io = require('socket.io-client');

var socket = io('http://botws.generals.io');


var user_id = process.env.BOT_USER_ID;
var replay = false;
var forceStart = true;

process.argv.forEach(function (val, index, array) {
	if (index >= 2) {
		if (val == "-r") {
			replay = true;
		}
        else if (val == "-f") {
            forceStart = false;
        }
        else {
            user_id = val;
        }
	}
});

console.log("Hi, my ID is " + user_id);
var username = user_id;

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
var armies;
var terrain;
var turn = 0;
var trueTurn = 0;

//Map size
var width = 0;
var height = 0;
var size = 0;

socket.on('game_start', function(data) {
	// Get ready to start playing the game.
	playerIndex = data.playerIndex;
	var replay_url = 'http://bot.generals.io/replays/' + encodeURIComponent(data.replay_id);
	console.log('Game starting! The replay will be available after the game at ' + replay_url);
});

var start = true; //Bool trigger used to initialize values the first time game_update is received.
var state = "expand"; //Current state the bot is in.
var lastMaxIndex = -1;
var lastMoveArray = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
var lastMoveCounter = 0;
var lastMoveMax = 5;
var rampCounter = 0;

var attackWeight = 550;

socket.on('game_update', function(data) {
    // The first two terms in |map| are the dimensions.
    width = map[0];
    height = map[1];
    size = width * height;
    
	// Patch the city, map diffs, and turn counters into our local variables.
	cities = patch(cities, data.cities_diff);
	map = patch(map, data.map_diff);
	generals = data.generals;
	armies = map.slice(2, size + 1);
	terrain = map.slice(size + 2, map.length - 1);
    turn = data.turn;
    trueTurn = Math.ceil(turn / 2);
    
    //Ramp up stats
    if (data.turn % 2 == 0) {
        rampCounter++;
    }
    if (rampCounter >= 25) {
        attackWeight++;
        lastMoveMax++;
        if (lastMoveMax > 10) {
            lastMoveMax = 10;
        }
        rampCounter = 0;
    }
    
    //Check and update state
    if (trueTurn < 8) {
        return;
    }
    if (trueTurn > 50) {
        state = "snake";
    }
    /*if (trueTurn > 100) {
        var modVal = trueTurn % 10;
        if (modVal >= 0 && modVal < 6) {
            state = "snake";
        }
        else {
            state = "expand";
        }
    }*/
    
    //Perform actions
    if (state == "expand") {
        expand();
    }
    if (state == "snake") {
        snake();
    }
    if (state == "pool") {
        pool();
    }
    if (state == "random") {
        random();
    }
});

function expand() {
    //console.log("Trying to expand");
    var attemptCounter = 0;
    while (true) {
        var index = Math.floor(Math.random() * size);
        if (terrain[index] === playerIndex && armies[index] > 1) {
            attemptCounter++;
            var row = Math.floor(index / width);
            var col = index % width;
            var endIndex = index;
            if (attemptCounter <= 50) {
                /*if (terrain[endIndex - 1] == TILE_EMPTY && col > 0) { //Check for blank on left
                    endIndex--;
                } else if (terrain[endIndex + 1] == TILE_EMPTY && col < width - 1) { //Check for blank on right
                    endIndex++;
                } else if (terrain[endIndex + width] == TILE_EMPTY && row < height - 1) { //Check for blank down
                    endIndex += width;
                } else if (terrain[endIndex - width] == TILE_EMPTY && row > 0) { //Check for blank above
                    endIndex -= width;
                } else {
                    continue;
                }*/
                var score = [0, 0, 0, 0]; //Score array for directions: left, right, down, up

                //Check left move
                if (col > 0) {
                    switch (terrain[endIndex - 1]) { //Check for blank on left
                        case TILE_EMPTY:
                            score[0] += 50;
                            break;
                        case playerIndex:
                            score[0] += 10;
                            score[0] += armies[endIndex - 1];
                            if (armies[endIndex - 1] < 3) {
                                score[0] -= 100;
                            }
                            break;
                        case TILE_MOUNTAIN:
                            score[0] -= 100000;
                            break;
                    }
                    if (terrain[endIndex - 1] >= 0 && terrain[endIndex - 1] != playerIndex) {
                        score[0] += attackWeight + armies[index];
                        score[0] -= armies[endIndex - 1];
                    }
                    if (cities.indexOf(endIndex - 1) >= 0 || lastMoveArray.indexOf(endIndex -1) >= 0) {
                        score[0] -= 50;
                    }
                    genIndex = generals.indexOf(endIndex - 1);
                    if (genIndex >= 0 && genIndex != playerIndex && armies[index] > armies[endIndex - 1]) {
                        score[0] += 2000;
                    }
                } else {
                    score[0] -= 100000;
                }

                //Check right move
                if (col < width - 1) {
                    switch (terrain[endIndex + 1]) { //Check for blank on left
                        case TILE_EMPTY:
                            score[1] += 50;
                            break;
                        case playerIndex:
                            score[1] += 10;
                            score[1] += armies[endIndex + 1];
                            if (armies[endIndex + 1] < 3) {
                                score[1] -= 100;
                            }
                            break;
                        case TILE_MOUNTAIN:
                            score[1] -= 100000;
                            break;
                    }
                    if (terrain[endIndex + 1] >= 0 && terrain[endIndex + 1] != playerIndex) {
                        score[1] += attackWeight + armies[index];
                        score[1] -= armies[endIndex + 1];
                    }
                    if (cities.indexOf(endIndex + 1) >= 0 || lastMoveArray.indexOf(endIndex + 1) >= 0) {
                        score[1] -= 50;
                    }
                    genIndex = generals.indexOf(endIndex + 1);
                    if (genIndex >= 0 && genIndex != playerIndex && armies[index] > armies[endIndex + 1]) {
                        score[1] += 2000;
                    }
                } else {
                    score[1] -= 100000;
                }

                //Check down move
                if (row < height - 1) {
                    switch (terrain[endIndex + width]) { //Check for blank on left
                        case TILE_EMPTY:
                            score[2] += 50;
                            break;
                        case playerIndex:
                            score[2] += 10;
                            score[2] += armies[endIndex + width];
                            if (armies[endIndex + width] < 3) {
                                score[2] -= 100;
                            }
                            break;
                        case TILE_MOUNTAIN:
                            score[2] -= 100000;
                            break;
                    }
                    if (terrain[endIndex + width] >= 0 && terrain[endIndex + width] != playerIndex) {
                        score[2] += attackWeight + armies[index];
                        score[2] -= armies[endIndex + width];
                    }
                    if (cities.indexOf(endIndex + width) >= 0 || lastMoveArray.indexOf(endIndex + width) >= 0) {
                        score[2] -= 50;
                    }
                    genIndex = generals.indexOf(endIndex + width);
                    if (genIndex >= 0 && genIndex != playerIndex && armies[index] > armies[endIndex + width]) {
                        score[2] += 2000;
                    }
                } else {
                    score[2] -= 100000;
                }

                //Check up move
                if (row > 0) {
                    switch (terrain[endIndex - width]) { //Check for blank on left
                        case TILE_EMPTY:
                            score[3] += 50;
                            break;
                        case playerIndex:
                            score[3] += 10;
                            score[3] += armies[endIndex - width];
                            if (armies[endIndex - width] < 3) {
                                score[3] -= 100;
                            }
                            break;
                        case TILE_MOUNTAIN:
                            score[3] -= 100000;
                            break;
                    }
                    if (terrain[endIndex - width] >= 0 && terrain[endIndex - width] != playerIndex) {
                        score[3] += attackWeight + armies[index];
                        score[3] -= armies[endIndex - width];
                    }
                    if (cities.indexOf(endIndex - width) >= 0 || lastMoveArray.indexOf(endIndex - width) >= 0) {
                        score[3] -= 50;
                    }
                    genIndex = generals.indexOf(endIndex - width);
                    if (genIndex >= 0 && genIndex != playerIndex && armies[index] > armies[endIndex - width]) {
                        score[3] += 2000;
                    }
                } else {
                    score[3] -= 100000;
                }

                maxScoreIndex = -1;
                maxScore = -2000;
                for (var i = 0; i < 4; i++) {
                    if (score[i] > maxScore) {
                        maxScore = score[i];
                        maxScoreIndex = i;
                    }
                }
                
                if (maxScoreIndex == -1 || maxScore < 0) {
                    continue;
                }

                switch(maxScoreIndex) {
                    case 0:
                        endIndex--;
                        break;
                    case 1:
                        endIndex++;
                        break;
                    case 2:
                        endIndex += width;
                        break;
                    case 3:
                        endIndex -= width;
                        break;
                }
            } else {
                if (turn > 200) {
                    state = "snake";
                    break;
                }
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
            }

            if (cities.indexOf(endIndex) >= 0 || terrain[endIndex] == TILE_MOUNTAIN) {
                continue;
            }

            //console.log("Attack!");
            socket.emit('attack', index, endIndex);
            attemptCounter = 0;
            break;
        }
    } 
}

function snake() {
    //console.log("Snaking...");
    while (true) {
        var index = getLargestArmy();
        //console.log("Largest army: " + index);
        //var index = army[0];
        //var armySize = army[1];
        
        var row = Math.floor(index / width);
        var col = index % width;
        var endIndex = index;

        var score = [0, 0, 0, 0]; //Score array for directions: left, right, down, up

        //Check left move
        if (col > 0) {
            switch (terrain[endIndex - 1]) { //Check for blank on left
                case TILE_EMPTY:
                    score[0] += 50;
                    break;
                case playerIndex:
                    score[0] += 30;
                    score[0] += armies[endIndex - 1];
                    if (armies[endIndex - 1] < 3) {
                        score[0] -= 100;
                    }
                    break;
                case TILE_MOUNTAIN:
                    score[0] -= 4000;
                    break;
            }
            if (terrain[endIndex - 1] >= 0 && terrain[endIndex - 1] != playerIndex) {
                score[0] += attackWeight + armies[index];
                score[0] -= armies[endIndex - 1];
            }
            if (cities.indexOf(endIndex - 1) >= 0 || lastMoveArray.indexOf(endIndex -1) >= 0) {
                score[0] -= 50;
            }
            genIndex = generals.indexOf(endIndex - 1);
            if (genIndex >= 0 && genIndex != playerIndex) {
                score[0] += 2000;
            }
        } else {
            score[0] -= 100000;
        }

        //Check right move
        if (col < width - 1) {
            switch (terrain[endIndex + 1]) { //Check for blank on left
                case TILE_EMPTY:
                    score[1] += 50;
                    break;
                case playerIndex:
                    score[1] += 30;
                    score[1] += armies[endIndex + 1];
                    if (armies[endIndex + 1] < 3) {
                        score[1] -= 100;
                    }
                    break;
                case TILE_MOUNTAIN:
                    score[1] -= 4000;
                    break;
            }
            if (terrain[endIndex + 1] >= 0 && terrain[endIndex + 1] != playerIndex) {
                score[1] += attackWeight + armies[index];
                score[1] -= armies[endIndex + 1];
            }
            if (cities.indexOf(endIndex + 1) >= 0 || lastMoveArray.indexOf(endIndex + 1) >= 0) {
                score[1] -= 500;
            }
            genIndex = generals.indexOf(endIndex + 1);
            if (genIndex >= 0 && genIndex != playerIndex) {
                score[1] += 2000;
            }
        } else {
            score[1] -= 100000;
        }

        //Check down move
        if (row < height - 1) {
            switch (terrain[endIndex + width]) { //Check for blank on left
                case TILE_EMPTY:
                    score[2] += 50;
                    break;
                case playerIndex:
                    score[2] += 30;
                    score[2] += armies[endIndex + width];
                    if (armies[endIndex + width] < 3) {
                        score[2] -= 100;
                    }
                    break;
                case TILE_MOUNTAIN:
                    score[2] -= 4000;
                    break;
            }
            if (terrain[endIndex + width] >= 0 && terrain[endIndex + width] != playerIndex) {
                score[2] += attackWeight + armies[index];
                score[2] -= armies[endIndex + width];
            }
            if (cities.indexOf(endIndex + width) >= 0 || lastMoveArray.indexOf(endIndex + width) >= 0) {
                score[2] -= 500;
            }
            genIndex = generals.indexOf(endIndex + width);
            if (genIndex >= 0 && genIndex != playerIndex) {
                score[2] += 2000;
            }
        } else {
            score[2] -= 100000;
        }

        //Check up move
        if (row > 0) {
            switch (terrain[endIndex - width]) { //Check for blank on left
                case TILE_EMPTY:
                    score[3] += 50;
                    break;
                case playerIndex:
                    score[3] += 30;
                    score[3] += armies[endIndex - width];
                    if (armies[endIndex - width] < 3) {
                        score[3] -= 100;
                    }
                    break;
                case TILE_MOUNTAIN:
                    score[3] -= 4000;
                    break;
            }
            if (terrain[endIndex - width] >= 0 && terrain[endIndex - width] != playerIndex) {
                score[3] += attackWeight + armies[index];
                score[3] -= armies[endIndex - width];
            }
            if (cities.indexOf(endIndex - width) >= 0 || lastMoveArray.indexOf(endIndex - width) >= 0) {
                score[3] -= 500;
            }
            genIndex = generals.indexOf(endIndex - width);
            if (genIndex >= 0 && genIndex != playerIndex) {
                score[3] += 2000;
            }
        } else {
            score[3] -= 100000;
        }

        maxScoreIndex = 0;
        maxScore = -2000;
        for (var i = 0; i < 4; i++) {
            if (score[i] > maxScore) {
                maxScore = score[i];
                maxScoreIndex = i;
            }
        }

        switch(maxScoreIndex) {
            case 0:
                endIndex--;
                break;
            case 1:
                endIndex++;
                break;
            case 2:
                endIndex += width;
                break;
            case 3:
                endIndex -= width;
                break;
        }

        //console.log("Snake attack! " + index + " to " + endIndex);
        socket.emit('attack', index, endIndex);
        lastMaxIndex = index;
        lastMoveArray[lastMoveCounter] = index;
        lastMoveCounter = (lastMoveCounter + 1) % lastMoveMax;
        return;
    }
}

function pool() {
    console.log("Pooling...");
    var army = getLargestArmy();
}

function random() {
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
}

//Helper functions
function getLargestArmy() {
    //Get largest army
    maxArmyIndex = 0;
    maxArmy = 0
    for (var i = 0; i < size; i++) {
        if (terrain[i] == playerIndex) {
            if (armies[i] > maxArmy) {
                maxArmy = armies[i];
                maxArmyIndex = i;
            }
        }
    }
    return maxArmyIndex;
}
    
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
	var custom_game_id = 'AJ2455';
	socket.emit('join_private', custom_game_id, user_id);
    if (forceStart) {
	   socket.emit('set_force_start', custom_game_id, true);
    }
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
