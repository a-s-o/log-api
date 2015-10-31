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
const joi = require('joi');
const Bacon = require('baconjs');

///////////
// Types //
///////////

const JoiSchema = t.dict(t.String, t.irreducible('Joi', x => x.isJoi));

const EventStore = t.struct({
   topic             : t.String,
   partition         : t.Number,
   client            : t.Any,    // Kafka
   producer          : t.Any,    // Kafka.Producer
   createConsumer    : t.Function, // [request, opts] => Kafka.Consumer

   commonSchema      : JoiSchema,
   events            : t.dict(t.String, t.Object),
   strict            : t.Boolean,

   typeProperty      : t.String,
   metadataProperty  : t.String
}, 'EventStore');

////////////////////
// Implementation //
////////////////////

_.extend(EventStore.prototype, {
   create: Bluebird.coroutine(function *create (properties) {
      const eventName = properties[this.typeProperty];
      const validated = this.validate(eventName, properties);

      // Send the validated message async (thunk)
      const response = yield _.bind(this.producer.send, this.producer, [{
         topic: this.topic,
         partition: this.partition,
         messages: [ JSON.stringify(validated) ]
      }]);

      // Add metadata based on response from Kafka
      validated[this.metadataProperty] = {
         topic: this.topic,
         partiion: this.partition,
         offset: _.get(response, [this.topic, this.partition])
      };

      return validated;
   }),

   validate (eventName, properties) {
      const eventDefinition = this.events[eventName];

      // Unknown event in strict mode - block it
      if (!eventDefinition && this.strict) {
         throw new Error(`Event "${eventName}" does not exist`);
      }

      // All events get validated; either their own schema or common props
      const schema = _.get(eventDefinition, 'schema', this.commonSchema);

      const check = joi.validate(properties, schema, {
         allowUnknown: this.strict === false,
         stripUnknown: this.strict === true,
         convert: true,
         abortEarly: true
      });

      if (check.error) {
         const msg = _.get(check, 'error.details.0.message', 'Invalid event');
         throw new Error(msg);
      }

      return check.value;
   },

   asEventStream (offset) {
      const request = [{
         topic: this.topic,
         offset: offset || 0
      }];

      const options = _.defaults(arguments[1] || {}, {
         fromOffset: true,
         autoCommit: false
      });

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
});

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

      const store = new EventStore({
         topic: config.topic,
         partition: 0,

         strict: config.strict !== false,
         commonSchema: commonProps,
         events: _.mapValues(events, (schema) => ({
            schema: _.extend({}, commonProps, schema)
         })),

         typeProperty: config.typeProperty || 'type',
         metadataProperty: config.metadataProperty || '_kafka',

         client: client,
         producer: producer,
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
