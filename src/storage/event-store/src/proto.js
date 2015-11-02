'use strict';
const _ = require('lodash');
const joi = require('joi');
const Bacon = require('baconjs');
const Bluebird = require('@aso/bluebird');

   // Create an event and store it in kafka
exports.create = Bluebird.coroutine(function *create (properties) {
   const eventName = properties[this.typeProperty];
   const validated = this.validate(eventName, properties);

   // Send the message
   const response = yield this.sendMessages([ JSON.stringify(validated) ]);

   // Add metadata based on response from Kafka
   validated[this.metadataProperty] = {
      topic: this.topic,
      partiion: this.partition,
      offset: _.get(response, [this.topic, this.partition])
   };

   return validated;
});

// Internally used to validate events by .create(); exposed
// externally so events can be validated beforehand if needed
exports.validate = function validateEvent (eventName, properties) {
   const eventDefinition = this.events[eventName];

   // Unknown event in strict mode - block it
   if (!eventDefinition && this.strict) {
      throw new Error(`Event "${eventName}" does not exist`);
   }

   // All events get validated; either their own schema or common props
   const schema = _.get(eventDefinition, 'schema', this.commonSchema);

   const check = joi.validate(properties, schema, {
      allowUnknown: this.strict === false,
      stripUnknown: this.strict === true,
      convert: true,
      abortEarly: true
   });

   if (check.error) {
      const msg = _.get(check, 'error.details.0.message', 'Invalid event');
      throw new Error(msg);
   }

   return check.value;
};

// Provides messages in a certain topic as an event stream
exports.asEventStream = function createEventStream (offset) {
   const request = [{
      topic: this.topic,
      offset: offset || 0
   }];

   const options = _.defaults(arguments[1] || {}, {
      fromOffset: true,
      autoCommit: false
   });

   const consumer = this.createConsumer(request, options);

   return Bacon
      .fromEventTarget(consumer, 'message')
      .map((msg) => {
         // Deserialize
         const parsed = JSON.parse(msg.value);
         parsed[this.metadataProperty] = _.omit(msg, 'value');
         return parsed;
      });
};
