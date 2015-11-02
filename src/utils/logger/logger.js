'use strict';

const Bunyan = require('bunyan');

module.exports = function provider (config, imports, provide) {
   if (typeof config.namespace !== 'string') {
      throw new Error(`logger needs a namespace`);
   }

   // Suppress logs in test mode
   const testMode = process.env.NODE_ENV === 'test';
   const logLevel = testMode ? 'error' : (config.level || 'info');

   const appLogger = Bunyan.createLogger({
      name: config.namespace,
      level: logLevel,
      serializers: {
         err: err => ({
            name: err.name,
            message: err.message,
            stack: (err.stack || '').split('\n')
         })
      }
   });

   provide(null, {
      logger: {
         child: appLogger.child.bind(appLogger)
      }
   });
};
