'use strict';

const koa = require('koa');
const route = require('koa-route');
const body = require('koa-body');

const responseFormatter = require('./responseFormatter');

module.exports = function provider (config, imports, provide) {

   const endpoints = require('./endpoints')(imports);
   const api = koa();

   api.use(body());

   api.use(responseFormatter);

   api.use(route.post('/log', endpoints.createLog));
   api.use(route.post('/classes/user', endpoints.createUser));
   api.use(route.put('/classes/user/:id', endpoints.updateUser));

   api.use(function *notFound () {
      this.throw(404, 'Not found');
   });

   provide(null, { api });

};
