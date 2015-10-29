'use strict';

const joi = require('joi');

module.exports = function validator (endpoint) {
   return function *wrapper () {
      const check = joi.validate(this.request.body, endpoint.inputs, {
         stripUnknown: true,
         convert: true,
         abortEarly: true
      });

      if (check.error) {
         this.throw(400, 'Invalid request', {
            data: check.error
         });
      }

      // Handlers are all terminal (returning) so no need to pass next
      yield* endpoint.handler.call(this, check.value);
   };
};
