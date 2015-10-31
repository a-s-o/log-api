'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const check = require('./checks');
const types = require('./types');

// Creates a temporary client, producer and topic and waits for all
// operations to complete before resolving. Errors occurring during the
// timeout period will not be rejected.
//
// timeout is in seconds (not ms)

exports.awaitConnection = Bluebird.coroutine(function *wait (Kafka, log, timeout) {
   let clientReady = false;
   let producerReady = false;
   let topicCreated = false;
   let tempClient;
   let tempProducer;

   const time = Date.now() + (timeout * 1000);

   while (!clientReady || !topicCreated) {
      if (time < Date.now()) {
         const state = JSON.stringify({ clientReady, producerReady, topicCreated });
         throw new Error(`Kafka client timed out [${timeout}s] ${state}`);
      }

      try {
         if (!clientReady) {
            // Create client and wait for it to be ready
            tempClient = Kafka.createClient('log-api-init');
            yield _.partial(check.client.onReady, tempClient);
            clientReady = true;
         }

         if (!producerReady) {
            tempProducer = Kafka.createProducer(tempClient);
            yield _.partial(check.producer.onReady, tempProducer);
            producerReady = true;
         }

         if (!topicCreated) {
            yield Kafka.createTopic(tempProducer, 'test');
            topicCreated = true;
         }

         yield _.bind(tempClient.close, tempClient);
      } catch (ex) {
         if (time < Date.now()) throw ex;
         yield Bluebird.delay(1000);
      }
   }
});

exports.createTopic = t.typedFunc({
   inputs: [types.Producer, t.String],
   output: t.Promise,  // < Response:String >
   fn: function createTopic (producer, topicName) {
      return new Bluebird(function wait (resolve, reject) {
         check.producer.onReady(producer, () => {
            // Second argument is async; async=false ensures the topic
            // is created before this method returns
            producer.createTopics([topicName], false, (err, resp) => {
               if (err) reject(err);
               else resolve(resp);
            });
         });
      });
   }
});

exports.sendMessage = t.typedFunc({
   inputs: [types.Producer, types.ProduceRequest],
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
         check.producer.onReady(producer, () => producer.send([message], done));
      }

      const messageCreated = new Bluebird(sent);
      return messageCreated.timeout(1000);
   }
});

function serializeMessage (msg) {
   try {
      return JSON.stringify(msg);
   } catch (ex) {
      throw new types.UnableToSerialize(msg);
   }
}
