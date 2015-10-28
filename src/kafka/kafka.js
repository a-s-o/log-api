'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const NodeKafka = require('kafka-node');
const instanceOf = klass => x => x instanceof klass;

///////////
// Types //
///////////

const Kafka = t.irreducible('Kafka', instanceOf(NodeKafka.Client));
Kafka.Producer = t.irreducible('KafkaProducer', instanceOf(NodeKafka.Producer));
Kafka.Consumer = t.irreducible('KafkaConsumer', instanceOf(NodeKafka.Consumer));

Kafka.FetchRequest = t.struct({
   topic: t.String,
   offset: t.Number
}, 'KafkaFetchRequest');

////////////
// Public //
////////////

const createProducer = t.typedFunc({
   inputs: [Kafka, t.struct({})],
   output: Kafka.Producer,
   fn: function producerFactory (client, opts) {
      return new NodeKafka.Producer(client, opts);
   }
});

const createConsumer = t.typedFunc({
   inputs: [Kafka, t.list(Kafka.FetchRequest), t.Object],
   output: Kafka.Producer,
   fn: function producerFactory (client, requests, opts) {
      return new NodeKafka.Consumer(client, requests, opts);
   }
});

//////////////
// Internal //
//////////////

function createClient ( zookeeperHost ) {
   // Create a client (singleton)
   // [connectionString:String, clientID:String]
   const client = new NodeKafka.Client(`${zookeeperHost}/`, 'log-api-kafka-client');

   // Make opts optional and pre-bind client instance to factories
   Kafka.createProducer = (opts) => createProducer(client, opts || {});
   Kafka.createConsumer = (req, opts) => createConsumer(client, req, opts || {});

   // Provide the kafka service
   return { kafka: Kafka };
}

module.exports = function provider (config, imports, provide) {
   const docker = imports.docker;

   return docker.startContainer( config.zookeeperContainer )
      .then(() => docker.startContainer( config.kafkaContainer ))
      .then(() => createClient( config.zookeeperHost ))
      .nodeify(provide);
};
