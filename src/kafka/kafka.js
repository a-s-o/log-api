'use strict';

// Purpose:
// - provide a simplified interface to kafka

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const NodeKafka = require('kafka-node');
const instanceOf = klass => x => x instanceof klass;

const validTopics = ['logs', 'users', 'test'];

///////////
// Types //
///////////

const Kafka = t.irreducible('Kafka', instanceOf(NodeKafka.Client));
Kafka.Producer = t.irreducible('KafkaProducer', instanceOf(NodeKafka.Producer));
Kafka.Consumer = t.irreducible('KafkaConsumer', instanceOf(NodeKafka.Consumer));

// Validate requests - can't use a immutable data here as NodeKafka
// internally mutates the objects
Kafka.FetchRequest = t.subtype(t.Object, function isFetchRequest (obj) {
   return _.isString(obj.topic) && _.isNumber(obj.offset);
}, 'KafkaFetchRequest');

Kafka.Message = t.subtype(t.Object, obj => {
   return _.has(obj, 'eventType') && _.has(obj, 'eventTime');
}, 'KafkaMessage');

Kafka.ProduceRequest = t.struct({
   topic: t.enums.of(validTopics),
   messages: t.list(Kafka.Message),
   partition: t.Number
}, 'KafkaProduceRequest');

////////////
// Public //
////////////

const createConsumer = t.typedFunc({
   inputs: [Kafka, t.list(Kafka.FetchRequest), t.Object],
   output: Kafka.Consumer,
   fn: function producerFactory (client, requests, opts) {
      return new NodeKafka.Consumer(client, requests, opts);
   }
});

const sendMessage = t.typedFunc({
   inputs: [Kafka.Producer, Kafka.ProduceRequest],
   output: t.Promise,
   fn: function sendMessage (producer, request) {
      function sent (resolve, reject) {
         const message = {
            topic: request.topic,
            messages: request.messages.map(msg => JSON.stringify(msg)),
            partition: request.partition
         };

         function done (err, resp) {
            if (err) reject(err);
            else resolve(resp);
         }

         producer.on('error', err => reject(err));

         if (producer.ready) {
            producer.send([message], done);
         } else {
            producer.on('ready', () => {
               producer.send([message], done);
            });
         }

      }

      const messageCreated = new Bluebird(sent);
      return messageCreated.timeout(1000);
   }
});

//////////////
// Internal //
//////////////

// Internal for now as single producer is sufficient;
// this factory can be exposed later down the road if
// multiple producers are necessary
// example:  Kafka.createProducer = (opts) => createProducer(client, opts || {});

const createProducer = t.typedFunc({
   inputs: [Kafka, t.struct({})],
   output: Kafka.Producer,
   fn: function producerFactory (client, opts) {
      return new NodeKafka.Producer(client, opts);
   }
});

function createClient ( zookeeperHost ) {
   // Create a client (singleton)
   // [connectionString:String, clientID:String]
   const client = new NodeKafka.Client(`${zookeeperHost}/`, 'log-api-kafka-client');

   // Create a producer (also singleton)
   const producer = createProducer(client, {
      requireAcks: 1,
      ackTimeoutMs: 500
   });

   // Make opts optional and pre-bind client instance to factories
   Kafka.createConsumer = (req, opts) => createConsumer(client, req, opts || {});
   Kafka.sendMessage = (req) => sendMessage(producer, req);

   return producer;
}

function createTopics (producer, topics) {
   const topicsCreated = new Bluebird(function wait (resolve, reject) {
      producer.on('ready', () => {
         producer.createTopics(topics, false, (err, resp) => {
            if (err) reject(err);
            else resolve(resp);
         });
      });
   });

   return topicsCreated.timeout(2000);
}

module.exports = function provider (config, imports, provide) {
   const docker = imports.docker;

   function output () {
      return { kafka: Kafka };
   }

   return docker.startContainer( config.zookeeperContainer )
      .then(() => docker.startContainer( config.kafkaContainer ))
      .then(() => createClient( config.zookeeperHost ))
      .then(producer => createTopics(producer, validTopics))
      .then(output)
      .nodeify(provide);
};
