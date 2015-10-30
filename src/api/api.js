'use strict';

const koa = require('koa');
const route = require('koa-route');
const body = require('koa-body');

const responseFormatter = require('./responseFormatter');

module.exports = function provider (config, imports, provide) {

   if (typeof config.port !== 'number') {
      throw new Error('config.port is required');
   }

   const port = config.port;

   const log = imports.logger.child({ component: 'api' });
   const endpoints = require('./endpoints')(imports);
   const api = koa();

   api.use(body());

   api.use(responseFormatter);

   api.use(route.post('/log', endpoints.createLog));
   api.use(route.post('/classes/user', endpoints.createUser));
   api.use(route.put('/classes/user/:id', endpoints.updateUser));

   // TODO: deactivate this route in 1.0
   // api.use(route.get('/classes/user', function *listUsers () {
   //    const users = imports['user-queries'];
   //    const _ = require('lodash');
   //    const results = yield users.findAll();
   //    this.body = _.map(results, it => _.omit(it.toJSON(), 'password'));
   // }));

   api.use(function *notFound () {
      this.throw(404, 'Not found');
   });

   const server = api.listen(port, () => {
      log.info(`Listening on ${port}`);
   });

   provide(null, { api, server });

};
