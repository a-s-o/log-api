'use strict';

module.exports = function setup (imports) {
   return {
      inputs: {

      },
      *handler (inputs) {
         this.body = 'updateUser';
      }
   };
};
