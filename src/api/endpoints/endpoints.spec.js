'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

describe('api/endpoints', function () {
   require('./tests/validator');
   require('./tests/createLog');
   require('./tests/createUser');
   require('./tests/updateUser');
});
