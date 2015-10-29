'use strict';
const crypto = require('crypto');
require('@aso/bluebird').promisifyAll(crypto);

/*
Usage
----------

Hashing a password

hasher {plaintext: 'secret'}, (err, result) ->
  # Save as hex strings
  user.salt = result.salt.toString('hex')
  user.key = result.key.toString('hex')
  user.save()

Verifying a password

# Hex string to Binary
salt = new Buffer(user.salt, 'hex')
hasher {plaintext: 'secret', salt: salt}, (err, result) ->
  if user.key == result.key.toString('hex')
    console.log 'Success!'

Generating a password

hasher {}, (err, result) ->
  # Save as hex strings
  user.salt = result.salt.toString('hex')
  user.key = result.key.toString('hex')
  user.save ->
    postmark.send
      From: "you@example.com"
      To: user.email
      Subject: "Thank you for signing up with Example.com"
      TextBody: "Your temporary password is #{result.plaintext}"


 */


// Password hashing helper
// opts is an object with a number of optional components:

// plaintext: The password to be hashed. If it is not provided,
// an 8 character base64 password will be randomly generated.

// iterations: How many times should the hash function be applied.
// Defaults to 10000. Strong enough?

// salt: A string or Buffer with the salt. If not provided, a 512-bit
// salt will be randomly generated.

// ref: http://boronine.com/2012/08/30/
// Strong-Password-Hashing-with-Node-Standard-Library/

function hasher (opts) {
   if (!opts.plaintext) {
      // Generate a random 12 character password
      return crypto.randomBytesAsync(12 * 4).then((buf) => {
         opts.plaintext = buf.toString('base64');
         return hasher(opts);
      });
   }

   if (!opts.salt) {
      // Generate a random salt
      return crypto.randomBytesAsync(64).then((buf) => {
         opts.salt = buf;
         return hasher(opts);
      });
   }

   opts.hash = 'sha256';
   opts.iterations = opts.iterations || 10000;

   return crypto
      .pbkdf2Async(opts.plaintext, opts.salt, opts.iterations, 512, 'sha256')
      .then((key) => {
         opts.key = new Buffer(key);
         return opts;
      });
}

const base32chars = 'abcdefghijklmnopqrstuvwxyz2345679';

function randomid (size) {
   const charLen = base32chars.length;
   const max = Math.floor(256 / charLen) * charLen;
   let ret = '';
   while ( ret.length < size ) {
      let buf = crypto.randomBytes(size - ret.length);
      for (let i = 0, len = buf.length; i < len; i++) {
         const x = buf.readUInt8(i);
         if ( x < max ) {
            ret += base32chars[x % charLen];
         }
      }
   }
   return ret;
}

module.exports = function setup (options, imports, provide) {
   provide(null, {
      crypto   : crypto,
      hasher   : hasher,
      randomid : randomid
   });
};
