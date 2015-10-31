'use strict';

// Interface (sequelize)
// ---
// Module:Sequelize - an instance of Sequelize client
//                    see http://docs.sequelizejs.com

const _ = require('lodash');
const t = require('@aso/tcomb');
const Bluebird = require('@aso/bluebird');
const Sequelize = require('sequelize');

function createClient (cfg, log) {
   const db = cfg.dbname;
   const user = cfg.username;
   const pass = cfg.password;

   return new Sequelize(db, user, pass, {
      host: 'localhost',
      port: cfg.port,
      dialect: 'postgres',
      logging: log.trace.bind(log), // Log using bunyan
      pool: {
         max: 5,
         min: 0,
         idle: 10000
      }
   });
}

const setup = Bluebird.coroutine(function *setup (cfg, imports, log) {
   const docker = imports.docker;

   yield docker.startContainer( cfg.postgresContainer );

   // Constant condition is okay as the setup promise
   // times out in the provider below
   while (true) {  // eslint-disable-line no-constant-condition
      try {
         // Create the client and wait for authentication
         const client = createClient(cfg, log);
         yield client.authenticate();

         // Provide
         return { sequelize: client };
      } catch (ex) {
         yield Bluebird.delay(1000);
      }
   }

});


/////////////
// Provide //
/////////////

// Lots of configuration so, perform type-checking on provider
const Configuration = t.struct({
   postgresContainer: t.String,
   dbname: t.String,
   username: t.String,
   password: t.String,
   port: t.Number,
   host: t.maybe(t.String)    // default: localhost
}, 'postgres/config');

module.exports = t.typedFunc({
   inputs: [Configuration, t.Object, t.Function],
   output: t.Promise,
   fn: function provider (cfg, imports, provide) {
      const log = imports.logger.child({ component: 'sequelize' });

      log.info('Waiting (upto 10s) for sequelize client to start');

      return setup(cfg, imports, log)
         .timeout(10000, 'Sequelize client start timed out [10s]')
         .tap(() => log.info('Sequelize is ready'))
         .nodeify(provide);
   }
});
