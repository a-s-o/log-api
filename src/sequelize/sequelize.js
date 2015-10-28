'use strict';
const _ = require('lodash');
const t = require('@aso/tcomb');

const Sequelize = require('sequelize');

function createClient (cfg) {
   const db = cfg.dbname || 'logusers';
   const user = cfg.username;
   const pass = cfg.password;

   const client = new Sequelize(db, user, pass, {
      host: 'localhost',
      port: cfg.port,
      dialect: 'postgres',
      pool: {
         max: 5,
         min: 0,
         idle: 10000
      }
   });

   return {
      sequelize: client
   };
}

/////////////
// Provide //
/////////////

// Lots of configuration so, perform type-checking on provider
const Configuration = t.struct({
   postgresContainer: t.String,
   username: t.String,
   password: t.String,
   port: t.Number,
   host: t.maybe(t.String),    // default: localhost
   dbname: t.maybe(t.String)   // default: logusers
}, 'postgres/config');

module.exports = t.typedFunc({
   inputs: [Configuration, t.Object, t.Function],
   output: t.Promise,
   fn: function provider (cfg, imports, provide) {
      const docker = imports.docker;
      return docker.startContainer( cfg.postgresContainer )
         .then(() => createClient(cfg))
         .nodeify(provide);
   }
});
