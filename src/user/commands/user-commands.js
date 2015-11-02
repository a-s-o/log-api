'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');

const types = require('./src/types');
const opsProvider = require('./src/operations');

module.exports = function provider (config, imports, provide) {
   const ops = opsProvider(config, imports);
   const User = types.User;

   // Add public methods
   User.create = ops.create;
   User.edit = ops.edit;

   return Bluebird.resolve({ 'user-commands': User }).nodeify(provide);
};
