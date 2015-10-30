'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const joi = require('joi');

module.exports = function provider (options, imports, provide) {

   const EventStore = imports['event-store'];

   const storeConfig = {
      topic: 'users',
      typeProperty: 'actionId',
      metadataProperty: 'actionMetadata',
      commonProperties: {
         // Internal metadata
         actionId: joi.string().required(),
         actionTime: joi.date().default(() => Date.now(), 'Now'),
         actionMetadata: joi.date().default(() => ({}), 'EmptyObject'),

         // Required for all user documents
         id: joi.string().guid().required()  // Generate yourself for new docs
      }
   };

   const supportedEvents = {
      userSignedUp: {
         name: joi.string().required(),
         email: joi.string().email().required()
      },
      userUpdated: {
         name: joi.string(),
         email: joi.string().email()
      }
   };

   function output (store) {
      return { 'user-events': store };
   }

   return EventStore.create(storeConfig, supportedEvents)
      .then(output)
      .nodeify(provide);
};
