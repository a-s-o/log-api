'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const Shell = require('shelljs');

const config = require('../config');
const dockerSetup = require('./docker');

module.exports = dockerSetup(config.docker, {})

   // Create containers for all services
   .then(provided => {
      const services = ['zookeeper', 'kafka', 'postgres'];
      const dockerCreate = _.partial(createContainer, provided.docker);
      return Bluebird.reduce(services, dockerCreate, {});
   })

   .then(function done (arg) {
      console.log( arg );
   });

/////////////
// Helpers //
/////////////

function createContainer (docker, result, name) {
   function pullImage (cfg) {
      return pull(cfg.containerOpts.Image);
   }

   function create (cfg) {
      console.log(`Creating docker container "${cfg.containerName}"`);
      return docker.createContainer(cfg.containerName, cfg.containerOpts);
   }

   return Bluebird.resolve(config[name])
      .tap(pullImage)
      .then(create)
      .then(function containerCreated (info) {
         result[name] = info.Id;
         return result;
      });
}

function pull (image) {
   process.stdout.write(`Pulling "${image}"...`);

   return new Bluebird(function exec (resolve, reject) {
      const child = Shell.exec(`docker pull ${image}`, {
         silent: true,
         async: true
      });
      child.stdout.on('data', () => {
         process.stdout.write('.');
      });

      child.stderr.on('data', (err) => {
         console.error(err);
         reject(err);
      });

      child.stdout.on('end', () => {
         process.stdout.write(`done\n`);
         resolve();
      });
   });
}
