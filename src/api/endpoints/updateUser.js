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
         // Update the user document
         const update = _.pick(inputs, 'password', 'name');
         const user = yield User.edit(id, update);

         // Replace the inputs password with the encrypted version
         // so that we don't publish a plaintext password in event
         inputs.password = user.password;

         // Create a log entry
         yield events.create({
            actionId: 'USER_EDIT_PROFILE',
            userId: id,
            data: inputs
         });

         this.body = _.omit(user, 'password');
      }
   };
};
