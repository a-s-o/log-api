'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const joi = require('joi');

module.exports = function provider (options, imports, provide) {

   const EventStore = imports['event-store'];

   const storeConfig = {
      topic: 'logs',
      strict: false, // Allow unspecified event types to be logged
      typeProperty: 'actionId',
      metadataProperty: 'kafkaRef',
      commonProperties: {
         actionId: joi.string().required(),
         actionTime: joi.date().default(() => Date.now(), 'Now'),
         kafkaRef: joi.date().default(() => ({}), 'EmptyObject')
      }
   };

   const supportedEvents = {
      USER_SIGNUP: {
         data: joi.object().required()
      },
      USER_EDIT_PROFILE: {
         userId: joi.string().guid().required(),
         data: joi.object().required()
      }
   };

   function output (store) {
      return { 'log-events': store };
   }

   return EventStore.create(storeConfig, supportedEvents)
      .then(output)
      .nodeify(provide);
};
