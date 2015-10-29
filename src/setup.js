'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');
const Shell = require('shelljs');
const path = require('path');

const config = require('../config');
const dockerProvider = require('./docker');

// Create directories syncronously
Shell.mkdir(config.zookeeper.dataDir);
Shell.mkdir(config.zookeeper.configDir);
Shell.mkdir(config.kafka.dataDir);
Shell.mkdir(path.join(config.kafka.dataDir, 'data'));
Shell.mkdir(path.join(config.kafka.dataDir, 'logs'));
Shell.mkdir(config.postgres.dataDir);

// Execute async setup (return promise for ease of use)
module.exports = getDocker()
   .then(createContainers)
   .then(logContainerIDs);

function getDocker () {
   return dockerProvider(config.docker, {}).then(provided => provided.docker);
}

function createContainers (docker) {
   const dockerCreate = _.partial(createContainer, docker);
   const services = ['zookeeper', 'kafka', 'postgres'];
   return Bluebird.reduce(services, dockerCreate, {});
}

function logContainerIDs (containers) {
   return _.mapValues(containers, 'Id');
}

function createContainer (docker, result, name) {
   function create (cfg) {
      console.log(`Creating docker container "${cfg.containerName}"`);
      return docker.createContainer(cfg.containerName, cfg.containerOpts);
   }

   return Bluebird.resolve(config[name])
      // TODO: enable pull image
      .tap(pullImage)
      .then(create)
      .then(function containerCreated (info) {
         result[name] = info;
         return result;
      });
}

function pullImage (cfg) {
   const image = cfg.containerOpts.Image;

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
