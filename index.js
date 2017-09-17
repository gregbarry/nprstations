/* jshint node: true */
'use strict';

let base = require('./modules/Base');
let spotify = require('./modules/Spotify');

//base = new base();
//base.makeRequest();

spotify = new spotify
spotify.run();
