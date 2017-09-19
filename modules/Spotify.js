/* jshint node: true */
"use strict";

const fs = require("fs"),
  path = require("path"),
  configs = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../config/spotify_client_creds.json"),
      { encoding: "utf8" }
    )
  ),
  clientId = configs.id,
  clientSecret = configs.secret,
  redirectUri = "http://localhost:8082/",
  playlistId = "2Ym4ezp8A0akNHYZg6Cd4y",
  testPlaylistId = "2XDHXoOydjxZ7kbv1KZV32",
  username = "lowlevelbass",
  base = require("./Base"),
  request = require("request-promise-native"),
  shelljs = require("shelljs"),
  csvjson = require("csvjson"),
  _ = require("lodash"),
  SpotifyWebApi = require("spotify-web-api-node");

// Grab Spotify tokens using shell script.  We will need the access AND the refresh token
let tokens = JSON.parse(
  shelljs.exec("./spotify_oauth.sh", { silent: true }).stdout
);

const { access_token, refresh_token } = tokens;

// Instantiate Spotify Web API
let spotifyApi = new SpotifyWebApi({
  clientId,
  clientSecret,
  redirectUri
});

// Set Tokens on Spotify instance
spotifyApi.setAccessToken(access_token);
spotifyApi.setRefreshToken(refresh_token);

class Spotify {
  async run() {
    // Grab the playlist so we can check for duplicates
    //const currentPlaylist = await spotifyApi.getPlaylist(username, playlistId);
    const currentPlaylist = await spotifyApi.getPlaylist(username, playlistId);
    const currentTracks = currentPlaylist.body.tracks.items;
    const data = fs.readFileSync(path.join(__dirname, "../playlist.csv"), {
      encoding: "utf8"
    });
    let currentTracksArray = [];
    let newTracksArray = [];

    let newTracks = csvjson.toArray(data); // Grab previously generated CSV playlist
    newTracks.shift(); // Remove first row (header)

    _.each(currentTracks, function(value, key) {
      if (value.track) {
        currentTracksArray.push(value.track.id);
      }
    });

    console.log("Found playlist, cached tracks");
    console.log("Searching for new songs from CSV");

    for (let track of newTracks) {
      const [, trackName, artistName] = track;
      const songString = trackName + " - " + artistName;
      try {
        const tracks = await spotifyApi.searchTracks(
          `track:${trackName} artist:${artistName}`
        );
        const searchResultTracks = tracks.body.tracks;
        const songId =
          typeof searchResultTracks.items[0] !== "undefined"
            ? searchResultTracks.items[0].id
            : undefined;

        if (songId && !currentTracksArray.includes(songId)) {
          console.log("Found song: ", songString);
          newTracksArray.push(songId);
        } else {
          // Either it's a duplicate or could not be found
          console.log("Not adding " + songString);
        }
      } catch (e) {
        console.log("There was an error", e);
      }
    }

    console.log("Creating collection of new tracks ")
    let finalTracks = newTracksArray.map(track => {
      return `spotify:track:${track}`;
    });

    console.log("Chunking array into consumable pieces");

    const chunked = _.chunk(finalTracks, 30);

    for (let chunk of chunked) {
      const myTrack = await spotifyApi.addTracksToPlaylist(username, playlistId,chunk);
      console.log("Songs added to playlist");
    }; 
  }
}

module.exports = Spotify;
