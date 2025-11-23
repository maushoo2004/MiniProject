# Groq AI Setup for AI Suggestions

## Overview

Your app now uses **Groq AI** (Llama models) for generating AI-powered suggestions instead of Hugging Face. Groq provides fast, high-quality AI responses using Llama models.

## Setup Instructions

### 1. Get Your Groq API Key

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up or log in (free account available)
3. Navigate to **API Keys** section
4. Click **"Create API Key"**
5. Copy your API key (starts with `gsk_`)

### 2. Add to `.env` File

Add this line to your `.env` file in the root directory:

```env
REACT_APP_GROQ_API_KEY=gsk_your_api_key_here
```

**Important**: Make sure your `.env` file is in the root directory (same level as `package.json`).

### 3. Restart Your Servers

After adding the API key, restart both servers:

```bash
# Stop current servers (Ctrl+C) and restart
npm run dev
```

## How It Works

1. **User posts a comment** with potentially toxic content
2. **Moderation system** detects toxic content (using keyword-based detection)
3. **Groq AI** generates a polite, safe alternative suggestion
4. **Suggestion box** appears below the comment with the AI-generated alternative

## Models Used

The system tries these Groq models in order (fastest first):

1. **llama-3.1-8b-instant** - Fastest, good quality
2. **llama-3.1-70b-versatile** - Best quality, slightly slower
3. **mixtral-8x7b-32768** - Alternative option

## Features

✅ **Fast Responses** - Groq is optimized for speed  
✅ **High Quality** - Uses state-of-the-art Llama models  
✅ **Multi-language** - Supports Hindi and English  
✅ **Context-aware** - Generates relevant, polite alternatives  
✅ **Free Tier Available** - Generous free usage limits

## Testing

1. Make sure your `.env` file has `REACT_APP_GROQ_API_KEY`
2. Restart servers: `npm run dev`
3. Post a comment with toxic words (e.g., "This is stupid")
4. You should see an AI-generated suggestion appear below the comment box

## Troubleshooting

### No suggestions appearing?

1. **Check API key**: Make sure `REACT_APP_GROQ_API_KEY` is set correctly
2. **Check backend logs**: Look for `✅ Groq rephrasing successful` messages
3. **Check browser console**: Look for any error messages
4. **Verify backend is running**: Should see `🚀 Backend proxy server running on http://localhost:3001`

### API errors?

- Verify your API key is correct
- Check Groq console for usage limits
- Make sure backend server is running on port 3001

## Backend Endpoint

The backend proxy endpoint is:

- **URL**: `http://localhost:3001/api/rephrase`
- **Method**: POST
- **Body**: `{ text: "comment text", apiKey: "gsk_...", isHindi: false }`

## Fallback System

If Groq AI fails, the system automatically falls back to:

- **Enhanced keyword-based suggestions** (varied, context-aware)
- Always works, no API required

This ensures your app always provides suggestions even if the API is temporarily unavailable.

