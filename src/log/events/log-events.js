'use strict';

const _ = require('lodash');
const type = require('joi');

// Interface (log-events)
// ---
// Service:EventStore = {
//    create [properties:Obj]                   -> Promise < Obj >
//    validate [eventName:Str, properties:Obj]  -> Obj
//    asEventStream [offset:Num]                -> EventStream
// };

const EncryptedPassword = type.object().keys({
   key: type.string().required(),
   salt: type.string().required(),
   iterations: type.number().required()
});

module.exports = function provider (options, imports, provide) {

   const EventStore = imports['event-store'];

   const storeConfig = {
      topic: 'logs',
      strict: false, // Allow unspecified event types to be logged
      typeProperty: 'actionId',
      metadataProperty: '_kafka',
      commonProperties: {
         actionId: type.string().required(),
         actionTime: type.date().default(() => Date.now(), 'Now'),
         _kafka: type.date().default(() => ({}), 'EmptyObject')
      }
   };

   const supportedEvents = {
      USER_SIGNUP: {
         userId: type.string().guid().required(),
         data: type.object().required().keys({
            email: type.string().email().required(),
            name: type.string().required(),
            password: EncryptedPassword.required()
         })
      },
      USER_EDIT_PROFILE: {
         userId: type.string().guid().required(),
         data: type.object().required().keys({
            name: type.string(),
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
