'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const shell = Bluebird.promisifyAll(require('shelljs'));

// Docker client
const DockerClass = require('dockerode');

// Public API
const Docker = t.irreducible('Docker', function isDocker (x) {
   return x instanceof DockerClass;
});

Docker.create = t.typedFunc({
   inputs: [t.Object],
   output: Docker,
   fn: function dockerFactory (opts) {
      return new DockerClass(opts);
   }
});

Docker.Info = t.struct({

});

// Export some

Docker.ContainerNotFound = class ContainerNotFound extends Error {
   constructor () {
      super();
      Error.captureStackTrace(this, this.constructor);
      this.name = 'DockerContainerNotFound';
      this.code = 404;
   }
};

// Public methods

const containerInfo = t.typedFunc({
   inputs: [Docker, t.String],
   output: t.Promise, // < Docker.Info >
   fn: function inspectContainer (docker, name) {
      return new Bluebird(function exec (resolve, reject) {
         const container = docker.getContainer(name);
         container.inspect(function callback (err, data) {
            if (err) {
               // Provide special error when container is not found
               if (err.statusCode === 404) {
                  return reject(new Docker.ContainerNotFound(err));
               }

               return reject(err);
            }

            return resolve(new Docker.Info(data));
         });
      });
   }
});

const createContainer = t.typedFunc({
   inputs: [Docker, t.String, t.Object],
   output: t.Promise, // < Docker.Info >
   fn: function createContainer (docker, name, options) {
      // Create a docker container then return
      // information about it. This is called
      // only when a container does not exist (404)
      function create () {
         console.log('here');
      }

      // Get the contianer info; if it exists, do nothing
      return Docker.containerInfo(docker, name)
         .catch(Docker.ContainerNotFound, create);
   }
});

// Internals

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


module.exports = function setup (options, imports, provide) {

   function createClient () {
      // Create a client and partially bind to all public methods as
      // app only supports communicating with one local docker instance
      const client = Docker.create(options);
      Docker.containerInfo = _.partial(containerInfo, client);
      Docker.createContainer = _.partial(createContainer, client);

      // Provide the docker service to the app
      return { docker: Docker };
   }

   // This app needs a connection to docker; therefore
   // ensure connectivity before providing the docker
   // client to the app
   return checkConnectivity()
      .then(createClient)
      .nodeify(provide);

};
