'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');
const Sequelize = require('sequelize');
const JsonField = require('sequelize-json');
const Bacon = require('baconjs');

function createModel (sequelize, tableName) {
   return sequelize.define('User', {
      id: {
         type: Sequelize.UUID,
         primaryKey: true,
         defaultValue: Sequelize.UUIDV4,
         allowNull: false
      },
      email: {
         type: Sequelize.STRING,
         unique: true
      },
      name: {
         type: Sequelize.STRING,
         allowNull: false
      },
      password: JsonField(sequelize, 'User', 'password')
   }, { tableName });
}

function update (model, evt) {
   switch (evt.actionId) {

   // Upsert user documents on signups and edits
   case 'USER_SIGNUP':
   case 'USER_EDIT_PROFILE':
      const row = _.defaults({ id: evt.userId }, evt.data);
      return Bacon.fromPromise( model.upsert(row) ).map(1);

   default:
      return Bacon.once(0);

   }
}

// Setup the user-model and start syncing kafka -> postgres
const setup = Bluebird.coroutine(function *setupUserModel (config, imports) {
   const tableName = config.tableName;

   const Events = imports['log-events'];
   const offset = imports.offset;

   const log = imports.logger.child({ component: 'user-model' });

   // Create a user model
   const sequelize = imports.sequelize;
   const model = createModel(sequelize, tableName);
   yield model.sync();

   // Get syncronization state from portgres
   const state = yield offset.fetch(tableName);

   // TODO: batch changes; use a sequelize transactions
   // TODO: save offset state based on last change saved
   Events.asEventStream( state.offset )
      .flatMap(update, model)
      .scan(0, (a, b) => a + b)
      .onValue(count => {
         if (count) log.info({ count }, `user-model updated`);
      });

   // Output user-model service
   return {
      'user-queries': {
         count: model.count.bind(model),
         findOne: model.findOne.bind(model),
         findById: model.findById.bind(model),
         findAll: model.findAll.bind(model)
      }
   };
});

module.exports = function provider (config, imports, provide) {
   if (typeof config.tableName !== 'string') {
      throw new Error('config.tableName must be string');
   }

   return setup(config, imports).nodeify(provide);
};
