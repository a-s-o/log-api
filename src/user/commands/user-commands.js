'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const createError = require('http-errors');

const EncryptedPassword = t.struct({
   key: t.String,
   salt: t.String,
   iterations: t.Number
}, 'EncryptedPassword');

const User = t.struct({
   email: t.String,
   name: t.String,
   password: t.union(t.String, EncryptedPassword)
});

function conflict () {
   return Bluebird.reject(createError(409));
}

module.exports = function provider (config, imports, provide) {
   if (typeof config.topicName === 'string') {
      throw new Error('config.topicName must be string');
   }

   const topicName = config.topicName;
   const encoding = config.encoding || 'base64';
   const iterations = config.iterations || 10000;

   const Kafka = imports.kafka;
   const Hasher = imports.hasher;

   const userQueries = imports['user-queries'];
   const userProducer = Kafka.createProducer();

   function sendMessage (messages, partition) {
      return Kafka.sendMessage(userProducer, {
         topic: topicName,
         partition: partition || 0,
         messages: messages
      });
   }

   function encryptPassword (user) {
      // If user password is encrypted then we can continue
      if (EncryptedPassword.is(user.password)) {
         return user;
      }

      // Encrypt password
      return Hasher({ plaintext: user.password, iterations })
         .then(function update (hashed) {
            return User.update(user, {
               password: { $set: {
                  key: hashed.key.toString(encoding),
                  salt: hashed.salt.toString(encoding),
                  iterations: hashed.iterations
               } }
            });
         });

   }

   function triggerUserSignupEvents (user) {
      return sendMessage([{
         eventType: 'userCreated',
         eventTime: Date.now(),
         data: user
      }]);
   }

   function triggerUserEditEvents (user) {
      return sendMessage([{
         eventType: 'userEdited',
         eventTime: Date.now(),
         data: user
      }]);
   }

   User.create = t.typedFunc({
      inputs: [User],
      output: t.Promise, // < User >
      fn: function saveUser (user) {
         return userQueries
            // If a user already exists with the same email, then
            // throw a conflict 409 error
            .findOne(user.email)
            .then(conflict)
            // If user is not found then we can continue creating the user
            .catch(err => err.statusCode === 404, _.constant(user))
            // Encrypt the user's password (string -> EncryptedPassword object)
            .then(encryptPassword)
            .tap(triggerUserSignupEvents);
      }
   });

   User.update = t.typedFunc({
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
            .then(encryptPassword)
            .tap(triggerUserEditEvents);
      }
   });

   // Ensure the producer is ready, then create/check
   // existence of user topic in kafka before providing
   // user-commands service
   return Kafka.createTopic(userProducer, topicName)
      .then(() => ({ 'user-commands': User }))
      .nodeify(provide);
};
