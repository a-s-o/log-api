'use strict';

const withValidation = require('./validator');

module.exports = function setup (imports) {
   return {
      createLog: withValidation( require('./createLog')(imports) ),
      createUser: withValidation( require('./createUser')(imports) ),
      updateUser: withValidation( require('./updateUser')(imports) )
   };
};
