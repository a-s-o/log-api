'use strict';
/* eslint func-names: 0 */
require('co-mocha');
const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const sinon = require('sinon');

const fakeEncryptedKey = {
   key: 'hashed.key.toString(encoding)',
   salt: 'hashed.salt.toString(encoding)',
   iterations: 6554646546
};

const promisifiedStub = val => sinon.stub().returns( Bluebird.resolve(val) );

const hasher = promisifiedStub(fakeEncryptedKey);
const provider = require('../src/operations');

// Helper for geting the result of opeartions provider fn with some
// provided mocks in place
function loadOperations (queries) {
   return provider({ /* config */ }, { hasher, 'user-queries': queries });
}

const fish = Bluebird.coroutine(function * (it) {
   try { yield it; } catch (ex) { return ex; }
   throw new Error('Expected to catch an error but no fish!');
});

////////////
// Create //
////////////

describe('.create()', () => {
   // Mock some data (only type-checking here, so empty strings should pass)
   const fakeEmail = 'some@fake.email';
   const fakeName = 'Mr. False';
   const fakeUser = { email: fakeEmail, name: fakeName, password: '' };

   it('throws conflict if user exists [409]', function * () {
      const ops = loadOperations({ count: promisifiedStub(1) });
      const ex = yield fish(ops.create(fakeUser));
      ex.statusCode.should.equal(409);
   });

   it('creates a user if no conflicts', function * () {
      const ops = loadOperations({ count: promisifiedStub(0) });
      const resp = yield ops.create(fakeUser);

      resp.id.should.be.a.String();
      resp.email.should.equal(fakeEmail);
      resp.name.should.equal(fakeName);
      resp.password.should.deepEqual(fakeEncryptedKey);
   });

   it('rejects bad requests', function () {
      const ops = loadOperations();
      const missing = prop => _.partial(ops.create, _.omit(fakeUser, prop));
      missing('email').should.throw(TypeError);
      missing('password').should.throw(TypeError);
      missing('name').should.throw(TypeError);
   });

});

//////////
// Edit //
//////////

describe('.edit()', () => {
   const fakeId = '123123';
   const fakeName = 'Mr. True';
   const fakePassword = `Mr. True's password`;

   const findByIdStub = promisifiedStub({
      toJSON: () => ({
         id: fakeId,
         email: 'original@email.com',
         name: 'old_name',
         password: { key: 'gets_replaced' }
      })
   });

   it('updates existing user name and password', function * () {
      findByIdStub.reset();

      const ops = loadOperations({ findById: findByIdStub });
      const result = yield ops.edit(fakeId, {
         name: fakeName,
         password: fakePassword
      });

      findByIdStub.callCount.should.equal(1);

      // Updates the name and password
      result.name.should.equal(fakeName);
      result.password.should.deepEqual(fakeEncryptedKey);
   });

   it(`does not update existing user's email and id`, function * () {
      findByIdStub.reset();

      const ops = loadOperations({ findById: findByIdStub });
      const result = yield ops.edit(fakeId, {
         password: fakePassword,
         email: 'never@change.this'
      });

      findByIdStub.callCount.should.equal(1);

      result.id.should.equal(fakeId);
      result.email.should.equal('original@email.com');
   });

   it('throws if user does not exist [404]', function * () {
      const ops = loadOperations({ findById: promisifiedStub(null) });

      const ex = yield fish(ops.edit(fakeId, {
         name: fakeName,
         password: fakePassword
      }));

      ex.statusCode.should.equal(404);
   });

   it('forgetting the id should throw [TypeError]', function () {
      const fakeUpdate = { name: fakeName, password: fakePassword };
      _.partial(loadOperations().edit, fakeUpdate).should.throw(TypeError);
   });

   it('forgetting the update should throw [TypeError]', function () {
      _.partial(loadOperations().edit, fakeId).should.throw(TypeError);
   });
});
