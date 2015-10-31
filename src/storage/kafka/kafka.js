'use strict';

// Interface (kafka)
// ---
// Service:Kafka = {
//    createClient [name:String]          -> Kafka.Client
//
//    createConsumer [                    -> Kafka.Consumer
//       client:Kafka,
//       req:Kafka.FetchRequest,
//       opts:Object
//    ]
//
//    createProducer  [client:Kafka]      -> Kafka.Producer
//
//    createTopic  [                      -> Promise < response:String >
//       producer:Kafka.Producer,
//       name:String
//    ]
//
//    sendMessage [                       -> Promise < response:String >
//       producer:Kafka.Producer,
//       request:Kafka.ProduceRequest
//    ]
// }

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');

const factories = require('./src/factories');
const types = require('./src/types');
const operations = require('./src/operations');

const setup = Bluebird.coroutine(function *setup (config, imports) {
   const docker = imports.docker;
   const log = imports.logger.child({ component: 'kafka' });

   // Start the necessary docker containers
   yield docker.startContainer( config.zookeeperContainer );
   yield docker.startContainer( config.kafkaContainer );

   const Kafka = types.Kafka;
   const Client = factories.Client;
   const Consumer = factories.Consumer;
   const Producer = factories.Producer;

   // Client is singleton so partially apply it to Consumer factory
   Kafka.createClient = _.partial(Client, config.zookeeperHost);

   Kafka.createConsumer = function createConsumer (client, req, opts) {
      return new Consumer(client, req, opts || {});
   };

   Kafka.createProducer = function createProducer (client, opts) {
      return new Producer(client, opts || {
         requireAcks: 1,
         ackTimeoutMs: 500
      });
   };

   // Add more public operations to the kafka service
   Kafka.sendMessage = operations.sendMessage;
   Kafka.createTopic = operations.createTopic;

   // Wait for client to be ready
   log.info('Waiting (upto 20s) for Kafka to get ready');
   yield operations.awaitConnection(Kafka, log, 20);
   log.info('Kafka client is ready');

   return { kafka: Kafka };

});

module.exports = function provider (config, imports, provide) {
   if (!_.isString(config.zookeeperHost)) {
      throw new Error('config.zookeeperHost is required');
   }

   return setup(config, imports).nodeify(provide);
};
