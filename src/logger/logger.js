'use strict';

const Bunyan = require('bunyan');

module.exports = function provider (config, imports, provide) {
   if (typeof config.namespace !== 'string') {
      throw new Error(`logger needs a namespace`);
   }

   const appLogger = Bunyan.createLogger({
      name: config.namespace
   });

   provide(null, {
      logger: {
         child: appLogger.child.bind(appLogger)
      }
   });
};
