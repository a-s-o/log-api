'use strict';

const Bluebird = require('@aso/bluebird');

module.exports = Bluebird.coroutine(function *setup (config, imports) {
   const Docker = imports.docker;

   const info = yield Docker
      .containerInfo(config.containerName)
      .catch(Docker.ContainerNotFound, function () {
         console.log('it is all going according to plan');
      });
   console.log(info);
});
