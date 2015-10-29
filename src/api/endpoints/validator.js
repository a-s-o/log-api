'use strict';

const Bluebird = require('@aso/bluebird');
const joi = require('joi');

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

      yield handler.call(this, check.value);
   };
};
