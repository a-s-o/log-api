'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');

// Handles all incoming events mutates a sql table as necessary
// Return an observable of the number of changes done (for logging purposes)
function createUpdate (collection, t, evt) {
   switch (evt.actionId) {

   // Upsert user documents on signups and edits
   case 'USER_SIGNUP':
   case 'USER_EDIT_PROFILE':
      const row = _.defaults({ id: evt.userId }, evt.data);
      return collection.upsert(row, { transaction: t });

   default:
      // No event
      return [];
   }
}

function mergePromises (chain, promise) {
   if (!chain) return promise;
   return chain.then(() => promise);
}

function applyUpdates (collection, saveOffset, events, t) {
   const mutations = _.chain(events)
      .map(evt => createUpdate(collection, t, evt))
      .flatten()
      .value();

   if (!mutations || !mutations.length) {
      return Bluebird.resolve({ count: 0 })
         .then(() => saveOffset(events, t))
         .then((offset) => ({ offset, count: mutations.length }));
   }

   return _.reduce(mutations, mergePromises)
      .then(() => saveOffset(events, t))
      .then((offset) => ({ offset, count: mutations.length }));
}

module.exports = _.curry(applyUpdates);
