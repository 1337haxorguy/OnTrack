const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const UserSchema = new Schema({
  sub:      { type: String, required: true, unique: true },
  email:    { type: String, default: "" },
  goals:    { type: Schema.Types.Mixed, default: [] },
  schedule: { type: Schema.Types.Mixed, default: null },
  plan:     { type: Schema.Types.Mixed, default: null },
  avatar:   { type: String, default: null },
  usage: {
    generations: { type: Number, default: 0 },
  },
}, { timestamps: true });

module.exports = model('User', UserSchema);
