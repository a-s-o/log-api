'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Sequelize = require('sequelize');

module.exports = function extendClient (config, imports, provide) {
   const sequelize = imports.sequelize;

   const model = sequelize.define('offset', {
      topic: {
         type: Sequelize.STRING,
         primaryKey: true
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
      fn: function fetchOffset (topic) {

         function applyDefault (existing) {
            return Offset.create(existing || {
               topic: topic,
               offset: 0,
               partition: 0
            });
         }
         
         return model.findById(topic).then(applyDefault);
      }
   });

   Offset.save = t.typedFunc({
      inputs: [Offset],
      output: t.Promise, // < Offset >
      fn: function saveOffset () {
         // return Offsets.findById(topic).then(Offset.create);
      }
   });

   function output () {
      return { offset: Offset };
   }

   return model.sync()
      .then(output)
      .nodeify(provide);
};
