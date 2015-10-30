'use strict';

const Bacon = require('baconjs');
const fs = require('fs');

exports.writeToFile = function writeToFile (filename) {
   const append = Bacon.fromNodeCallback.bind(Bacon, fs.appendFile, filename);
   return evt => append( JSON.stringify(evt) + '\n' );
};
