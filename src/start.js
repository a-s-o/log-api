'use strict';

const architect = require('architect');
const cfg = require('../config.js');

const providers = [
   // Main API package
   { packagePath: './api' },

   // Users
   // { packagePath: './user/commands', topicName: 'users' },
   // { packagePath: './user/model', topicName: 'users', tableName: 'users' },
   // { packagePath: './user/queries' },
   { packagePath: './user/events' },
   { packagePath: './log/events' },

   // { packagePath: './log', tableName: 'logs', topicName: 'logs' },

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
const app = architect.createApp( manifest );

app.once('error', (err) => {
   throw err;
});

app.on('ready', () => {
   const log = app.services.logger.child({ component: 'app' });
   const mode = process.env.NODE_ENV || 'dev';
   const services = Object.keys(app.services).toString();
   log.info({ services }, `App Started in "${mode}" mode`);
   app.services.api.listen(3000, () => log.info('Listening on 3000'));

   const logEvents = app.services['log-events'];
   logEvents
      .asEventStream(0, { fromOffset: true })
      .log('logEvents');
});
