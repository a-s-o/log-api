'use strict';

// Purpose:
// - provide a simplified interface to kafka

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const NodeKafka = require('kafka-node');
const instanceOf = klass => x => x instanceof klass;

const helpers = require('./helpers');

const validTopics = ['logs', 'users', 'test'];

///////////
// Types //
///////////

const Kafka = t.irreducible('Kafka', instanceOf(NodeKafka.Client));
Kafka.Producer = t.irreducible('KafkaProducer', instanceOf(NodeKafka.Producer));
Kafka.Consumer = t.irreducible('KafkaConsumer', instanceOf(NodeKafka.Consumer));

// FetchRequest - keep mutable as NodeKafka's internally modifies these
Kafka.FetchRequest = t.subtype(t.Object, function isFetchRequest (obj) {
   return _.isString(obj.topic) && _.isNumber(obj.offset);
}, 'KafkaFetchRequest');

// Message - i.e. the value to be saved in Kafka
Kafka.Message = t.subtype(t.Object, obj => {
   return _.has(obj, 'eventType') && _.has(obj, 'eventTime');
}, 'KafkaMessage');

Kafka.ProduceRequest = t.struct({
   topic: t.enums.of(validTopics),
   messages: t.list(Kafka.Message),
   partition: t.Number
}, 'KafkaProduceRequest');

////////////
// Errors //
////////////

Kafka.UnableToSerialize = class UnableToSerialize extends Error {
   constructor (data) {
      super();
      Error.captureStackTrace(this, this.constructor);
      this.data = data;
      this.name = 'UnableToSerialize';
   }
};

////////////
// Public //
////////////

Kafka.sendMessage = t.typedFunc({
   inputs: [Kafka.Producer, Kafka.ProduceRequest],
   output: t.Promise,
   fn: function sendMessage (producer, request) {
      function sent (resolve, reject) {
         const message = {
            topic: request.topic,
            messages: request.messages.map(serializeMessage),
            partition: request.partition
         };

         function done (err, resp) {
            if (err) reject(err);
            else resolve(resp);
         }

         producer.on('error', err => reject(err));
         helpers.producer.onReady(producer, () => producer.send([message], done));
      }

      const messageCreated = new Bluebird(sent);
      return messageCreated.timeout(1000);
   }
});

Kafka.createTopic = t.typedFunc({
   inputs: [Kafka.Producer, t.String],
   output: t.Promise,  // < Response:String >
   fn: function createTopic (producer, topicName) {
      const created = new Bluebird(function wait (resolve, reject) {
         helpers.producer.onReady(producer, () => {
            // Second argument is async; async=false ensures the topic
            // is created before this method returns
            producer.createTopics([topicName], false, (err, resp) => {
               if (err) reject(err);
               else resolve(resp);
            });
         });
      });

      return created.timeout(2000, 'Kafka.createTopic timed out [2s]');
   }
});

const createProducer = t.typedFunc({
   inputs: [Kafka, t.struct({})],
   output: Kafka.Producer,
   fn: function producerFactory (client, opts) {
      return new NodeKafka.Producer(client, opts);
   }
});

const createConsumer = t.typedFunc({
   inputs: [Kafka, t.list(Kafka.FetchRequest), t.Object],
   output: Kafka.Consumer,
   fn: function consumerFactory (client, requests, opts) {
      return new NodeKafka.Consumer(client, requests, opts);
   }
});


//////////////
// Internal //
//////////////

// createProducer is internal for now as single producer
// is sufficient; this factory can be exposed later down
// the road if multiple producers are necessary
// example:  Kafka.createProducer = (opts) => createProducer(client, opts || {});


function serializeMessage (msg) {
   try {
      return JSON.stringify(msg);
   } catch (ex) {
      throw new Kafka.UnableToSerialize(msg);
   }
}

function setupClient ( zookeeperHost, log ) {
   const clientCreated = new Bluebird(function create (resolve) {
      // Create a client (singleton)
      const connectionString = `${zookeeperHost}/`;
      const name = 'log-api-kafka-client';
      const client = new NodeKafka.Client(connectionString, name);

      // Just log all errors; this promise will reject based on timeout
      client.on('error', (err) => log.error({ err }));
      helpers.client.onReady(client, () => resolve(client));
   });

   log.info('Waiting (upto 10s) for kafka to get ready');

   return clientCreated
      .timeout(10000, 'kafka client timed out [10s]')
      .tap(() => log.info('kafka client is ready'));
}


module.exports = function provider (config, imports, provide) {
   const docker = imports.docker;
   const log = imports.logger.child({ component: 'kafka' });

   // Simple app, therefore client is a singleton and
   // we pre-bind it to the factories below
   function simplifyPublicAPI (client) {
      Kafka.createConsumer = function boundConsumer (req, opts) {
         return createConsumer(client, req, opts || {});
      };

      Kafka.createProducer = function boundProducer () {
         return createProducer(client,  {
            requireAcks: 1,
            ackTimeoutMs: 500
         });
      };
   }

   function output () {
      return { kafka: Kafka };
   }

   return docker.startContainer( config.zookeeperContainer )
      .then(() => docker.startContainer( config.kafkaContainer ))
      .then(() => setupClient( config.zookeeperHost, log ))
      .tap(simplifyPublicAPI)
      .then(output)
      .nodeify(provide);
};
