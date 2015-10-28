'use strict';

const path = require('path');

const cwd = process.cwd();
const volume = app => path.join(cwd, 'volumes', app);

const zookeeperPort = 2181;
const kafkaPort = 9092;
const pgPort = 5432;

// containerOpts should follow Docker remote API (1.2):
// docs.docker.com/reference/api/docker_remote_api_v1.20/#create-a-container

exports.docker = {
   socketPath: '/var/run/docker.sock'
};

exports.zookeeper = {
   port: zookeeperPort,

   containerName: 'log-api-zookeeper',
   containerOpts: {
      Image: 'medallia/zookeeper',
      Mounts: [{
         Source: volume('zookeeper'),
         Destination: '/opt/zookeeper'
      }],
      HostConfig: {
         PortBindings: {
            '2181/tcp': [{ HostPort: `${zookeeperPort}` }],
            '2888/tcp': [{ HostPort: `2888` }],
            '3888/tcp': [{ HostPort: `3888` }]
         }
      }
   }
};

exports.kafka = {
   port: kafkaPort,

   containerName: 'log-api-kafka',
   containerOpts: {
      Image: 'ches/kafka',
      Mounts: [{
         Source: volume('kafka/data'),
         Destination: '/data'
      }, {
         Source: volume('kafka/logs'),
         Destination: '/logs'
      }],
      HostConfig: {
         Links: [`log-api-zookeeper:zookeeper`],
         PortBindings: {
            '9092/tcp': [{ HostPort: `${kafkaPort}` }]
         }
      }
   }
};

exports.postgres = {
   port: pgPort,

   containerName: 'log-api-postgres',
   containerOpts: {
      Image: 'postgres',
      Mounts: [{
         Source: volume('postgres'),
         Destination: '/var/lib/postgresql/data'
      }],
      HostConfig: {
         Links: [`log-api-zookeeper:zookeeper`],
         PortBindings: {
            '5432/tcp': [{ HostPort: `${pgPort}` }]
         }
      }
   }
};
