/* jshint node: true */
'use strict';

const Base = require('./modules/Base');
const Spotify = require('./modules/Spotify');

const base = new Base();
base.run()
.then(() => {
    const spotify = new Spotify;
    spotify.run();
});