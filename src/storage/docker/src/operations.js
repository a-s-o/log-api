'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const optional = t.maybe;
const StringArray = t.list(t.String, 'Array<String>');

const types = require('./types');

// Docker.containerInfo
// ---
// Gets an object with container information from docker
//
// Signature:
//    [client:Docker, name: String] -> Promise < Docker.Info >
//
// Throws:
//    Docker.ContainerNotFound - when no matching container is found

const containerInfo = exports.containerInfo = t.typedFunc({
   inputs: [types.Docker, t.String],
   output: t.Promise, // < Docker.Info >
   fn: function inspectContainer (docker, name) {
      return new Bluebird(function exec (resolve, reject) {
         const container = docker.getContainer(name);
         container.inspect(function callback (err, data) {
            if (err) {
               // Provide special error when container is not found
               if (err.statusCode === 404) {
                  return reject(new types.ContainerNotFound(name, err));
               }

               return reject(err);
            }

            return resolve( types.Info.create(data) );
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

exports.createContainer = t.typedFunc({
   inputs: [types.Docker, t.String, t.struct({
      Image: t.String,
      Cmd: optional(StringArray),
      HostConfig: optional(t.Object),
      Env: optional(StringArray)
   })],

   output: t.Promise, // < Docker.Info >

   fn: Bluebird.coroutine(function *createContainer (docker, name, options) {
      // Assume that if an existing container is re-created then
      // the new container replaces the existing one
      //
      // NOTE: normally there should be
      // a separate method for container removal
      const removed = Bluebird.defer();
      const existing = docker.getContainer(name);
      existing.stop(() => existing.remove(() => removed.resolve()));
      yield removed.promise;

      const deferred = Bluebird.defer();

      // Add container name to container options
      const args = _.extend({ name }, options);
      docker.createContainer(args, deferred.callback);
      yield deferred.promise;

      // Return container info once it is created
      return containerInfo(docker, name);
   })
});

// Docker.startContainer
// ---
// Starts a previously created container and returns inspection info

exports.startContainer = t.typedFunc({
   inputs: [t.Function, types.Docker, t.String],
   output: t.Promise, // < Docker.Info >
   fn: Bluebird.coroutine(function *startContainer (logFn, docker, name) {
      // If container is already running, just return the info
      const info = yield containerInfo(docker, name);
      if (info.State.Running === true) return info;

      // Otherwise, start the container
      const container = docker.getContainer(info.Id);
      const start = container.start.bind(container);
      yield start;

      // Re-fetch the info
      let newInfo = yield containerInfo(docker, name);

      // Wait infinitely until container starts
      while (!newInfo || newInfo.State.Running !== true) {
         logFn(`Container ${name} has not started. Retrying after 2s.`);
         yield Bluebird.delay(2000);
         yield start;
         newInfo = yield containerInfo(docker, name);
      }
   })
});
