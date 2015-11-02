'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');
const Bacon = require('baconjs');

const UserModel = require('./src/model');
const ops = require('./src/operations');

// Setup the user-collection and start syncing kafka -> postgres
const setup = Bluebird.coroutine(function *setupUserCollection (config, imports) {
   const tableName = config.tableName;

   // Application logger
   const log = imports.logger.child({ component: 'user-collection' });

   // Source of all incoming updates
   const Events = imports['log-events'];

   // State stores
   const db = imports.sequelize;
   const offset = imports.offset;
   const collection = db.define('User', UserModel(db), { tableName });
   yield collection.sync();

   // Get intial sync state from offset-store
   const state = yield offset.fetch(tableName);
   log.info({ offset: state.offset }, 'User collection starting state');

   // Create event handlers
   const onChange = ops.userEvents(collection);
   const onEnd = (events, t) => offset.save(tableName, events, t);

   // Create processing chain
   const handler = ops.processCollection(onChange, onEnd);
   const batchToTransaction = batch => db.transaction(handler(batch));

   // Create a stream of state changes then process in batches
   const dbUpdates = Events.asEventStream( state.offset )
      .bufferWithTimeOrCount(1000, 10)
      .map(batchToTransaction)
      .flatMap(Bacon.fromPromise);

   dbUpdates.onError(err => {
      log.error({ err }, `Failure in user-collection`);
   });

   dbUpdates.onValue(evt => {
      const info = {
         changes: evt.changes,
         offset: _.get(evt, 'result.offset')
      };
      
      log.info(info, `user-collection updated`);
   });

   // Output user-collection service
   return { 'user-collection': collection };
});

module.exports = function provider (config, imports, provide) {
   if (typeof config.tableName !== 'string') {
      throw new Error('config.tableName must be string');
   }

   return setup(config, imports).nodeify(provide);
};
