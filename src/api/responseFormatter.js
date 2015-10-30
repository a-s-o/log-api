'use strict';

const _ = require('lodash');

module.exports = function *responseFormatter (next) {
   try {
      yield next;
      this.type = 'json';

      // This is an api server; all responses should be in JSON
      if (!_.isObject(this.body) || !_.has(this.body, 'result')) {
         this.body = {
            result: this.body,
            error: false
         };
      }
   } catch (ex) {
      this.status = ex.statusCode || 500;
      this.body = {
         error: ex.name || 'ServerError',
         statusCode: this.status,
         message: ex.message
      };

      // Get nested joi error details
      const data = (ex.data && ex.data.details) || ex.data;
      if (data) {
         this.body.data = data;
         const betterMessage = _.get(data, '0.message', data.message);
         if (betterMessage) this.body.message += ': ' + betterMessage;
      }
   }
};
