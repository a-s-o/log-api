'use strict';

require('should');

const imports = {

};

const endpoint = require('../createLog.js')(imports);

describe('createLog', () => {

   it('throw bad arguments', () => {
      const badArgs = [null, undefined, {}, { something: 'else' }];
      let coundown = badArgs.length;

      let ctx = {
         'throw': (x) => { throw x; }
      };

      badArgs.forEach(bad => {
         ctx.body = bad;
         endpoint.handler.bind(ctx).should.throw();
         coundown--;
      });

      coundown.should.equal(0);
   });

});
