'use strict';

const _ = require('lodash');
const Bluebird = require('@aso/bluebird');

// Handles all incoming events mutates a sql table as necessary
// Return an observable of the number of changes done (for logging purposes)
function userEvents (collection, t, evt) {
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

function processCollection (onChange, onEnd, batch, t) {
   const mutations = _.chain(batch)
      .map(onChange(t))
      .flatten()
      .value();

   const changes = _.get(mutations, 'length', 0);

   // Calls the onEnd fn at the end of a promise Chain
   function endChain (chain) {
      return chain
         .then(() => onEnd(batch, t))
         .then((result) => ({ result, changes }));
   }

   // If there are no mutations, we still want to send an
   // event downstream so that the offset can be saved
   // ex: if 100 events are processed and none of them need
   // processing, we still update the offset in order to avoid
   // iterative over those events again
   if (!changes) {
      return endChain( Bluebird.resolve() );
   }

   // Sequentially join the mutation promises then end the chain
   return endChain( _.reduce(mutations, mergePromises) );
}

module.exports = {
   userEvents: _.curry(userEvents),
   processCollection: _.curry(processCollection)
};
