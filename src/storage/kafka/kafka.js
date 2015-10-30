'use strict';

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

   // Create client and wait for it to be ready
   const tempClient = Kafka.createClient('log-api-start');
   yield operations.waitForConnection(tempClient, log);
   yield tempClient.close.bind(tempClient);

   return { kafka: Kafka };
});

module.exports = function provider (config, imports, provide) {
   return setup(config, imports).nodeify(provide);
};
