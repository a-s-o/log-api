'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');
const joi = require('joi');

function validator (imports, log, provider) {
   // Get the endpoint, provide the imports and logger to it
   const endpoint = provider(imports, log);
   const name = provider.displayName || provider.name;
   const handler = Bluebird.coroutine(endpoint.handler);
   const inputs = endpoint.inputs || {};

   return function *wrapper () {
      const check = joi.validate(this.request.body || {}, inputs, {
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
         // If a client error is thrown; simply re-throw
         if (ex.expose) throw ex;

         // Log internal errors
         log.error({ err: ex }, `Problem in endpoint ${name}'s handler`);
         this.throw(500);
      }
   };
}

module.exports = _.curry(validator);
