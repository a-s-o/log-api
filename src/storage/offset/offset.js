'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const Sequelize = require('sequelize');

module.exports = function extendClient (config, imports, provide) {
   const sequelize = imports.sequelize;

   const model = sequelize.define('offset', {
      tableName: {
         type: Sequelize.STRING,
         primaryKey: true
      },

      topic: {
         type: Sequelize.STRING,
         allowNull: false
      },

      offset: {
         type: Sequelize.INTEGER,
         allowNull: false
      },

      partition: {
         type: Sequelize.INTEGER,
         allowNull: false
      }
   });

   const Offset = t.struct({
      topic: t.String,
      offset: t.Number,
      partition: t.Number
   });

   // Applies defaults for convenience
   Offset.create = function offsetFactory (props) {
      return new Offset(props);
   };

   Offset.fetch = t.typedFunc({
      inputs: [t.String],
      output: t.Promise, // < Offset >
      fn: Bluebird.coroutine(function *fetchOffset (tableName) {

         const existing = yield model.findById(tableName);
         if (existing && existing.toJSON) return existing.toJSON();

         const created = yield model.create({
            tableName: tableName,
            topic: 'logs',
            offset: 0,
            partition: 0
         });

         return created.toJSON();
      })
   });

   Offset.save = function saveOffset (tableName, evts, trx) {
      const lastEvent = _.last(evts);
      const newOffset = _.get(lastEvent, '_kafka.offset');

      return model.findById(tableName, { transaction: trx })
         .then(function update (doc) {
            if (!doc) throw new Error(`Offset state not found for ${tableName}`);
            if (!newOffset) return doc;

            // Start from the next offset
            doc.offset = newOffset + 1;

            // Save the document in the same transaction
            return doc.save({ transaction: trx });
         });
   };

   function output () {
      return { offset: Offset };
   }

   return model.sync()
      .then(output)
      .nodeify(provide);
};
