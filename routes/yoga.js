const express = require('express');
const axios = require('axios');
require('dotenv').config();

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
- image (generate the yoga pose)
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

module.exports = router;
