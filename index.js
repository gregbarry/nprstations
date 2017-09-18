/* jshint node: true */
'use strict';

const Base = require('./modules/Base');
const Spotify = require('./modules/Spotify');

const base = new Base();
base.run();

const spotify = new Spotify
spotify.run();

/*
(async () => {
  const base = new Base();
  await base.run();

  const spotify = new Spotify
  spotify.run();
})();
*/
