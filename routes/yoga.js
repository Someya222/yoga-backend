const express = require('express');
const axios = require('axios');
require('dotenv').config();
const auth = require('../middleware/auth');
const YogaTracker = require('../models/YogaTracker');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ✨ AI-Powered Yoga Suggestion Route
router.post('/generate', async (req, res) => {
  const { goal } = req.body;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
               text: `Suggest 3 yoga poses for the goal: "${goal}".
Respond only in raw JSON array format, do NOT wrap it in markdown code block. Each object should contain:

- title
- image (a public image URL of the pose)
- instructions
- benefits

No extra explanation or formatting.`
              }
            ]
          }
        ]
      }
    );

// Add this route before app.listen
    const result = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    res.json({ poses: result });

  } catch (error) {
    console.error('Gemini error:', error?.response?.data || error.message);
    res.status(500).json({
      message: 'AI request failed',
      error: error?.response?.data || error.message,
    });
  }
});

// Save or update daily yoga status
router.post('/save-daily', auth, async (req, res) => {
  try {
    const { date, done, streak } = req.body;
    const userId = req.user.id;

    const existing = await YogaTracker.findOne({ user: userId, date });

    if (existing) {
      existing.done = done;
      existing.streak = streak;
      await existing.save();
    } else {
      await YogaTracker.create({ user: userId, date, done, streak });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/yoga/history?year=2025&month=6
router.get('/history', auth, async (req, res) => {
  const { year, month } = req.query;
  const userId = req.user.id;

  if (!year || !month) {
    return res.status(400).json({ error: 'Year and month are required' });
  }

  try {
    // Construct date range
    const start = `${year}-${month.padStart?.(2, '0')}-01`;
    const endDate = new Date(start);
    endDate.setMonth(endDate.getMonth() + 1);
    const end = endDate.toISOString().split('T')[0];

    // Fetch all entries for user in the month
    const entries = await YogaTracker.find({
      user: userId,
      date: { $gte: start, $lt: end }
    });

    // Convert to lookup map { '2025-06-01': true, ... }
    const history = {};
    entries.forEach(entry => {
      history[entry.date] = entry.done;
    });

    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save individual pose-level routine status
 router.post('/routine-status', auth, async (req, res) => {
  const { date, routine } = req.body;
  const userId = req.user.id;

  try {
    let entry = await YogaTracker.findOne({ user: userId, date });

    if (!entry) {
      entry = new YogaTracker({ user: userId, date, done: false, streak: 0 });
    }

    entry.routine = routine;
    entry.done = routine.every(pose => pose.done); // Mark done if all poses are done
    await entry.save();

    res.status(200).json({ message: 'Routine saved', done: entry.done });

  } catch (err) {
    console.error('Routine save error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET /api/yoga/streak
router.get('/streak', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const entries = await YogaTracker.find({ user: userId }).sort({ date: -1 });

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let currentDate = new Date(today);

    for (const entry of entries) {
      const entryDate = new Date(entry.date);
      if (entry.done && entryDate.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1); // move to previous day
      } else {
        break; // streak broken
      }
    }

    res.json({ streak });
  } catch (err) {
    console.error('Error calculating streak:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/yoga/routine?date=2025-06-25
router.get('/routine', auth, async (req, res) => {
  const { date } = req.query;
  const userId = req.user.id;

  if (!date) return res.status(400).json({ message: 'Date is required' });

  try {
    const entry = await YogaTracker.findOne({ user: userId, date });

    if (!entry || !entry.routine) {
      return res.json([]); // no routine saved
    }

    res.json(entry.routine);
  } catch (err) {
    console.error('Error fetching routine:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;
