'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const assert = require('assert');
const sinon = require('sinon');

const imports = {
   'log-events': { create: sinon.spy() },
   'user-queries': { findById: sinon.spy() }
};

const createLog = require('../createLog.js')(imports);

describe('createLog', () => {
   it('should be tested');
});
