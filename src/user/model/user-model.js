'use strict';

const Bluebird = require('@aso/bluebird');
const Sequelize = require('sequelize');
const sync = require('./sync');

const UserSchema = {
   email: {
      type: Sequelize.STRING,
      primaryKey: true
   },

   name: {
      type: Sequelize.STRING,
      allowNull: false
   },

   password: {
      type: Sequelize.JSON,
      allowNull: false
   }
};

// Setup the user-model and start syncing kafka -> postgres
const setup = Bluebird.coroutine(function *setupUserModel (config, imports) {
   const topicName = config.topicName;
   const tableName = config.tableName;

   const Kafka = imports.kafka;
   const Offset = imports.offset;

   const sequelize = imports.sequelize;
   const log = imports.logger.child({ component: 'user-model' });

   // Create a user model
   const model = sequelize.define('User', UserSchema, { tableName });
   yield model.sync();

   // Get syncronization state from portgres
   const state = yield Offset.fetch(topicName);

   // Begin syncing incoming changes from kafka topic to postgres
   sync(Kafka, model, state, log);

   // Output user-model service
   return { 'user-model': model };
});

module.exports = function provider (config, imports, provide) {
   if (typeof config.tableName !== 'string') {
      throw new Error('config.tableName must be string');
   }

   if (typeof config.topicName !== 'string') {
      throw new Error('config.topicName must be string');
   }

   return setup(config, imports).nodeify(provide);
};
