'use strict';
const _ = require('lodash');
const joi = require('joi');

module.exports = function updateUser (imports) {
   const User = imports['user-commands'];
   const events = imports['log-events'];

   return {
      inputs: {
         password: joi.string().min(8),
         name: joi.string()
      },
      *handler (inputs, id) {
         // Create a copy of inputs so we are not mutating
         // the inputs object (ex: to replace the plaintext password)
         const request = _.clone(inputs);

         // Update the user document (also encrypts plaintext password)
         const user = yield User.edit(id, inputs);

         // Replace the inputs password with the encrypted version
         // so that we don't publish a plaintext password in event
         if (request.password) {
            request.password = user.password;
         }

         // Create a log entry
         yield events.create({
            actionId: 'USER_EDIT_PROFILE',
            userId: user.id,
            data: request
         });

         this.body = _.omit(user, 'password');
      }
   };
};
