const {Sequelize, DataTypes, UUIDV4} = require('sequelize');
const sequelize = new Sequelize(`postgres://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`, {
    logging:false, /* raw queries should not be loggged to the console */
    define:{
        freezeTableName:true
    }
});

const tokens = sequelize.define('invalidtokens', {
    /* Model Attributes */
    user_id:{
        type: DataTypes.UUID,
        defaultValue: UUIDV4,
        primaryKey: true
        
    },

    jwt_token:{
        type: DataTypes.BLOB,
        allowNull: false
    },


}, {
    createdAt: false,
    updatedAt:false
})

module.exports = tokens