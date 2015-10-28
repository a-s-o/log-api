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

   // cfg.postgres,

   // { packagePath: './api', port: 5000 }
];

const manifest = architect.resolveConfig(providers, __dirname);
const app = architect.createApp( manifest );

app.on('error', (err) => {
   throw err;
});

app.on('ready', () => {
   console.log('ready', app.services.kafka);
});
