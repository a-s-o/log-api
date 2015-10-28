'use strict';

exports.docker = {
   socketPath: '/var/run/docker.sock'
};

exports.kafka = {
   containerName: 'log-api-kafka'
};

exports.postgres = {
   containerName: 'log-api-postgres'
};
