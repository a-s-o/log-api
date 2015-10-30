'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
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
      fn: function fetchOffset (tableName) {

         function applyDefault (existing) {
            return Offset.create(existing && existing.toJSON() || {
               tableName: tableName,
               topic: 'logs',
               offset: 0,
               partition: 0
            });
         }

         return model.findById(tableName).then(applyDefault);
      }
   });

   Offset.save = t.typedFunc({
      inputs: [Offset],
      output: t.Promise, // < Offset >
      fn: function *saveOffset (offset) {
         return model.upsert(offset).then(() => offset);
      }
   });

   function output () {
      return { offset: Offset };
   }

   return model.sync()
      .then(output)
      .nodeify(provide);
};
