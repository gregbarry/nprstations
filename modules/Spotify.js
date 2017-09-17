/* jshint node: true */
'use strict';

const fs = require('fs'),
      path = require('path'),
      configs = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/spotify_client_creds.json'), { encoding : 'utf8'})),
      clientId = configs.id,
      clientSecret = configs.secret,
      data = fs.readFileSync(path.join(__dirname, '../playlist.csv'), { encoding : 'utf8'}),
      redirectUri = "http://localhost:8082/",
      playlistID = "2Ym4ezp8A0akNHYZg6Cd4y",
      testPlaylistID = "2XDHXoOydjxZ7kbv1KZV32",
      username = "lowlevelbass",
      request = require('request-promise-native'),
      shelljs = require('shelljs'),
      csvjson = require('csvjson'),
      _ = require('lodash'),
      SpotifyWebApi = require('spotify-web-api-node');

// Grab previously generated CSV playlist
let tracks = csvjson.toArray(data);
// Remove first row (header)
tracks.shift();

class Spotify {

    // TODO rename Base to be NPR and then create a base to extend from with wait in it 
    /**
     * Wait x milliseconds
     * @param {*} ms 
     */
    wait(ms){
      let start = new Date().getTime(),
          end = start;

      while(end < start + ms) {
        end = new Date().getTime();
      }
   }

  run(playlist) {
    // Grab Spotify tokens using shell script.  We will need the access AND the refresh token
    let tokens = JSON.parse(shelljs.exec('./spotify_oauth.sh', {silent:true}).stdout);

    const access_token = tokens.access_token,
          refresh_token = tokens.refresh_token;

    // Instantiate Spotify Web API
    let spotifyApi = new SpotifyWebApi({
      clientId : clientId,
      clientSecret : clientSecret,
      redirectUri : redirectUri
    });

    // Set Tokens on Spotify instance
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);  

    // Grab the playlist so we can check for duplicates
    spotifyApi.getPlaylist(username, playlistID)
    .then(function(data) {
      const currentTracks = data.body.tracks.items;
      
      let currentTracksArray = [];

      // Loop through tracks and push track ID to an array
      _.each(currentTracks, function(value, key){
        _.each(value, function(value, key){
          if (key == "track") {
            currentTracksArray.push(value.id);
          }
        });
      });
      
      // Loop through CSV results (now an array) playlist and cache artist and track name
      tracks.forEach(function(track) {
        const artist = track[2],
              trackName = track[1];
  
        this.wait(2000);      

        // Try to find a match based on artist and track name
        spotifyApi.searchTracks(`track:${trackName} artist:${artist}`)
        .then(function(data) {
          const songId = (data.body.tracks.items) ? data.body.tracks.items[0].id : undefined;
          
          if (songId) {
            return songId;          
          }
        }, function(err) {
          console.log('Something went wrong!', err);
        })
        .then(function(songId) {
            // Change this so that we pass an array of all the songs instead of one at a time
            // If there is a songID and the songID isn't already on the playlist, add it to the playlist
            if (songId && currentTracksArray.indexOf(songId) == -1) {
              this.wait(2000);
              
              spotifyApi.addTracksToPlaylist(username, testPlaylistID, [`spotify:track:${songId}`])
              .then(function(data) {
                console.log('Added tracks to playlist!');
              }, function(err) {
                console.log('Something went wrong!', err);
              });
            }
        });            
      });      
    }, function(err) {
      console.log('Something went wrong!', err);
    });
  }
}

module.exports = Spotify;
