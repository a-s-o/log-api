'use strict';

const joi = require('joi');

module.exports = function setup (imports) {
   const userCommands = imports['user-commands'];

   return {
      inputs: {
         email: joi.string().email().required(),
         name: joi.string().min(3).required(),
         password: joi.string().min(8).required()
      },
      *handler (inputs) {
         this.body = inputs;
      }
   };
};
