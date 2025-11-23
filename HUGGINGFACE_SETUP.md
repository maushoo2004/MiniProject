# Hugging Face Integration Guide

## Why Hugging Face?

✅ **Free Inference API** - No credit card required  
✅ **No Rate Limits** (for reasonable use)  
✅ **Better Toxicity Detection** - Specialized models  
✅ **Rephrasing Support** - Built-in text generation  
✅ **Multi-language** - Works with Hindi, English, and more  
✅ **Simple Setup** - Just an API key  

## Quick Setup

### Step 1: Get Your Hugging Face API Key

1. Go to https://huggingface.co/
2. Sign up or log in (free account)
3. Go to your profile → **Settings** → **Access Tokens**
4. Click **"New token"**
5. Name it: `blog-moderation`
6. Select **"Read"** permissions
7. Click **"Generate token"**
8. **Copy the token** (starts with `hf_`)

### Step 2: Add to Your Project

1. Open your `.env` file in the project root
2. Add this line:
   ```env
   REACT_APP_HUGGINGFACE_API_KEY=hf_your_token_here
   ```
3. Save the file
4. **Restart your dev server** (important!)

### Step 3: Test It

1. Start your app: `npm start`
2. Try posting a comment with toxic content
3. Check browser console - you should see Hugging Face API being called
4. The comment should be flagged with accurate scores

## How It Works

### Detection Flow

1. **Hugging Face** (Primary) - Uses `unitary/toxic-bert` model
   - Detects: toxic, severe_toxic, obscene, threat, insult, identity_hate
   - Returns accurate scores (0-1)
   - Maps to our categories automatically

2. **OpenAI** (Fallback) - If HF fails
   - Uses OpenAI Moderation API
   - Good backup option

3. **Keyword Detection** (Always Available)
   - Works even if APIs are down
   - Catches common toxic words

### Rephrasing Flow

1. **Hugging Face** (Primary) - Uses `humarin/chatgpt_paraphraser_on_T5_base`
   - Generates polite alternatives
   - Fast and free

2. **OpenAI** (Fallback) - If HF fails
   - Uses GPT-3.5-turbo for suggestions

## Models Used

### Toxicity Detection
- **Model**: `unitary/toxic-bert`
- **Purpose**: Detects toxic content with high accuracy
- **Output**: Scores for different toxicity types
- **Free**: Yes, no rate limits for reasonable use

### Text Rephrasing
- **Model**: `humarin/chatgpt_paraphraser_on_T5_base`
- **Purpose**: Suggests polite alternatives
- **Output**: Rephrased version of the comment
- **Free**: Yes

## API Response Format

Hugging Face returns:
```json
[
  [
    {"label": "toxic", "score": 0.95},
    {"label": "severe_toxic", "score": 0.12},
    {"label": "obscene", "score": 0.88},
    {"label": "threat", "score": 0.05},
    {"label": "insult", "score": 0.76},
    {"label": "identity_hate", "score": 0.03}
  ]
]
```

Our system maps these to:
- `toxic` / `hate` → **Hate** category
- `threat` → **Threat** category
- `insult` → **Bullying** category
- `obscene` → **Profanity** category
- `harassment` → **Harassment** category

## Benefits Over OpenAI

1. **No Rate Limits** - Free tier is very generous
2. **Specialized Models** - Built specifically for toxicity detection
3. **Better Accuracy** - Trained on large toxicity datasets
4. **Rephrasing Built-in** - No need for separate API
5. **Multi-language** - Works with Hindi, English, and many others

## Troubleshooting

### Issue: "Model is loading" (503 error)
- **Solution**: The system automatically retries after 5 seconds
- Models load on first use, then stay loaded
- This is normal and handled automatically

### Issue: API key not working
- **Solution**: 
  - Make sure token starts with `hf_`
  - Check token has "Read" permissions
  - Restart dev server after adding to `.env`

### Issue: Still using keyword detection
- **Solution**: 
  - Check browser console for errors
  - Verify API key is in `.env` file
  - Make sure you restarted the server

## Cost

**Hugging Face Inference API**: 
- **Free tier**: Unlimited requests (for reasonable use)
- **No credit card required**
- **No rate limits** (unlike OpenAI)

This makes it perfect for development and small-to-medium scale applications!

## Comparison

| Feature | Hugging Face | OpenAI | Keyword |
|---------|-------------|--------|---------|
| **Cost** | Free | $5 credit | Free |
| **Rate Limits** | None | Yes (429 errors) | None |
| **Accuracy** | High | High | Medium |
| **Rephrasing** | ✅ Yes | ✅ Yes | ❌ No |
| **Setup** | Easy | Easy | Built-in |
| **Multi-language** | ✅ Yes | ✅ Yes | Limited |

**Recommendation**: Use Hugging Face as primary, with keyword fallback!

