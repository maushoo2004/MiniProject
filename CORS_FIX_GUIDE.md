# CORS Fix Guide for Hugging Face API

## Problem

Hugging Face Inference API doesn't allow direct browser requests due to CORS (Cross-Origin Resource Sharing) restrictions. This causes errors like:

```
Access to fetch at 'https://api-inference.huggingface.co/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```

## Current Solution (Temporary)

The code now uses a **free CORS proxy** (`api.allorigins.win`) to bypass CORS restrictions. This works but has limitations:

- ⚠️ **Not recommended for production** (rate limits, reliability issues)
- ✅ Works for development and testing
- ✅ Free and easy to use

## Better Solutions for Production

### Option 1: Create Your Own Backend Proxy (Recommended)

Create a simple backend endpoint that forwards requests to Hugging Face:

**Node.js/Express Example:**

```javascript
// backend/server.js
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/rephrase", async (req, res) => {
  try {
    const { text, apiKey } = req.body;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/humarin/chatgpt_paraphraser_on_T5_base",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: `paraphrase: ${text} </s>`,
          parameters: {
            max_length: 128,
            num_return_sequences: 1,
            temperature: 0.7,
            do_sample: true,
          },
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log("Proxy server running on port 3001");
});
```

Then update your frontend to call your proxy:

```javascript
const response = await fetch("http://localhost:3001/api/rephrase", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text,
    apiKey: process.env.REACT_APP_HUGGINGFACE_API_KEY,
  }),
});
```

### Option 2: Use Vercel/Netlify Serverless Functions

Create a serverless function that acts as a proxy:

**Vercel Example (`api/rephrase.js`):**

```javascript
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, apiKey } = req.body;

  const response = await fetch(
    "https://api-inference.huggingface.co/models/humarin/chatgpt_paraphraser_on_T5_base",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: `paraphrase: ${text} </s>`,
        parameters: {
          max_length: 128,
          num_return_sequences: 1,
          temperature: 0.7,
          do_sample: true,
        },
      }),
    }
  );

  const data = await response.json();
  res.json(data);
}
```

### Option 3: Use Hugging Face Spaces API (Alternative)

Some Hugging Face models are available through Spaces API which may have different CORS policies. Check if your model has a Space version.

## Current Implementation

The code automatically uses `api.allorigins.win` as a CORS proxy. This works for now but you should:

1. **For Development**: Keep using the proxy (it works)
2. **For Production**: Set up your own backend proxy (Option 1 or 2)

## Testing

To test if CORS is fixed:

1. Open browser console
2. Try posting a toxic comment
3. Check for CORS errors
4. You should see: "🌐 Using CORS proxy for HF API call"
5. Suggestions should appear below the comment box

## Troubleshooting

If you still see CORS errors:

1. Check browser console for specific error
2. Verify your Hugging Face API key is correct
3. Try a different CORS proxy service
4. Set up your own backend proxy (recommended)

## Alternative CORS Proxy Services

If `allorigins.win` doesn't work, try:

- `https://corsproxy.io/?`
- `https://cors-anywhere.herokuapp.com/` (requires activation)
- Your own proxy (best option)
