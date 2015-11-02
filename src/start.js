'use strict';

const architect = require('@aso/architect');
const cfg = require('../config.js');

const providers = [
   // Main API
   { packagePath: './api', port: 3000 },

   // Event stores
   { packagePath: './log/events' },

   // Users
   { packagePath: './user/commands' },
   { packagePath: './user/collection', tableName: 'users' },
   { packagePath: './user/queries' },

   // Offset
   { packagePath: './storage/offset', topicName: 'users', tableName: 'users' },

   // Utils
   { packagePath: './utils/crypto' },
   { packagePath: './log/file-writer', filename: 'app.log' },
   { packagePath: './utils/logger', namespace: 'log-api', level: 'trace' },

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
      // Class for writing to and consuming from kafka logs
      packagePath: './storage/event-store'
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
const app = module.exports = architect.createApp( manifest );

app.once('error', (err) => {
   throw err;
});

app.on('ready', () => {
   const log = app.services.logger.child({ component: 'app' });
   const services = Object.keys(app.services).toString();
   const mode = process.env.NODE_ENV || 'development';
   log.info({ services }, `App Started in "${mode}" mode`);
});
