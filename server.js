const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');



const app = express();

// Middlewares
app.use(cors());
app.use(express.json());



// Test Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// yoga routes
const yogaRoutes = require('./routes/yoga');
app.use('/api/yoga', yogaRoutes);

// dataset
app.get('/api/yoga/dataset', async (req, res) => {
  try {
    const response = await axios.get(
      'https://huggingface.co/datasets/omergoshen/yoga_poses/resolve/main/yoga_poses.json'
    );
    res.json(response.data);
  } catch (err) {
    console.error('Dataset fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dataset' });
  }
});


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
