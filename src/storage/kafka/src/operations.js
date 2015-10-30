'use strict';

const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const check = require('./checks');
const types = require('./types');

exports.waitForConnection = t.typedFunc({
   inputs: [types.Kafka, t.Any],
   output: t.Promise, // < Kafka >
   fn: function waitForConnection (client, log) {
      const clientReady = new Bluebird(function clientReady (resolve) {
         // Just log all errors; this promise will reject based on timeout
         client.on('error', (err) => {
            if (err) log.error({ err });
         });
         check.client.onReady(client, () => resolve(client));
      });

      log.info('Waiting (upto 10s) for kafka to get ready');

      return clientReady
         .timeout(10000, 'kafka client timed out [10s]')
         .tap(() => log.info('kafka client is ready'));
   }
});

exports.createTopic = t.typedFunc({
   inputs: [types.Producer, t.String],
   output: t.Promise,  // < Response:String >
   fn: function createTopic (producer, topicName) {
      const created = new Bluebird(function wait (resolve, reject) {
         check.producer.onReady(producer, () => {
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
