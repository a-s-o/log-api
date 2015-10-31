'use strict';


module.exports = function setup (imports, log) {
   const withValidation = require('./validator')(imports, log);
   return {
      createLog: withValidation( require('./createLog') ),
      createUser: withValidation( require('./createUser') ),
      updateUser: withValidation( require('./updateUser') )
   };
};
