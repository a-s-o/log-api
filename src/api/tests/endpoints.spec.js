'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const provider = require('../endpoints/index.js');

describe('api/endpoints', function () {
   require('./validator');
   require('./createLog');
   require('./createUser');
   require('./updateUser');

   it('provides some required endpoints', () => {
      const imports = {};
      const log = {};
      const endpoints = provider(imports, log);
      endpoints.createLog.should.be.a.Function();
      endpoints.createUser.should.be.a.Function();
      endpoints.updateUser.should.be.a.Function();
   });

});
