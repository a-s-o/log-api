'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const DockerClass = require('dockerode');

// Docker client
const Docker = t.irreducible('Docker', function isDocker (x) {
   return x instanceof DockerClass;
});

Docker.Docker = Docker;

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

module.exports = Docker;
