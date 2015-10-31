'use strict';

const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const check = require('./checks');
const types = require('./types');

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
