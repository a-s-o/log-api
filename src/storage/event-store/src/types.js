'use strict';

const t = require('@aso/tcomb');

const Joi = t.dict(t.String, t.irreducible('Joi', x => x.isJoi));

const EventStore = t.struct({
   topic             : t.String,
   partition         : t.Number,
   sendMessages      : t.Function, // [message] => Promise < response >
   createConsumer    : t.Function, // [request, opts] => Kafka.Consumer

   commonSchema      : Joi,
   events            : t.dict(t.String, t.Object),
   strict            : t.Boolean,

   typeProperty      : t.String,
   metadataProperty  : t.String
}, 'EventStore');

module.exports = {
   Joi,
   EventStore
};
