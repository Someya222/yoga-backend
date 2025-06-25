const mongoose = require('mongoose');

const YogaTrackerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // format: 'yyyy-mm-dd'
  done: { type: Boolean, default: false },
  streak: { type: Number, default: 0 },
  routine: [
    {
      title: String,
      image: String,
      instructions: String,
      benefits: String,
      done: Boolean
    }
  ]
});


module.exports = mongoose.model('YogaTracker', YogaTrackerSchema);
