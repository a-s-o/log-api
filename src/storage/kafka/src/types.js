'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const NodeKafka = require('kafka-node');
const instanceOf = klass => x => x instanceof klass;

const validTopics = ['logs', 'users', 'test'];

///////////
// Types //
///////////

const Kafka = t.irreducible('Kafka', instanceOf(NodeKafka.Client));
Kafka.Kafka = Kafka;
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

module.exports = Kafka;
