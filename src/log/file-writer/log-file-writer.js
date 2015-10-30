'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const fs = require('fs');
const reverseReader = require('reverse-line-reader');

const factories = require('./src/factories');

module.exports = function provider (config, imports, provide) {
   if (typeof config.filename !== 'string') {
      throw new Error('config.filename is required');
   }

   const LogEvents = imports['log-events'];
   const writeToFile = factories.writeToFile( config.filename );

   // Writing starts after reading the offset from the file
   // so we can pick up where we left off
   const startWriter = _.once(function startWriter (offset) {
      LogEvents.asEventStream( offset )
         .flatMap(writeToFile)          // Use flatMap to write sequentially
         .onValue(function noop () {}); // No side-effects required
   });

   // Reads the log file `config.filename` in reverse
   // until a _kafka log is found; then uses thats the offset
   // to start appending
   function getLatestOffset (line) {
      if (line.length) {
         try {
            const evt = JSON.parse(line);
            if (evt && evt._kafka) {
               const offset = _.get(evt, '_kafka.offset', 0);
               startWriter( _.parseInt(offset) + 1 );
               return false; // Stop reading
            }
         } catch (ex) {
            startWriter( 0 );
            return false; // Stop reading
         }
      }
   }

   // Not able to read `config.filename` or did not find a
   // kafka log in the file, so start the writer at offset 0
   function done () {
      startWriter( 0 );
      provide();
   }

   try {
      // statSync will throw if filename does not exist, therefore,
      // no need to read the offset on disk
      fs.statSync(config.filename);

      // Read the offset on disk
      reverseReader.eachLine(config.filename, getLatestOffset).then(done);
   } catch (ex) {
      done();
   }

};
