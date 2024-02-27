const { Sequelize } = require('sequelize');

// Replace the placeholders with your actual database credentials
const sequelize = new Sequelize('defaultdb', 'doadmin', 'AVNS_igj99duiQ4vaVz-q7A2', {
  host: 'dd-user-do-user-10236721-0.c.db.ondigitalocean.com',
  dialect: 'postgres',
  logging: 'console.log', // turn off logging or set to console.log for debugging
});

module.exports = sequelize;