'use strict';

// Interface (kafka)
// ---
// Module:Kafka = {
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
const checks = require('./src/checks');

const setup = Bluebird.coroutine(function *setup (config, imports) {
   const docker = imports.docker;

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

   // Constant condition is okay as the setup promise
   // times out in the provider below
   while (true) {  // eslint-disable-line no-constant-condition
      try {
         // Create client and wait for it to be ready
         const tempClient = Kafka.createClient('log-api-init');
         yield _.partial(checks.client.onReady, tempClient);
         yield _.bind(tempClient.close, tempClient);

         // Provide
         return { kafka: Kafka };
      } catch (ex) {
         // Check again after 1s
         yield Bluebird.delay(1000);
      }
   }

});

module.exports = function provider (config, imports, provide) {
   if (!_.isString(config.zookeeperHost)) {
      throw new Error('config.zookeeperHost is required');
   }

   const log = imports.logger.child({ component: 'kafka' });
   log.info('Waiting (upto 10s) for Kafka to get ready');

   return setup(config, imports)
      .timeout(10000, 'Kafka client timed out [10s]')
      .tap(() => log.info('Kafka client is ready'))
      .nodeify(provide);
};
