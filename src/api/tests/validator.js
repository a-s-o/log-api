'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const _ = require('lodash');
const joi = require('joi');
const sinon = require('sinon');
const Bluebird = require('@aso/bluebird');
const createError = require('http-errors');

const validator = require('../endpoints/validator.js');

const imports = {};
const log = { error: sinon.spy() };

// Test helpers

function createContext (obj) {
   return _.defaults(obj || {}, {
      'request': {},
      'throw': (err) => { throw err; }
   });
}

function throwInsideHandler (ex) {
   const wrapped = validator(imports, log, () => ({
      *handler () { throw ex; }
   }));
   return wrapped.call(createContext());
}


const fish = Bluebird.coroutine(function * (it) {
   try { yield it; } catch (ex) { return ex; }
   throw new Error('Expected to catch an error but no fish!');
});

// Tests

describe('validator', () => {
   let wrapped, ctx, args;
   beforeEach(() => {
      args = null;
      wrapped = validator(imports, log, () => ({
         inputs: {
            number: joi.number().required(),
            email: joi.string().email()
         },
         *handler () {
            args = _.toArray(arguments);
            this.body = 'MOCK';
         }
      }));
      ctx = createContext();
   });

   it('should return a wrapped generator', () => {
      function *Generator () {}
      wrapped.should
         .be.instanceOf(Generator.constructor)
         .and.a.Function();
   });

   it('calls the endpoint handler when valid inputs', function * () {
      ctx.request.body = { number: 125, email: 'test@example.com' };
      yield* wrapped.call(ctx);
      ctx.body.should.be.exactly('MOCK');
   });

   it('throws on invalid outputs [400]', function * () {
      ctx.request.body = { number: 123, email: 'test' };
      const ex = yield fish( wrapped.call(ctx) );
      ex.should.equal(400);
   });

   it('provides converted values to the endpoint handler', function * () {
      // Number is being provided as a string; it should be casted
      ctx.request.body = { number: '123', email: 'test@example.com' };
      yield* wrapped.call(ctx);
      args[0].number.should.be.exactly(123);
   });

   it('strips extra properties', function * () {
      // Number is being provided as a string; it should be converted
      ctx.request.body = { number: '123', unnecessary: 'prop' };
      yield* wrapped.call(ctx);
      args[0].should.deepEqual({ number: 123 });
   });

   it('passes any additional arguments to the handler', function * () {
      ctx.request.body = { number: 123 };
      yield* wrapped.call(ctx, 'some-id', 'another-param');
      args[1].should.be.exactly('some-id');
      args[2].should.be.exactly('another-param');
   });

   it('catches client errors thrown in handler [< 500]', function * () {
      const error400 = createError(400);
      const ex400 = yield fish( throwInsideHandler(createError(error400)) );
      ex400.should.be.exactly(error400);
      ex400.statusCode.should.be.exactly(400);

      const error409 = createError(409);
      const ex409 = yield fish( throwInsideHandler(createError(error409)) );
      ex409.should.be.exactly(error409);
      ex409.statusCode.should.be.exactly(409);
   });

   it('catches server-side errors in handler [500]', function * () {
      const ex = yield fish( throwInsideHandler(new TypeError('could happen')) );
      ex.should.be.exactly(500);
   });

   it('is curried', () => {
      validator.should.be.a.Function();
      validator(imports).should.be.a.Function();
      validator(imports, log).should.be.a.Function();
   });

});
