const { DataTypes } = require('sequelize');
const sequelize = require('./database'); // Adjust the path to your sequelize configuration

const User = sequelize.define('User', {
  // Define attributes
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  hasPaid:{
    type:DataTypes.BOOLEAN,
    allowNull:true,
    unique:false
  }
  // You can add more fields here as needed
}, {
  // Model options
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

module.exports = User;