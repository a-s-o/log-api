'use strict';

const architect = require('architect');
const cfg = require('../config.js');

console.log(`Running in ${ process.env.NODE_ENV || 'dev' } mode`);

const providers = [
   // Main API package
   { packagePath: './api' },

   // Users
   { packagePath: './user/commands', topicName: 'users' },
   { packagePath: './user/model', topicName: 'users', tableName: 'users' },
   { packagePath: './user/queries' },

   // Offset
   { packagePath: './storage/offset', topicName: 'users', tableName: 'users' },

   // Utils
   { packagePath: './utils/crypto' },
   { packagePath: './utils/logger', namespace: 'log-api' },

   // Storage / presistence services
   {
      packagePath: './storage/docker',
      socketPath: cfg.docker.socketPath
   },
   {
      packagePath: './storage/kafka',
      kafkaContainer: cfg.kafka.containerName,
      zookeeperContainer: cfg.zookeeper.containerName,
      zookeeperHost: `localhost:${cfg.zookeeper.port}`
   },
   {
      packagePath: './storage/sequelize',
      postgresContainer: cfg.postgres.containerName,
      dbname: cfg.postgres.dbname,
      username: cfg.postgres.username,
      password: cfg.postgres.password,
      port: cfg.postgres.port
   }

];

const manifest = architect.resolveConfig(providers, __dirname);
const app = architect.createApp( manifest );

app.on('error', (err) => {
   throw err;
});

app.on('ready', () => {
   console.log('ready', Object.keys(app.services));

   app.services.api.listen(3000, () => console.log('listening on 3000'));
});
