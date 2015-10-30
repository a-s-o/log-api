'use strict';

const _ = require('lodash');
const joi = require('joi');

module.exports = function provider (options, imports, provide) {

   const EventStore = imports['event-store'];

   const storeConfig = {
      topic: 'logs',
      strict: false, // Allow unspecified event types to be logged
      typeProperty: 'actionId',
      metadataProperty: '_kafka',
      commonProperties: {
         actionId: joi.string().required(),
         actionTime: joi.date().default(() => Date.now(), 'Now'),
         _kafka: joi.date().default(() => ({}), 'EmptyObject')
      }
   };

   const EncryptedPassword = joi.object().keys({
      key: joi.string().required(),
      salt: joi.string().required(),
      iterations: joi.number().required()
   });

   const supportedEvents = {
      USER_SIGNUP: {
         userId: joi.string().guid().required(),
         data: joi.object().required().keys({
            email: joi.string().email().required(),
            name: joi.string().required(),
            password: EncryptedPassword.required()
         })
      },
      USER_EDIT_PROFILE: {
         userId: joi.string().guid().required(),
         data: joi.object().required().keys({
            name: joi.string(),
            password: EncryptedPassword
         })
      }
   };

   function output (store) {
      return { 'log-events': store };
   }

   return EventStore.create(storeConfig, supportedEvents)
      .then(output)
      .nodeify(provide);
};
