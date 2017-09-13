/* jshint node: true */
'use strict';

const moment = require('moment'),
      request = require('request-promise-native'),
      json2csv = require('json2csv'),
      _ = require('lodash'),
      fs = require('fs'),
      dateFormat = "YYYY-MM-DD";

let startDate = moment().format(dateFormat),
    modStartDate = startDate,
    allPlaylist = [], i;

const fields = ['id', 'trackName', 'artistName'],
      dateThreshold = 30,
      stationID = "52151127562ad89a7500001a",
      playlistID = "1504883890981",
      baseURL = "https://api.composer.nprstations.org/v1/widget",
      testURL = "https://api.composer.nprstations.org/v1/widget/52151127562ad89a7500001a/playlist?t=1504883890981&before=2017-09-08";

let endPointURL = baseURL + "/" + stationID + "/playlist?t=" + playlistID + "&before=";


class Base {    
    /**
     * @method writeFile
     * @param {*} allPlaylist 
     */
    writeFile(allPlaylist) {
        let csv = json2csv({ data: allPlaylist, fields: fields });
        
        fs.writeFile('playlist.csv', csv, function(err) {
            if (err) throw err;
            console.log('file saved');
        });    
    }

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

    async makeRequest() {
        for (i = 0; i < dateThreshold; i++) { 
            if (i !== 0) {
                modStartDate = moment(startDate).subtract(i, 'days').format(dateFormat).toString();
            }

            let newEndPointURL = endPointURL + modStartDate;

            await request(newEndPointURL, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const playlistData = JSON.parse(body),
                          songData = playlistData.playlist[0].playlist;

                    console.log(newEndPointURL);

                    songData.forEach(function(song) {
                        if (!_.some(allPlaylist, { "id": song.id })) {
                            allPlaylist.push({
                                "id": song.id,
                                "trackName": song.trackName,
                                "artistName": song.artistName
                            });
                        }
                    });                       
                } else {
                    console.log("Got an error: ", error, ", status code: ", response.statusCode)
                }

                this.wait(2000);
            }); 
        }

        if (i == dateThreshold) {
            this.writeFile(allPlaylist);            
        }
    }
}

module.exports = Base;
