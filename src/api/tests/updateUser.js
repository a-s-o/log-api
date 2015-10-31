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
const userEditStub = sinon.stub().returns(Promise.resolve(fakeUser));

const endpoint = require('../endpoints/updateUser.js');

describe('updateUser', () => {
   let updateUser;
   beforeEach(() => {
      updateUser = endpoint({
         'log-events': { create: logCreateStub },
         'user-commands': { edit: userEditStub }
      });

      logCreateStub.reset();
      userEditStub.reset();
   });

   it('declares input requirements for "email", "name" and "password"', () => {
      updateUser.inputs.should.have.a.property('name');
      updateUser.inputs.should.have.a.property('password');
   });

   it('calls user-commands.edit() with id, email and password', function * () {
      yield updateUser.handler({ name: 'new name', password: 'pass' }, 345);
      userEditStub.callCount.should.be.exactly(1);

      const callToEdit = userEditStub.getCall(0);
      callToEdit.args[0].should.be.exactly(345);
      callToEdit.args[1].should.be.an.Object();
      callToEdit.args[1].should.be.have.a.property('name', 'new name');
      callToEdit.args[1].should.be.have.a.property('password', 'pass');
   });

   it('does not pass email to user-commands.edit()', function * () {
      yield updateUser.handler({ email: 'new@email.com' }, 345);
      userEditStub.callCount.should.be.exactly(1);

      const callToEdit = userEditStub.getCall(0);
      callToEdit.args[0].should.be.exactly(345);
      callToEdit.args[1].should.be.an.Object();
      callToEdit.args[1].should.not.have.a.property('email');
   });

   it('creates a USER_EDIT_PROFILE log event', function * () {
      yield updateUser.handler({ name: 'new name', password: 'plaintext' });
      logCreateStub.callCount.should.be.exactly(1);

      const arg = logCreateStub.getCall(0).args[0];
      arg.should.have.a.property('actionId', 'USER_EDIT_PROFILE');
      arg.should.have.a.property('userId', fakeUser.id);
      arg.data.should.have.a.property('name', 'new name');


   });

   it('log event should not have plaintext password', function * () {
      yield updateUser.handler({ name: 'new name', password: 'plaintext' });
      logCreateStub.callCount.should.be.exactly(1);

      const password = logCreateStub.getCall(0).args[0].data.password;
      password.should.not.equal('plaintext');
      password.should.be.an.Object();
      password.should.have.a.property('key', fakeUser.password.key);
   });


   // it('sets the response on the body', function * () {
   //    const ctx = {};
   //    yield updateUser.handler.call(ctx);
   //    ctx.body.should.be.an.Object();
   // });

});
