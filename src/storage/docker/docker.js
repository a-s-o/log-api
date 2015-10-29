'use strict';

// Purpose:
// - Provides an interface for dealing with docker
// - Prevents app from running if docker cannot be accessed
//   or installed version is incompatible (requires docker API 1.x)

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');
const shell = Bluebird.promisifyAll(require('shelljs'));

const types = require('./src/types');
const ops = require('./src/operations');
const factories = require('./src/factories');

const checkConnectivity = Bluebird.coroutine(function *check () {
   // Get docker version info in JSON format
   const version = `docker version --format '{{json .}}'`;
   const data = yield shell.execAsync(version, { silent: true });
   const parsed = JSON.parse(data);

   // Check that the docker client has correct api
   const apiVersion = parsed.Client.ApiVersion;
   if (!_.startsWith(apiVersion, '1')) {
      throw new Error('Docker client api ${apiVersion} is not supported');
   }

   // Check that the docker server is reachable from the client (if remote)
   if (!parsed.ServerOK) {
      throw new Error('docker client cannot reach the docker server');
   }
});

const setup = Bluebird.coroutine(function *setup (config) {
   yield checkConnectivity();

   const Docker = types.Docker;

   // Partially apply the docker client to all public methods
   const client = factories.Client({ socketPath: config.socketPath });
   Docker.containerInfo = _.partial(ops.containerInfo, client);
   Docker.createContainer = _.partial(ops.createContainer, client);
   Docker.startContainer = _.partial(ops.startContainer, client);

   return { docker: Docker };
});

module.exports = function provider (config, imports, provide) {
   if (typeof config.socketPath !== 'string') {
      throw new Error('config.socketPath must be a string');
   }
   return setup(config, imports).nodeify(provide);
};
