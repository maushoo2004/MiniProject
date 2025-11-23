# OpenAI API Setup Verification

## Quick Check

1. **Open your browser's Developer Console** (F12 or Right-click → Inspect → Console tab)

2. **Look for these messages when the app loads:**

   - ✅ `OpenAI API key is configured` - API key is set correctly
   - ⚠️ `OpenAI API key is NOT configured` - API key is missing or incorrect

3. **When you post a comment, check the console for:**
   - 🔍 `Calling OpenAI Moderation API for text: ...` - API is being called
   - ✅ `OpenAI API Response: ...` - API responded successfully
   - 📊 `Moderation Result: ...` - Shows if content was flagged

## If API is NOT being used:

### Step 1: Check your .env file

Make sure you have a `.env` file in the root directory (same level as `package.json`) with:

```env
REACT_APP_OPENAI_API_KEY=sk-your-actual-key-here
```

**Important:**

- The key must start with `sk-`
- No quotes around the key
- No spaces before or after the `=`
- The file must be named exactly `.env` (not `.env.txt`)

### Step 2: Get your API key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)
5. Paste it in your `.env` file

### Step 3: Restart your dev server

**CRITICAL:** After adding/changing the `.env` file, you MUST:

1. Stop your dev server (Ctrl+C)
2. Start it again (`npm start`)

React only reads `.env` files when the server starts!

### Step 4: Verify it's working

1. Open browser console
2. Post a test comment with offensive language like "you fucking shit"
3. You should see:
   - `🔍 Calling OpenAI Moderation API for text: ...`
   - `✅ OpenAI API Response: ...`
   - The comment should be flagged

## Testing the API

Try these test comments to verify the API is working:

1. **Should be FLAGGED:**

   - "you fucking shit"
   - "I hate you"
   - "kill yourself"
   - "you're an idiot"

2. **Should be SAFE:**
   - "Great post!"
   - "Thanks for sharing"
   - "I found this helpful"

## Troubleshooting

### Issue: Still seeing "API key is NOT configured"

- Check `.env` file exists in root directory
- Check the key starts with `sk-`
- Restart your dev server
- Check for typos in the variable name: `REACT_APP_OPENAI_API_KEY`

### Issue: API calls failing

- Check your API key is valid
- Check you have credits in your OpenAI account
- Check browser console for error messages
- Verify the key hasn't been revoked

### Issue: Comments not being flagged

- Check console logs to see if API is being called
- Check the API response in console
- Verify the `flagged` field in the response
- Check if fallback moderation is being used instead

## Console Logs Explained

When moderation runs, you'll see:

```
🔍 Calling OpenAI Moderation API for text: you fucking shit...
✅ OpenAI API Response: {results: [{flagged: true, ...}]}
📊 Moderation Result: {flagged: true, maxScore: 0.95, categories: {...}}
💾 Saving comment with data: {isFlagged: true, toxicityScore: 0.95}
```

If you see "Using fallback moderation" instead, the API is not being used.
