'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const types = require('./types');
const JoiSchema = types.Joi;
const EventStore = types.EventStore;

const Configuration = t.struct({
   topic: t.enums.of('logs users'),
   strict: t.maybe(t.Boolean),
   commonProperties: t.maybe(JoiSchema),
   typeProperty: t.maybe(t.String),
   metadataProperty: t.maybe(t.String)
}, 'EventStore.config');

module.exports = t.typedFunc({
   inputs: [t.Any, Configuration, t.dict(t.String, JoiSchema)],
   output: t.Promise, // < EventStore >
   fn: function eventStoreFactory (Kafka, config, events) {
      const name = `${config.topic}-client`;
      const commonProps = config.commonProperties || {};
      const topic = config.topic;
      const partition = 0;

      // Create a producer
      const producerClient = Kafka.createClient(_.uniqueId(name));
      const producer = Kafka.createProducer(producerClient);

      // Sends messages to kafka using a pre-created
      // producer (above)
      function sendMessages (messages) {
         const deferred = Bluebird.defer();
         const request = [{
            topic: topic,
            partition: partition,
            messages: messages
         }];

         producer.send(request, deferred.callback);
         return deferred.promise;
      }

      // Recommended by node-kafka to create 1 client per consumer
      // so provide this factory to be used by store.asEventStream()
      function createConsumer (request, options) {
         const consumerClient = Kafka.createClient(_.uniqueId(name));
         return Kafka.createConsumer(consumerClient, request, options);
      }

      // Ensure topic exists before creating the store
      return Kafka.createTopic(producer, topic)
         .then(() => new EventStore({
            topic: topic,
            partition: partition,

            strict: config.strict !== false,
            commonSchema: commonProps,
            events: _.mapValues(events, (schema) => ({
               schema: _.extend({}, commonProps, schema)
            })),

            typeProperty: config.typeProperty || 'type',
            metadataProperty: config.metadataProperty || '_kafka',

            sendMessages: sendMessages,
            createConsumer: createConsumer
         }));
   }
});
