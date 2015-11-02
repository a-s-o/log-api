'use strict';
const Sequelize = require('sequelize');
const JsonField = require('sequelize-json');

module.exports = function UserModel (sequelize) {
   return {
      id: {
         type: Sequelize.UUID,
         primaryKey: true,
         defaultValue: Sequelize.UUIDV4,
         allowNull: false
      },
      email: {
         type: Sequelize.STRING,
         unique: true
      },
      name: {
         type: Sequelize.STRING,
         allowNull: false
      },
      password: JsonField(sequelize, 'User', 'password')
   };
};
