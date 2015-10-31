'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const _ = require('lodash');
const joi = require('joi');
const sinon = require('sinon');

const validator = require('../endpoints/validator.js');

const imports = {};
const log = { error: sinon.spy() };

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
      ctx = {
         'request': {},
         'throw': (err) => {
            throw err;
         }
      };
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

   it('throws on invalid outputs [400]', () => {
      (function * () {
         // An incorrect email is being provided
         ctx.request.body = { number: 123, email: 'test' };
         yield* wrapped.call(ctx);
      }).should.throw(400);
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


   it.skip('catches errors thrown in handler', () => {
      const typeErr = validator(imports, log, () => ({
         *handler () {
            throw new TypeError('it could happen');
         }
      }));

      (function * () {
         yield* typeErr.call(ctx);
      }).should.throw();
   });

   it('is curried', () => {
      validator.should.be.a.Function();
      validator(imports).should.be.a.Function();
      validator(imports, log).should.be.a.Function();
   });

});
