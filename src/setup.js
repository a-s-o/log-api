'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const cfg = require('../config');
const dockerSetup = require('./docker');
const kafkaSetup = require('./kafka/setup');
// const postgresSetup = require('./postgres/setup');

module.exports = dockerSetup(cfg.docker, {})
   .then(dockerProvides => {
      const docker = dockerProvides.docker;
      return Bluebird.all([
         kafkaSetup(cfg.kafka, { docker })
      ]);
   });
