'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const createError = require('http-errors');
const uuid = require('node-uuid');

const EncryptedPassword = t.subtype(t.Object, function isPass (obj) {
   return _.isString(obj.key) &&
      _.isString(obj.salt) &&
      _.isNumber(obj.iterations);
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

   function encryptPassword (plaintext) {
      return Hasher({ plaintext, iterations }).then((hashed) => {
         // Serialize the hashed password
         return {
            key: hashed.key.toString(encoding),
            salt: hashed.salt.toString(encoding),
            iterations: hashed.iterations
         };
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
   });

   User.edit = t.typedFunc({
      inputs: [t.String, t.struct({
         name: t.maybe(t.String),
         password: t.maybe(t.String)
      })],
      output: t.Promise, // < User >
      fn: Bluebird.coroutine(function *editUser (id, inputs) {
         // If user does not exist, throw not found error
         const existing = yield userQueries.findById(id);
         if (!existing) throw createError(404);

         // Need a mutable copy of the inputs
         const update = _.clone(inputs);

         // If a password is provided, encrypt it
         if (update.password) {
            update.password = yield encryptPassword(update.password);
         }

         return new User( _.extend(existing.toJSON(), update) );
      })
   });

   provide(null, { 'user-commands': User });
};
