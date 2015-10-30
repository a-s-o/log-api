'use strict';
const _ = require('lodash');
const joi = require('joi');

module.exports = function setup (imports) {
   const User = imports['user-commands'];
   const events = imports['log-events'];

   return {
      inputs: {
         email: joi.string().lowercase().email().required(),
         name: joi.string().required(),
         password: joi.string().min(8).required()
      },
      *handler (inputs) {
         // Create a user model; also encrypts password
         const user = yield User.create(inputs);

         // Create a log entry
         yield events.create({
            actionId: 'USER_SIGNUP',
            userId: user.id,
            data: _.omit(user, 'id')
         });

         this.body = _.omit(user, 'password');
      }
   };
};
