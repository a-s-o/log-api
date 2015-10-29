'use strict';

module.exports = function sync (Kafka, Model, state, log) {
   const request = {
      topic: state.topic,
      offset: state.offset
   };

   const consumer = Kafka.createConsumer([request]);

   consumer.on('msg', (msg) => {
      console.log('KAFKA:', msg);
   });
};
