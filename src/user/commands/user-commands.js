'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const createError = require('http-errors');
const uuid = require('node-uuid');

const EncryptedPassword = t.struct({
   key: t.String,
   salt: t.String,
   iterations: t.Number
}, 'EncryptedPassword');

const User = t.struct({
   id: t.String,
   email: t.String,
   name: t.String,
   password: t.union([t.String, EncryptedPassword])
});

module.exports = function provider (config, imports, provide) {
   const encoding = config.encoding || 'base64';
   const iterations = config.iterations || 10000;

   const Hasher = imports.hasher;

   const userQueries = imports['user-queries'];

   function encryptPassword (user) {
      // If user password is encrypted then we can continue
      if (EncryptedPassword.is(user.password)) {
         return user;
      }

      // Encrypt password
      return Hasher({ plaintext: user.password, iterations })
         .then(function update (hashed) {
            // Serialize an encrypted password
            const encrypted = EncryptedPassword({
               key: hashed.key.toString(encoding),
               salt: hashed.salt.toString(encoding),
               iterations: hashed.iterations
            });

            // Update user instance
            return User.update(user, { password: { $set: encrypted } });
         });

   }

   User.create = t.typedFunc({
      inputs: [t.struct({
         email: t.String,
         name: t.String,
         password: t.String
      })],
      output: t.Promise, // < User >
      fn: Bluebird.coroutine(function *saveUser (inputs) {
         const existing = yield userQueries.findOne({
            where: {
               email: inputs.email
            }
         });

         // If user already exists with the same
         // email, throw conflict error
         if (existing) throw createError(409);

         const hashed = yield Hasher({ plaintext: inputs.password, iterations });

         return new User({
            id: uuid.v4(),
            email: inputs.email,
            name: inputs.name,
            password: EncryptedPassword({
               key: hashed.key.toString(encoding),
               salt: hashed.salt.toString(encoding),
               iterations: hashed.iterations
            })
         });
      })
   });

   User.edit = t.typedFunc({
      inputs: [t.struct({
         email: t.String,
         name: t.maybe(t.String),
         password: t.maybe(t.String)
      })],
      output: t.Promise, // < User >
      fn: function updateUser (request) {
         return userQueries
            // Throws 404 if user is not found
            .findOne(request.email)
            .then(User)
            // Apply the request to the existing user object
            .then(existing => User.update(existing, {
               name: { $set: request.name || existing.name },
               password: { $set: request.password || existing.password }
            }))
            // If password was changed, re-encrypt it, else pass-through
            .then(encryptPassword);
      }
   });

   provide(null, { 'user-commands': User });
};
