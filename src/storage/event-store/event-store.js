'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const joi = require('joi');
const Bacon = require('baconjs');

// Interface = {
//    create (eventName:Str, properties:Obj) {} -> Promise < Obj >
//    validate (eventName:Str, properties:Obj) {} -> Obj
//    asEventStream (offset:Num) {} -> EventStream
// };


///////////
// Types //
///////////

const EventStore = t.irreducible('EventStore', function isEventStore (x) {
   return _.isFunction(x.create) && _.isFunction(x.asEventStream);
});

const JoiSchema = t.dict(t.String, t.irreducible('Joi', x => x.isJoi));

////////////////////
// Implementation //
////////////////////

const Proto = {
   create: Bluebird.coroutine(function *create (properties) {
      const eventName = properties[this.typeProperty];
      const validated = this.validate(eventName, properties);

      // Thunk
      const response = yield _.bind(this.producer.send, this.producer, {
         topic: this.topic,
         partition: this.partition,
         messages: [ JSON.stringify(validated) ]
      });

      // Add metadata
      validated[this.metadataProperty] = {
         topic: this.topic,
         partiion: this.partiion,
         offset: _.get(response, [this.topic, this.partition])
      };

      return validated;
   }),

   validate (eventName, properties) {
      const eventDefinition = this.events[eventName];

      // Unknown event
      if (!eventDefinition) {
         // Not in strict mode, so let it pass
         if (!this.strict) return properties;

         // Strict - block unknown events
         throw new Error(`Event "${eventName}" does not exist`);
      }

      // Known event - validate properties
      const check = joi.validate(properties, eventDefinition.schema, {
         stripUnknown: this.strict,
         convert: true,
         abortEarly: true
      });

      if (check.error) {
         const msg = _.get(check, 'error.details.0.message', 'Invalid event');
         throw new new Error(msg);
      }

      return check.value;
   },

   asEventStream (offset) {
      const request = [{
         topic: this.topic,
         offset: offset || 0
      }];

      const options = _.extend({
         fromOffset: true,
         autoCommit: false
      }, arguments[1]);

      const consumer = this.createConsumer(request, options);

      return Bacon
         .fromEventTarget(consumer, 'message')
         .map((msg) => {
            // Deserialize
            const parsed = JSON.parse(msg.value);
            parsed[this.metadataProperty] = _.omit(msg, 'value');
            return parsed;
         });
   }
};

/////////////
// Factory //
/////////////


const Configuration = t.struct({
   topic: t.enums.of('logs users'),
   strict: t.maybe(t.Boolean),
   commonProperties: t.maybe(JoiSchema),
   typeProperty: t.maybe(t.String),
   metadataProperty: t.maybe(t.String)
}, 'EventStore.config');

const eventStoreFactory = t.typedFunc({
   inputs: [t.Any, Configuration, t.dict(t.String, JoiSchema)],

   output: t.Promise, // < EventStore >

   fn: function eventStoreFactory (Kafka, config, events) {
      const name = _.uniqueId(`${config.topic}-client`);
      const client = Kafka.createClient(name);
      const producer = Kafka.createProducer(client);

      const commonProps = config.commonProperties || {};

      const store = _.create(Proto, {
         topic: config.topic,
         partition: 0,
         client: client,
         producer: producer,
         events: _.mapValues(events, (schema) => ({
            schema: _.defaults(schema, commonProps)
         })),

         typeProperty: config.typeProperty || 'type',
         metadataProperty: config.metadataProperty || '_kafka',
         strict: config.strict !== false,

         createConsumer (request, options) {
            return Kafka.createConsumer(client, request, options);
         }
      });

      // Ensure topic exists
      return Kafka.createTopic(producer, store.topic)
         .then(() => store);
   }
});

module.exports = function provider (config, imports, provide) {
   // Bind the kafka client to the eventStoreFactory
   EventStore.create = _.partial(eventStoreFactory, imports.kafka);

   // Provide
   return Bluebird.resolve({ 'event-store': EventStore }).nodeify(provide);
};
