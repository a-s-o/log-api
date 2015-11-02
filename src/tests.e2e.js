'use strict';
/* eslint func-names: 0 */
require('co-mocha');
require('should');

const _ = require('lodash');
const fs = require('fs');
const uuid = require('node-uuid');
const Bluebird = require('@aso/bluebird');
const Bacon = require('baconjs');
const request = require('co-supertest');

// Get the last line from test.log
function lastLogLine () {
   const log = fs.readFileSync('test.log', 'utf-8');
   const lines = log.split('\n').filter(x => !!x);
   return JSON.parse(lines[lines.length - 1]);
}

// Helper for generating a random user doc
function randomUser (obj) {
   const random = uuid.v4().replace('-', '');
   return _.extend({
      email: random.slice(0, 6) + '@example.com',
      name: 'Mr. ' + random.slice(0, 6),
      password: random.slice(0, 10)
   }, obj);
}

function flush () {
   return Bluebird.delay(150);
}


describe('log-api [e2e]', () => {
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
         const arbitrary = uuid.v4();
         yield post({ actionId: arbitrary }).expect(200);
         yield Bluebird.delay(2);

         lastLogLine().actionId.should.equal( arbitrary );
      });

   });

   describe('POST /classes/user', () => {
      let agent;

      before(() => {
         agent = request.agent(server);
      });

      function post (content) {
         return agent.post('/classes/user')
            .send(content || null)
            .expect('Content-Type', /json/);
      }

      describe('valid request', () => {

         // { email:String, name:String, password:String }
         let userData;

         before(function * () {
            userData = randomUser();
         });

         it('response with a 200 status on save', function * () {
            yield post(userData).expect(200);
         });

         it('creates a USER_SIGNUP log entry', function * () {
            const lastLine = yield lastLogLine();
            lastLine.actionId.should.be.exactly('USER_SIGNUP');
            lastLine.userId.should.be.a.String();

            const logEntry = lastLine.data;
            logEntry.should.be.an.Object();
            logEntry.email.should.be.exactly(userData.email);
            logEntry.name.should.be.exactly(userData.name);

            const password = logEntry.password;
            password.should.be.an.Object();
            password.key.should.be.a.String();
            password.salt.should.be.a.String();
            password.iterations.should.be.a.Number();
         });

         it('rejects second posting due to conflict', function * () {
            // Wait for changes to presist to postgres
            yield flush();
            yield post(userData).expect(409);
         });

      });

      describe('rejects bad requests', () => {

         it('missing inputs', function * () {
            yield post( randomUser({ email: null }) ).expect(400);
            yield post( randomUser({ name: null }) ).expect(400);
            yield post( randomUser({ password: null }) ).expect(400);
         });

         it('short password', function * () {
            yield post( randomUser({ password: 'passwo' }) ).expect(400);
         });

         it('bad email', function * () {
            yield post( randomUser({ email: 'bad@mail' }) ).expect(400);
         });

      });

   });

   describe('PUT /classes/user/:id', () => {

      let agent;

      before(function * () {
         agent = request.agent(server);
      });

      function put (id, content) {
         return agent.put(`/classes/user/${id}`)
            .send(content || null)
            .expect('Content-Type', /json/);
      }


      describe('for existing users', () => {

         // { id:String, name:String, email:String }
         let userData;

         before(function * () {
            // Generate a random user
            const user = randomUser();

            // Post the random user so we can
            // try to apply updates against it
            const resp = yield agent.post('/classes/user')
               .send(user)
               .expect('Content-Type', /json/)
               .expect(200);

            // Wait for flush
            yield flush();

            // Merge response so we have access to the user's id
            userData = resp.body.result;
         });

         it('never updates email', function * () {
            const update = { name: 'Mr. New', email: 'new@email.com' };
            const resp = yield put(userData.id, update).expect(200);
            const result = resp.body.result;

            // The name should update
            result.name.should.be.exactly(update.name);

            // The email should not update
            result.email.should.be.exactly(userData.email);
            result.email.should.not.be.exactly(update.email);
         });

         it('creates a USER_EDIT_PROFILE log entry', function * () {
            const update = { name: 'Mr. Even Newer', password: '2137012703182' };
            yield put(userData.id, update).expect(200);
            yield flush();

            const lastLine = yield lastLogLine();
            lastLine.actionId.should.be.exactly('USER_EDIT_PROFILE');
            lastLine.userId.should.be.exactly(userData.id);

            const logEntry = lastLine.data;
            logEntry.should.be.an.Object();
            logEntry.name.should.be.exactly(update.name);

            const password = logEntry.password;
            password.should.be.an.Object();
            password.key.should.be.a.String();
            password.salt.should.be.a.String();
            password.iterations.should.be.a.Number();
         });

         it('rejects short password', function * () {
            yield put(userData.id, { password: 'short' }).expect(400);
         });

      });

      describe('for non-existent user', () => {

         it('responds with not found [404]', function * () {
            yield put(uuid.v4, {}).expect(404);
         });

      });


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
            .send({ actionId: 'random' })
            .expect(200));

         return Bacon
            .sequentially(1, lookups)
            .flatMap(promise => Bacon.fromPromise(promise));
      }

      it('1000 POST requests to /log [1 ms apart]', function * (done) {
         // Set high timeout so mocha doesn't fail the test
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
