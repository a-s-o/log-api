'use strict';

// Interface (event-store)
// ---
// Service:EventStore = {
//    create [config:Object, events:Object]     -> Promise < EventStore >
// }
//
// class EventStore {
//    create [properties:Obj]                   -> Promise < Obj >
//    validate [eventName:Str, properties:Obj]  -> Obj
//    asEventStream [offset:Num]                -> EventStream
// };

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const types = require('./src/types');
const proto = require('./src/proto');

module.exports = function provider (config, imports, provide) {
   const EventStore = types.EventStore;

   // Add the prototype
   _.extend(EventStore.prototype, proto);

   // Add the EventStore.create() public method; it needs to create
   // internal kafka clients so partially bind the kafka service
   EventStore.create = _.partial(require('./src/factory'), imports.kafka);

   // Provide
   return Bluebird.resolve({ 'event-store': EventStore }).nodeify(provide);
};
