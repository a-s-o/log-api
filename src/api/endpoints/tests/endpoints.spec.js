'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

describe('api/endpoints', function () {
   require('./validator');
   require('./createLog');
   require('./createUser');
   require('./updateUser');
});
