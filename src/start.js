'use strict';

const architect = require('architect');
const cfg = require('../config.js');

const providers = [
   {
      packagePath: './docker',
      socketPath: cfg.docker.socketPath
   },
   {
      packagePath: './kafka',
      kafkaContainer: cfg.kafka.containerName,
      zookeeperContainer: cfg.zookeeper.containerName,
      zookeeperHost: `localhost:${cfg.zookeeper.port}`
   },
   {
      packagePath: './logger',
      namespace: 'log-api'
   },
   {
      packagePath: './sequelize',
      postgresContainer: cfg.postgres.containerName,
      username: cfg.postgres.username,
      password: cfg.postgres.password,
      port: cfg.postgres.port
   },

   // { packagePath: './api', port: 5000 }
];

const manifest = architect.resolveConfig(providers, __dirname);
const app = architect.createApp( manifest );

app.on('error', (err) => {
   throw err;
});

app.on('ready', () => {
   console.log('ready', Object.keys(app.services));
   const kafka = app.services.kafka;

   const consumer = kafka.createConsumer([
      { topic: 'test', offset: 0 }
   ], {
      fromOffset: true
   });

   consumer.on('message', msg => console.log('READ:', msg));

   kafka.sendMessage({
      topic: 'test',
      partition: 0,
      messages: [
         { eventType: 'random', eventTime: Date.now() }
      ]
   });

});
