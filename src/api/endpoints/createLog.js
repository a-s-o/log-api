'use strict';

const joi = require('joi');
const createError = require('http-errors');

module.exports = function setup (imports) {
   const events = imports['log-events'];
   const userQueries = imports['user-queries'];

   const userErr = 'Invalid userId provided. Please signup before posting logs';

   return {
      inputs: {
         actionId: joi.string().min(3).required(),
         userId: joi.string().guid(),
         data: joi.any()
      },
      *handler (inputs) {
         if (inputs.userId) {
            // If a user id is provided, make sure the user exists, before
            // allowing logs to be posted
            const user = yield userQueries.findById(inputs.userId);
            if (!user) throw createError(400, userErr);
         }

         this.body = yield events.create( inputs );
      }
   };
};
