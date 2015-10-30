'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');
const request = require('co-supertest');
const uuid = require('node-uuid');
const fs = require('fs');

const app = require('../start.js');
let server;

before((done) => {
   app.on('ready', () => {
      server = app.services.server;
      done();
   });
});

after(() => {
   server.close();
});

describe('api [e2e]', () => {

   describe('POST /log', () => {
      let agent;
      before(() => {
         agent = request.agent(server);
      });

      after((done) => {
         fs.writeFile('app.log', '', done);
      });

      function post (content) {
         // always json - this is an api server
         return agent.post('/log')
            .send(content || null)
            .expect('Content-Type', /json/);
      }

      it('rejects requests without actionId', function * () {
         yield post().expect(400);
         yield post(null).expect(400);
         yield post({}).expect(400);
         yield post({ something: 'something' }).expect(400);
      });

      it('accepts requests with an actionId', function * () {
         yield post({ actionId: 'some-id' }).expect(200);
      });

      it('appends log entry to end of app.log', function * () {
         const id = uuid.v4();
         yield post({ actionId: id }).expect(200);

         // Get the last line from app.log
         const log = fs.readFileSync('app.log', 'utf-8');
         const lines = log.split('\n').filter(x => !!x);
         const last = JSON.parse(lines[lines.length - 1]);

         last.actionId.should.equal(id);
      });

   });

   describe('POST /classes/user', () => {

      it('test');

   });

   describe('PUT /classes/user/:id', () => {

      it('test');

   });

   describe('all other requests', () => {
      let agent;
      before(() => {
         agent = request.agent(server);
      });

      it('should respond with 404', function * () {
         yield agent.get('/log').expect('Content-Type', /json/).expect(404);
         yield agent.put('/log').expect('Content-Type', /json/).expect(404);
         yield agent.del('/log').expect('Content-Type', /json/).expect(404);

         yield agent.get('/classes').expect('Content-Type', /json/).expect(404);
         yield agent.put('/classes').expect('Content-Type', /json/).expect(404);
         yield agent.del('/classes').expect('Content-Type', /json/).expect(404);

         yield agent.get('/classes/user').expect('Content-Type', /json/).expect(404);
      });

   });

});
