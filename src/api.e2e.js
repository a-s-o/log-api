'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const _ = require('lodash');
const fs = require('fs');
const uuid = require('node-uuid');
const Bacon = require('baconjs');
const request = require('co-supertest');

describe('api [e2e]', () => {
   let server;

   before(function (done) {
      console.log('\n    Waiting (up to 10s) for app ready signal \n');
      this.timeout(10000);
      const app = require('./start.js');
      app.on('ready', function ready () {
         server = app.services.server;
         done();
      });
   });

   after(function (done) {
      server.close();
      server.on('close', () => done());
   });

   describe('POST /log', () => {
      let agent;
      before(() => {
         agent = request.agent(server);
      });

      after((done) => {
         fs.writeFile('test.log', '', done);
      });

      function post (content) {
         // always json - this is an api server
         return agent.post('/log')
            .send(content || null)
            .expect('Content-Type', /json/);
      }

      it('rejects requests without actionId [400]', function * () {
         yield post().expect(400);
         yield post(null).expect(400);
         yield post({}).expect(400);
         yield post({ something: 'something' }).expect(400);
      });

      it('accepts requests with an actionId [200]', function * () {
         yield post({ actionId: 'some-id' }).expect(200);
      });

      it('appends log entry to end of test.log', function * () {
         const id = uuid.v4();
         yield post({ actionId: id }).expect(200);

         // Get the last line from test.log
         const log = fs.readFileSync('test.log', 'utf-8');
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

      it('are rejected [404]', function * () {
         yield agent.get('/log').expect('Content-Type', /json/).expect(404);
         yield agent.put('/log').expect('Content-Type', /json/).expect(404);
         yield agent.del('/log').expect('Content-Type', /json/).expect(404);

         yield agent.get('/classes').expect('Content-Type', /json/).expect(404);
         yield agent.put('/classes').expect('Content-Type', /json/).expect(404);
         yield agent.del('/classes').expect('Content-Type', /json/).expect(404);

         yield agent.get('/classes/user').expect('Content-Type', /json/).expect(404);
      });

   });

   describe('benchmark', () => {
      let agent;
      before(() => {
         agent = request.agent(server);
      });

      after((done) => {
         fs.writeFile('test.log', '', done);
      });

      function requestGenerator (total, i) {
         if (total < i * 50) return false;

         const lookups = _.range(50).map(() => agent
            .post('/log')
            .send({ actionId: 'load' })
            .expect(200));

         return Bacon
            .sequentially(1, lookups)
            .flatMap(promise => Bacon.fromPromise(promise));
      }

      it('1000 POST requests to /log [1 ms apart]', function * (done) {
         this.timeout(15000);
         const time = process.hrtime();
         const total = 1000;

         const seq = Bacon.repeat(requestGenerator.bind(null, total));

         seq.onError(done);

         seq.onEnd(() => {
            const diff = process.hrtime(time);
            const ns = diff[0] * 1e9 + diff[1];
            const avgMs = (ns / 1e6) / total;
            const round = Math.round(avgMs * 1000) / 1000;
            done();
            console.log('\n        Took %d ms per request \n', round);
         });
      });

   });

});
