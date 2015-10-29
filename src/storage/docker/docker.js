'use strict';

// Purpose:
// - Provides an interface for dealing with docker
// - Prevents app from running if docker cannot be accessed
//   or installed version is incompatible (requires docker API 1.x)

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const shell = Bluebird.promisifyAll(require('shelljs'));

const optional = t.maybe;
const StringArray = t.list(t.String, 'Array<String>');

// Docker client
const DockerClass = require('dockerode');

///////////
// Types //
///////////

// Docker client
const Docker = t.irreducible('Docker', function isDocker (x) {
   return x instanceof DockerClass;
});

// Info returned from createContainer, containerInfo, etc.
// Any object with an id, for now but we can later enforce more requirements
Docker.Info = t.subtype(t.Object, obj => _.isString(obj.Id), 'Docker.Info');

Docker.Info.create = t.typedFunc({
   inputs: [t.Object],
   output: Docker.Info,
   fn: _.identity
});

////////////////
// Public API //
////////////////

// Special errors

// ContainerNotFound
// Thrown when a container cannot be found by name/id
Docker.ContainerNotFound = class ContainerNotFound extends Error {
   constructor (name, data) {
      super();
      Error.captureStackTrace(this, this.constructor);
      this.name = `DockerContainerNotFound`;
      this.status = this.statusCode = 404;
      this.message = `Docker container "${name}" was not found`;
      this.data = data;
      this.expose = false;
   }
};

// Public methods

// Docker.containerInfo
// ---
// Gets an object with container information from docker
//
// Signature:
//    [client:Docker, name: String] -> Promise < Docker.Info >
//
// Throws:
//    Docker.ContainerNotFound - when no matching container is found

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
                  return reject(new Docker.ContainerNotFound(name, err));
               }

               return reject(err);
            }

            return resolve( Docker.Info.create(data) );
         });
      });
   }
});

// Docker.createContainer
// ---
// Creates a new container with supplied options. Options must an
// object in accordance with Docker remote api 1.x
//
// (see https://docs.docker.com/reference/api/docker_remote_api_v1.20
//    /#create-a-container)
//
// Signature:
//    [client:Docker, name:String, options:Object] -> Promise < Docker.Info >

const createContainer = t.typedFunc({
   inputs: [Docker, t.String, t.struct({
      Image: t.String,
      Cmd: optional(StringArray),
      HostConfig: optional(t.Object),
      Env: optional(StringArray)
   })],

   output: t.Promise, // < Docker.Info >

   fn: function createContainer (docker, name, options) {
      // Assume that if an existing container is re-created then
      // the new container replaces the existing one
      //
      // NOTE: don't do this in production; there should be
      // a separate method for container removal
      const removed = Bluebird.defer();
      const existing = docker.getContainer(name);
      existing.stop(() => existing.remove(() => removed.resolve()));

      return removed.promise
         .then(function createIt () {
            const deferred = Bluebird.defer();

            // Add contianer name to container options
            const args = _.extend({ name }, options);
            docker.createContainer(args, deferred.callback);

            // Return container info once it is created
            return deferred.promise.then(() => containerInfo(docker, name));
         });
   }
});

const startContainer = t.typedFunc({
   inputs: [Docker, t.String],
   output: t.Promise, // < Docker.Info >
   fn: function startContainer (docker, name) {
      return containerInfo(docker, name)
         .then(function startIt (info) {
            // If container is already running, just return the info
            if (info.State.Running === true) return info;

            // Otherwise, start the container and re-fetch the info
            const container = docker.getContainer(info.Id);
            const started = Bluebird.defer();
            container.start(started.callback);
            return started.promise.then(() => containerInfo(docker, name));
         });
   }
});

///////////////
// Internals //
///////////////

Docker.create = t.typedFunc({
   inputs: [t.struct({ socketPath: t.String })],
   output: Docker,
   fn: function dockerFactory (opts) {
      return new DockerClass(opts);
   }
});

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


module.exports = function setup (config, imports, provide) {

   function createClient () {
      // Create a client and partially bind to all public methods as
      // app only supports communicating with one local docker instance
      const client = Docker.create({ socketPath: config.socketPath });
      Docker.containerInfo = _.partial(containerInfo);
      Docker.createContainer = _.partial(createContainer, client);
      Docker.startContainer = _.partial(startContainer, client);

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
