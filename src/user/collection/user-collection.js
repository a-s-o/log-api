'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');
const Bacon = require('baconjs');

const UserModel = require('./model');
const update = require('./update');

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
   log.info(state, 'User collection starting state');
   const updateOffset = _.bind(offset.save, offset, tableName);

   // Create a tranasction from an array of incoming events
   function processAsBatchTransaction (batch) {
      return db.transaction(function makeTranasction (t) {
         return update(collection, updateOffset, batch, t);
      });
   }

   // Create a stream of state changes; batch them
   const dbUpdates = Events.asEventStream( state.offset )
      .bufferWithTimeOrCount(1000, 10)
      .map(processAsBatchTransaction)
      .flatMap(Bacon.fromPromise);

   dbUpdates.onError(err => {
      log.error({ err }, `Failure in user-collection`);
   });

   dbUpdates.onValue(info => {
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
