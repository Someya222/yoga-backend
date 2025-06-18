const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

//
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);




// Connect MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log('MongoDB connected');
  app.listen(process.env.PORT, () => {
    console.log(`Server running on: http://localhost:${process.env.PORT}`);
  });
})
.catch((error) => {
  console.error('MongoDB connection failed:', error.message);
});
