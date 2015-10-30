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

// Setup the user-model and start syncing kafka -> postgres
const setup = Bluebird.coroutine(function *setupUserModel (config, imports) {
   const tableName = config.tableName;

   const Offset = imports.offset;
   const LogEvents = imports['log-events'];

   const log = imports.logger.child({ component: 'user-model' });

   // Create a user model
   const sequelize = imports.sequelize;
   const model = createModel(sequelize, tableName);
   yield model.sync();

   // Get syncronization state from portgres
   // const state = yield Offset.fetch(topicName);

   LogEvents.asEventStream(0)
      .flatMap(function handleEvent (evt) {
         switch (evt.actionId) {
         case 'USER_SIGNUP':
         case 'USER_EDIT_PROFILE':
            const row = _.defaults({ id: evt.userId }, evt.data);
            const upsert = model.upsert(row).then(() => evt);
            return Bacon.fromPromise( upsert );
         default:
            return Bacon.never();
         }
      })
      .bufferWithTimeOrCount(1000, 10)
      .onValue((changes) => {
         // TODO: batch changes; use a sequelize transactions
         // TODO: save offset state based on last change
         log.trace({ count: changes.length }, `user-model updated`);
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
