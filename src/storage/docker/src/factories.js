'use strict';
const _ = require('lodash');
const t = require('@aso/tcomb');
const DockerClass = require('dockerode');

const types = require('./types');

exports.Client = t.typedFunc({
   inputs: [t.struct({ socketPath: t.String })],
   output: types.Docker,
   fn: function dockerFactory (opts) {
      return new DockerClass(opts);
   }
});
