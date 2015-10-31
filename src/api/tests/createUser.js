'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const sinon = require('sinon');

const fakeUser = {
   id: 123,
   email: 'some@email.com',
   name: 'mock it',
   password: { key: 'MOCK_KEY' },
   another: 'property'
};

const logCreateStub = sinon.stub().returns(Promise.resolve('OK'));
const userCreateStub = sinon.stub().returns(Promise.resolve(fakeUser));

const endpoint = require('../endpoints/createUser.js');

describe('createUser', () => {
   let createUser;
   beforeEach(() => {
      createUser = endpoint({
         'log-events': { create: logCreateStub },
         'user-commands': { create: userCreateStub }
      });

      logCreateStub.reset();
      userCreateStub.reset();
   });

   it('declares input requirements for "email", "name" and "password"', () => {
      createUser.inputs.should.have.a.property('email');
      createUser.inputs.should.have.a.property('name');
      createUser.inputs.should.have.a.property('password');
   });

   it('calls user-commands.create() with inputs', function * () {
      yield createUser.handler(fakeUser);
      userCreateStub.callCount.should.be.exactly(1);

      const arg = userCreateStub.getCall(0).args[0];
      arg.should.be.have.a.property('name', fakeUser.name);
      arg.should.be.have.a.property('password', fakeUser.password);
      arg.should.be.have.a.property('email', fakeUser.email);
   });

   it('creates a USER_SIGNUP event', function * () {
      yield createUser.handler();
      logCreateStub.callCount.should.be.exactly(1);

      const arg = logCreateStub.getCall(0).args[0];
      arg.should.have.a.property('actionId', 'USER_SIGNUP');
      arg.should.have.a.property('userId', fakeUser.id);
      arg.data.should.have.a.property('name', fakeUser.name);
      arg.data.should.have.a.property('password', fakeUser.password);
      arg.data.should.not.have.a.property('id');
   });

   it('sets the response on the body', function * () {
      const ctx = {};
      yield createUser.handler.call(ctx);
      ctx.body.should.be.an.Object();
   });

   it('removes password from the response', function * () {
      const ctx = {};
      yield createUser.handler.call(ctx);
      ctx.body.should.have.a.property('email', fakeUser.email);
      ctx.body.should.not.have.a.property('password');
   });

});
