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
               text: `
Suggest 3 yoga poses for the goal: "${goal}".

Respond only in raw JSON array format. Do NOT wrap it in a markdown code block. Each object should contain:

- title
- instructions
- benefits
- english_name_search (This should match the "name" field from our dataset)
- sanskrit_name_search (This should match the "sanskrit_name" field from our dataset)

Use the following only as an **example** to understand the naming format and structure. Do NOT limit your suggestions to just these:

[
  {
    "name": "Wind Removing Pose",
    "sanskrit_name": "Pavanamuktasan"
  },
  {
    "name": "Bow Pose",
    "sanskrit_name": "Dhanurasana"
  },
  {
    "name": "Half Bow Pose",
    "sanskrit_name": "Ardha Dhanurasana"
  }
]

Make sure the english_name_search and sanskrit_name_search values match exactly with the corresponding pose in our dataset (not necessarily the ones in this example). Your output should only contain the required JSON format with no explanation or formatting.
`
              }
            ]
          }
        ]
      }
    );

// Add this route before app.listen
console.log(response.data.candidates?.[0]?.content);
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

// dataset
// ✅ Use this inside routes/yoga.js
router.get('/dataset', async (req, res) => {
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

router.get('/history', auth, async (req, res) => {
  console.log('>>> THIS IS THE NEW HISTORY ROUTE <<<', req.query);
  const { months } = req.query;
  const userId = req.user.id;
  const numberOfMonths = parseInt(months) || 1; // default to 1 month if not provided

  try {
    const today = new Date();
    const history = {};

    for (let i = 0; i < numberOfMonths; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const start = `${year}-${month}-01`;
      const endDate = new Date(year, date.getMonth() + 1, 1);
      const end = endDate.toISOString().split('T')[0];

      // Fetch DB entries for that month
      const entries = await YogaTracker.find({
        user: userId,
        date: { $gte: start, $lt: end }
      });

      // Create lookup map from DB
      const monthMap = {};
      entries.forEach(entry => {
        monthMap[entry.date] = entry.done;
      });

      // Fill in false for missing days
      const daysInMonth = new Date(year, date.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayStr}`;
        if (!(dateStr in monthMap)) {
          monthMap[dateStr] = false;
        }
        history[dateStr] = monthMap[dateStr];
      }
    }

    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


 // Save individual pose-level routine status
router.post('/routine-status', auth, async (req, res) => {
  const { date, routine, goal } = req.body; // ✅ include goal
  const userId = req.user.id;

  try {
    let entry = await YogaTracker.findOne({ user: userId, date });

    if (!entry) {
      entry = new YogaTracker({ user: userId, date, done: false, streak: 0 });
    }

    entry.routine = routine;
    entry.goal = goal; // ✅ store goal
    entry.done = routine.every(pose => pose.done);
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

    // ✅ return both routine and goal
    res.json({
      routine: entry.routine,
      goal: entry.goal || ''
    });
  } catch (err) {
    console.error('Error fetching routine:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/yoga/daily-pose
router.post('/daily-pose', auth, async (req, res) => {
  const { date, pose } = req.body;
  const userId = req.user.id;

  try {
    let entry = await YogaTracker.findOne({ user: userId, date });
    if (!entry) {
      entry = new YogaTracker({ user: userId, date });
    }

    entry.dailyPose = pose;
    await entry.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving daily pose:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/yoga/daily-pose?date=2025-06-25
router.get('/daily-pose', auth, async (req, res) => {
  const { date } = req.query;
  const userId = req.user.id;

  if (!date) return res.status(400).json({ message: 'Date is required' });

  try {
    const entry = await YogaTracker.findOne({ user: userId, date });
    res.json(entry?.dailyPose || null);
  } catch (err) {
    console.error('Error fetching daily pose:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;
