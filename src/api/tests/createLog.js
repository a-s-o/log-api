'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const sinon = require('sinon');

const logCreateStub = sinon.stub().returns(Promise.resolve('OK'));
const findByIdStub = sinon.stub().returns(Promise.resolve(null));

const endpoint = require('../endpoints/createLog.js');

describe('createLog', () => {
   let createLog;
   beforeEach(() => {
      createLog = endpoint({
         'log-events': { create: logCreateStub },
         'user-queries': { findById: findByIdStub }
      });

      logCreateStub.reset();
      findByIdStub.reset();
   });

   it('declares input requirements for "actionId" and "userId"', () => {
      createLog.inputs.should.have.a.property('actionId');
      createLog.inputs.should.have.a.property('userId');
   });

   it('sets the response on the body', function * () {
      const ctx = {};
      yield createLog.handler.call(ctx, { some: 'event' });
      ctx.body.should.be.exactly('OK');
   });

   it('calls createEvent with the supplied inputs', function * () {
      yield createLog.handler({ some: 'event' });
      logCreateStub.callCount.should.be.exactly(1);

      const arg = logCreateStub.getCall(0).args[0];
      arg.should.deepEqual({ some: 'event' });
   });

   it('calls findById when an userId is provided', function * () {
      let err;
      try {
         yield createLog.handler({ userId: 'anything' });
      } catch (ex) {
         err = ex;
      } finally {
         err.statusCode.should.be.exactly(400);
         findByIdStub.callCount.should.be.exactly(1);
         findByIdStub.getCall(0).args[0].should.be.exactly('anything');
      }
   });

});
