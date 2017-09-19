/* jshint node: true */
"use strict";

const moment = require("moment"),
  request = require("request-promise-native"),
  json2csv = require("json2csv"),
  _ = require("lodash"),
  fs = require("fs"),
  dateFormat = "YYYY-MM-DD",
  startDate = moment().format(dateFormat),
  fields = ["id", "trackName", "artistName"],
  dateThreshold = 3,
  stationID = "52151127562ad89a7500001a",
  playlistID = "1504883890981",
  baseURL = "https://api.composer.nprstations.org/v1/widget",
  filterArtist = ['Image', 'Dry', 'Legal ID', 'Bumps', 'Promo'];

let endPointURL = `${baseURL}/${stationID}/playlist?t=${playlistID}&before=`,
  modStartDate = startDate,
  allPlaylist = [], i;

fs.unlinkSync('playlist.csv', (err) => {
  if (err) throw err;
  console.log('successfully deleted old playlist');
});

class Base {
  async run() {
    for (i = 0; i < dateThreshold; i++) {
      if (i !== 0) {
        modStartDate = moment(startDate)
          .subtract(i, "days")
          .format(dateFormat)
          .toString();
      }

      let newEndPointURL = endPointURL + modStartDate;

      await request(newEndPointURL, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          const playlistData = JSON.parse(body),
            songData = playlistData.playlist[0].playlist;

          console.log(newEndPointURL);

          songData.forEach(function(song) {
            const {id,trackName,artistName} = song;
            let foundKeyword = false;
            if (!_.some(allPlaylist, { id }) 
            && !filterArtist.includes(artistName)
            && trackName !== trackName.toUpperCase()) {
              filterArtist.forEach(function(keyword) {
                if (artistName.startsWith(keyword)) {
                  // Set a flag to indicate something from the filter starts the artist name
                  foundKeyword = true;
                }
              });

               // Don't add artists starting with words in the filter
              if (!foundKeyword) {
                allPlaylist.push({
                  id, trackName, artistName
                });
              }
            }
          });
        } else {
          console.log(
            "Got an error: ",
            error,
            ", status code: ",
            response.statusCode
          );
        }
      });
    }

    if (i == dateThreshold) {
      let csv = json2csv({ data: allPlaylist, fields: fields });
      
      fs.writeFile("playlist.csv", csv, function(err) {
        if (err) throw err;
        console.log("file saved");
      });
    }
  }
}

module.exports = Base;
