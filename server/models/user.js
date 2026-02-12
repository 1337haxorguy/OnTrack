const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const UserSchema = new Schema({
    auth0Sub: {type: String, required: true, unique: true},
    email: { type: String, required: true } 
}, 
    { timestamps: true }
);

module.exports = model('User', UserSchema);