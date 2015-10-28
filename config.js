'use strict';

const path = require('path');

const cwd = process.cwd();
const volumeDir = dir => path.join(cwd, 'volumes', dir);
const configDir = dir => path.join(cwd, 'conf', dir);

// containerOpts should follow Docker remote API (1.2):
// docs.docker.com/reference/api/docker_remote_api_v1.20/#create-a-container

exports.docker = {
   socketPath: '/var/run/docker.sock'
};

///////////////
// Zookeeper //
///////////////

const zookeeper = exports.zookeeper = {
   containerName: 'log-api-zookeeper',
   port: 2181,
   dataDir: volumeDir('zookeeper'),
   configDir: configDir('')
};

zookeeper.containerOpts = {
   Image: 'medallia/zookeeper',
   Cmd: ['start-foreground', '/etc/conf/zookeeper.cfg'],
   HostConfig: {
      Binds: [
         `${zookeeper.dataDir}:/opt/zookeeper`,
         `${zookeeper.configDir}:/etc/conf`
      ],
      PortBindings: {
         '2181/tcp': [{ HostPort: `${zookeeper.port}` }],
         '2888/tcp': [{ HostPort: `2888` }],
         '3888/tcp': [{ HostPort: `3888` }]
      }
   }
};

///////////
// Kafka //
///////////

const kafka = exports.kafka = {
   containerName: 'log-api-kafka',
   port: 9092,
   dataDir: volumeDir('kafka')
};

kafka.containerOpts = {
   Image: 'ches/kafka',
   HostConfig: {
      Links: [`log-api-zookeeper:zookeeper`],
      Binds: [
         `${path.join(kafka.dataDir, 'data')}:/data`,
         `${path.join(kafka.dataDir, 'logs')}:/logs`
      ],
      PortBindings: {
         '9092/tcp': [{ HostPort: `${kafka.port}` }]
      }
   }
};

//////////////
// Postgres //
//////////////

const postgres = exports.postgres = {
   containerName: 'log-api-postgres',
   port: 5432,
   dataDir: volumeDir('postgres'),
   username: process.env.POSTGRES_USER || 'logsss',
   password: process.env.POSTGRES_PASSWORD || 'logsss'
};

postgres.containerOpts = {
   Image: 'postgres',
   HostConfig: {
      Binds: [
         `${postgres.dataDir}:/var/lib/postgresql/data`
      ],
      PortBindings: {
         '5432/tcp': [{ HostPort: `${postgres.port}` }]
      }
   },
   Env: [
      `POSTGRES_USER=${postgres.username}`,
      `POSTGRES_PASSWORD=${postgres.username}`
   ]
};
