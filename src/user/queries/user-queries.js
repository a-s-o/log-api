'use strict';

module.exports = function setup (options, imports, provide) {
   const users = imports['user-collection'];
   provide(null, {
      'user-queries': {
         count    : users.count.bind(users),
         findOne  : users.findOne.bind(users),
         findById : users.findById.bind(users),
         findAll  : users.findAll.bind(users)
      }
   });
};
