'use strict';

const _ = require('lodash');
const t = require('@aso/tcomb');

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

User.User = User;
User.EncryptedPassword = EncryptedPassword;

module.exports = User;
