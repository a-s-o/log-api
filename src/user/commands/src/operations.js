'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const createError = require('http-errors');
const uuid = require('node-uuid');

const types = require('./types');

module.exports = function provider (config, imports) {
   const encoding = config.encoding || 'base64';
   const iterations = config.iterations || 10000;
   const hasher = imports.hasher;
   const userQueries = imports['user-queries'];

   const User = types.User;

   function encryptPassword (plaintext) {
      return hasher({ plaintext, iterations }).then(hashed => ({
         key: hashed.key.toString(encoding),
         salt: hashed.salt.toString(encoding),
         iterations: hashed.iterations
      }));
   }

   return {
      create: t.typedFunc({
         inputs: [t.struct({
            email: t.String,
            name: t.String,
            password: t.String
         })],
         output: t.Promise, // < User >
         fn: Bluebird.coroutine(function *saveUser (inputs) {
            // If user already exists, throw conflict error
            const existing = yield userQueries.count({
               where: { email: inputs.email }
            });

            if (existing) throw createError(409);

            return new User({
               id: uuid.v4(),
               email: inputs.email,
               name: inputs.name,
               password: yield encryptPassword(inputs.password)
            });
         })
      }),

      edit: t.typedFunc({
         inputs: [t.String, t.struct({
            name: t.maybe(t.String),
            password: t.maybe(t.String)
         })],
         output: t.Promise, // < User >
         fn: Bluebird.coroutine(function *editUser (id, inputs) {
            // If user does not exist, throw not found error
            const existing = yield userQueries.findById(id);
            if (!existing) throw createError(404, 'User not found');

            const update = existing.toJSON();

            if (inputs.name) {
               update.name = inputs.name;
            }

            // Encrypt new password
            if (inputs.password) {
               update.password = yield encryptPassword(inputs.password);
            }

            return new User( update );
         })
      })

   };
};
