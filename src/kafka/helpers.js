'use strict';

function producerOnReady (producer, callback) {
   if (producer.ready) {
      callback();
   } else {
      producer.on('ready', callback);
   }
}

function hasBrokers (client) {
   return Object.keys(client.brokers).length > 0;
}

function brokerOnReady (client, callback) {
   if (hasBrokers(client)) {
      callback();
   } else {
      client.on('brokersChanged', callback);
   }
}

function clientOnReady (client, callback) {
   if (client.ready === true && hasBrokers(client)) {
      return callback();
   }

   if (!client.ready) {
      client.connect();
      client.on('ready', () => brokerOnReady(client, callback));
   } else {
      brokerOnReady(client, callback);
   }
}

module.exports = {
   producer: {
      onReady: producerOnReady
   },
   client: {
      onReady: clientOnReady
   }
};