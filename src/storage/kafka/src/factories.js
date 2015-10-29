'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const NodeKafka = require('kafka-node');

const types = require('./types');

exports.Client = t.typedFunc({
   inputs: [t.String],
   output: types.Kafka, // < Kafka >
   fn: function createClient ( zookeeperHost ) {
      const connectionString = `${zookeeperHost}/`;
      const name = 'log-api-kafka-client';
      return new NodeKafka.Client(connectionString, name);
   }
});

exports.Producer = t.typedFunc({
   inputs: [types, t.struct({})],
   output: types.Producer,
   fn: function producerFactory (client, opts) {
      return new NodeKafka.Producer(client, opts);
   }
});

exports.Consumer = t.typedFunc({
   inputs: [types, t.list(types.FetchRequest), t.Object],
   output: types.Consumer,
   fn: function consumerFactory (client, requests, opts) {
      return new NodeKafka.Consumer(client, requests, opts);
   }
});
