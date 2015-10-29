'use strict';

const Bluebird = require('@aso/bluebird');

const factories = require('./src/factories');
const types = require('./src/types');
const operations = require('./src/operations');

const setup = Bluebird.coroutine(function *setup (config, imports) {
   const docker = imports.docker;

   // Start the necessary docker containers
   yield docker.startContainer( config.zookeeperContainer );
   yield docker.startContainer( config.kafkaContainer );

   // Create client and wait for it to be ready
   const log = imports.logger.child({ component: 'kafka' });
   const client = factories.Client( config.zookeeperHost );
   yield operations.waitForConnection(client, log);

   const Kafka = types.Kafka;
   const Consumer = factories.Consumer;
   const Producer = factories.Producer;

   // Client is singleton so partially apply it to Consumer factory
   Kafka.createConsumer = (req, opts) => Consumer(client, req, opts || {});

   // All producers are created equal
   Kafka.createProducer = () => Producer(client,  {
      requireAcks: 1,
      ackTimeoutMs: 500
   });

   // Add more public operations to the kafka service
   Kafka.sendMessage = operations.sendMessage;
   Kafka.createTopic = operations.createTopic;

   return { kafka: Kafka };
});

module.exports = function provider (config, imports, provide) {
   return setup(config, imports).nodeify(provide);
};
