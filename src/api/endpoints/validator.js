'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');
const joi = require('joi');
const createError = require('http-errors');

module.exports = function validator (endpoint) {
   const handler = Bluebird.coroutine(endpoint.handler);

   return function *wrapper () {
      const check = joi.validate(this.request.body || {}, endpoint.inputs, {
         stripUnknown: true,
         convert: true,
         abortEarly: true
      });

      if (check.error) {
         this.throw(400, 'Invalid request', {
            data: check.error
         });
      }

      // Prepend inputs to handler arguments (i.e. route params)
      const args = _.toArray(arguments);
      args.unshift(check.value);

      try {
         yield handler.apply(this, args);
      } catch (ex) {
         if (ex.expose) {
            throw ex;
         }

         console.log(ex.stack || ex);
         throw createError(500);

      }
   };
};
