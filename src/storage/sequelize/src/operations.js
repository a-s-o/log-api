'use strict';

exports.waitForConnections = function *wait (client, log) {
   let connected = false;

   while (!connected) {
      try {
         yield client.authenticate();
         connected = true;
      } catch (ex) {
         log.info()
      }
   }
};
