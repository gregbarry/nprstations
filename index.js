import _ from 'lodash';
import csvjson from 'csvjson';
import fs from 'fs';
import json2csv from 'json2csv';
import moment from 'moment';
import path from 'path';
import request from 'request-promise-native';
import shelljs from 'shelljs';
import spotify from 'spotify-web-api-node';

const baseURL = 'https://api.composer.nprstations.org/v1/widget';
const configs = JSON.parse(fs.readFileSync(path.join(__dirname, '/config/spotify.json')));
const {id: clientId, secret: clientSecret} = configs;
const completeStationPlaylist = [];
const dateFormat = 'YYYY-MM-DD';
const dateThreshold = 3;
const newTracksArray = [];
const playlistId = '1504883890981';
const redirectUri = 'http://localhost:8082/';
const startDate = moment().format(dateFormat);
const stationId = '52151127562ad89a7500001a';
const spotifyPlaylistId = '2Ym4ezp8A0akNHYZg6Cd4y';
const testSpotifyPlaylistId = '2XDHXoOydjxZ7kbv1KZV32'
const username = 'lowlevelbass';

const endPointURL = `${baseURL}/${stationId}/playlist?t=${playlistId}&before=`;
let modStartDate = startDate;

const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const takeBreak = async () => {
    await sleep(2000);
}

const accessSpotify = async () => {
    // Grab Spotify tokens using shell script.  We will need the access AND the refresh token
    const tokens = JSON.parse(shelljs.exec('./spotify_oauth.sh', { silent: true }).stdout);
    const {access_token, refresh_token} = tokens;

    // Instantiate Spotify Web API
    const spotifyApi = new spotify({
        clientId,
        clientSecret,
        redirectUri
    });

    // Set Tokens on Spotify instance
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    return spotifyApi;
}

const getAllPlaylistTracks = (apiCallsNeeded, spotifyApi) => {
    const tracks = [];
    for (let i = 0; i < apiCallsNeeded; i++) {
        tracks.push(new Promise((resolve, reject) => {
            spotifyApi.getPlaylistTracks(username, spotifyPlaylistId, {'offset': i * 100, 'fields': 'items.track.id'})
            .then(data => {
                resolve(data.body.items);
            }, err => {
                console.log(err);
            });
        }));
    }

    return Promise.all(tracks);
}

const main = async () => {
    try {
        for (let i = 0; i < dateThreshold; i++) {
            if (i !== 0) {
                modStartDate = moment(startDate).subtract(i, 'days').format(dateFormat).toString();
            }

            const url = `${endPointURL}${modStartDate}`;
            const res = await request(url);
            const jsonRes = JSON.parse(res);
            const {playlist: wrapper = {}} = jsonRes;
            const {playlist} = wrapper[0];

            playlist.forEach((songData, iteration) => {
                const {
                    id,
                    _duration: duration,
                    trackName: song,
                    artistName: artist
                } = songData;

                if (duration > 60000 && !_.some(completeStationPlaylist, {id})) {
                    completeStationPlaylist.push({id,song,artist})
                }
            });
        }

        const spotifyApi = await accessSpotify();

        // In order to prevent duplicates, we'll need to get the entire playlist to check for dupes
        // Grab total, calculate number of calls, fill array
        const playlistTracksTotal = await spotifyApi.getPlaylistTracks(username, spotifyPlaylistId, {'fields':'total'});
        const apiCallsNeeded = Math.ceil(playlistTracksTotal.body.total / 100);

        const completeSpotifyPlaylist = await getAllPlaylistTracks(apiCallsNeeded, spotifyApi);

        const spotifyPlaylistFormatted = [];
        completeSpotifyPlaylist.forEach(chunk => {
            spotifyPlaylistFormatted.push(...chunk);
        });

        console.log(`Playlist contains ${spotifyPlaylistFormatted.length} tracks`);

        for (let track of completeStationPlaylist) {
            const {song, artist} = track;
            try {
                const trackArtist = `track:${song} artist:${artist}`;
                const spotifySearchResults = await spotifyApi.searchTracks(trackArtist);
                const {tracks: trackResults = []} = spotifySearchResults.body;
                const isTrackResultsGood = (trackResults && trackResults.items.length > 0);
                const songId = isTrackResultsGood ? trackResults.items[0].id : '';
                const isDuplicate = _.filter(spotifyPlaylistFormatted, {track: {id: songId}}).length > 0;

                if (songId && !isDuplicate) {
                    console.log(`Found ${trackArtist}`);
                    newTracksArray.push(songId);
                } else {
                    console.log(`Not adding ${trackArtist}. Duplicate or Not Found.`);
                }
            }
            catch (err) {
                console.log(err);
            }
        }

        const totalSongs = newTracksArray.length;

        console.log(`Adding ${totalSongs} to playlist...`)

        if (totalSongs > 0) {
            console.log('Creating collection of new tracks...')
            const finalTracks = newTracksArray.map(track => {
                return `spotify:track:${track}`;
            });

            console.log('Chunking array into consumable pieces');
            const chunked = _.chunk(finalTracks, 30);

            for (let chunk of chunked) {
                await spotifyApi.addTracksToPlaylist(username, spotifyPlaylistId, chunk);
                takeBreak();
                console.log('Songs added to playlist');
            };
        }
    }
    catch (err) {
        console.log(err);
    }
}

main();
