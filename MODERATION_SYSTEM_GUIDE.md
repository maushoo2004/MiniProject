# Enhanced Moderation System Guide

## Overview

The new moderation system provides:
- ✅ **Severity Levels**: Low, Medium, High
- ✅ **Categories**: Hate, Threat, Harassment, Profanity, Spam, Self-Harm, Sexual, Violence
- ✅ **Multiple Detection Methods**: OpenAI API + Enhanced Keyword Detection
- ✅ **Author Dashboard**: Authors see detailed moderation info for flagged comments

## Setup Steps

### Step 1: Update Database Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Add enhanced moderation columns
ALTER TABLE comments 
  ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS categories TEXT[],
  ADD COLUMN IF NOT EXISTS moderation_source TEXT;
```

Or use the file: `UPDATE_COMMENTS_TABLE.sql`

### Step 2: Restart Your App

The new moderation service is already integrated. Just restart your dev server.

## How It Works

### Detection Flow

1. **Primary**: Tries OpenAI Moderation API (if API key is set)
2. **Fallback**: Uses enhanced keyword-based detection
3. **Always Works**: Even if API is rate-limited, keyword detection catches common issues

### Severity Levels

- **LOW** (Yellow): Mild profanity, spam
- **MEDIUM** (Orange): Harassment, sexual content, moderate profanity
- **HIGH** (Red): Hate speech, threats, violence, self-harm

### Categories Detected

1. **Hate Speech**: Racism, bigotry, discrimination
2. **Threat**: Kill, murder, violence threats
3. **Harassment**: Bullying, intimidation, stalking
4. **Profanity**: Foul language, curses
5. **Spam**: Promotional content, scams
6. **Self-Harm**: Suicide, self-injury references
7. **Sexual**: Sexual content, inappropriate material
8. **Violence**: Violent content, graphic descriptions

## Author View

When authors view their posts, they see:

- **Severity Badge**: Color-coded (Low/Medium/High)
- **Toxicity Score**: Percentage score
- **Categories**: Tags showing what was detected
- **Source**: Whether detected by OpenAI API or keyword system
- **Report Button**: To report the user

## Alternative Moderation APIs

If OpenAI doesn't work for you, here are alternatives:

### Option 1: Azure Content Moderator (Recommended)

**Free Tier**: 5,000 transactions/month

**Setup**:
1. Go to https://azure.microsoft.com/en-us/services/cognitive-services/content-moderator/
2. Create Azure account (free tier available)
3. Create Content Moderator resource
4. Get API key and endpoint

**Implementation**: Would need to add Azure service to `enhancedModerationService.js`

### Option 2: AWS Comprehend

**Free Tier**: 50,000 units/month

**Setup**:
1. Go to https://aws.amazon.com/comprehend/
2. Create AWS account
3. Set up IAM user with Comprehend permissions
4. Get access keys

### Option 3: Perspective API (Google)

**Free Tier**: 1,000 requests/day

**Setup**:
1. Go to https://perspectiveapi.com/
2. Sign up with Google account
3. Get API key

### Option 4: Self-Hosted Solution

Use a library like:
- **Toxic-Comment-Classifier** (Python-based, can be API)
- **Hate-Speech-Detector** (Node.js package)

### Option 5: Hybrid Approach (Current)

✅ **What we have now**:
- OpenAI API (when available)
- Enhanced keyword detection (always works)
- Category classification
- Severity levels

This is the **most reliable** approach because:
- Works even when APIs are down/rate-limited
- No external dependencies for basic detection
- Fast and free
- Covers most common cases

## Testing the System

### Test Comments

**Should be flagged as HIGH severity:**
- "I hate you, you should die" (Hate + Threat)
- "kill yourself" (Self-Harm + Threat)
- "I will kill you" (Threat + Violence)

**Should be flagged as MEDIUM severity:**
- "you're a fucking idiot" (Profanity + Harassment)
- "you're so stupid" (Profanity)

**Should be flagged as LOW severity:**
- "click here for free money" (Spam)

**Should be safe:**
- "Great post!"
- "Thanks for sharing"
- "I found this helpful"

## Customization

### Adding More Keywords

Edit `src/services/enhancedModerationService.js`:

```javascript
// Add to appropriate category array
const profanityKeywords = [
  // ... existing keywords
  'your-new-keyword'
];
```

### Adjusting Severity Thresholds

In `enhancedKeywordModeration()` function:

```javascript
// Change severity calculation
if (maxScore >= 0.9) return SEVERITY_LEVELS.HIGH;  // Adjust threshold
if (maxScore >= 0.6) return SEVERITY_LEVELS.MEDIUM;
```

### Adding New Categories

1. Add to `MODERATION_CATEGORIES` object
2. Add keyword list
3. Add display name in `getCategoryDisplayName()`

## Troubleshooting

### Issue: Comments not being flagged

**Check**:
1. Browser console for moderation logs
2. Verify keywords are in the lists
3. Check if severity calculation is working

### Issue: Categories not showing

**Check**:
1. Database has `categories` column (TEXT[])
2. Comment has categories array populated
3. Author view is enabled

### Issue: API not working

**Solution**: The keyword fallback should still work. Check console logs to see which system is being used.

## Performance

- **Keyword Detection**: Instant (< 1ms)
- **OpenAI API**: ~200-500ms (when available)
- **Fallback**: Automatic, no delay

## Best Practices

1. **Always have fallback**: Keyword system ensures moderation works
2. **Monitor logs**: Check console for moderation results
3. **Update keywords**: Add new toxic terms as they appear
4. **Review flagged comments**: Authors should review before reporting
5. **Combine methods**: Use API + keywords for best coverage

## Current Status

✅ **Working Features**:
- Enhanced keyword moderation with categories
- Severity levels (Low/Medium/High)
- Author view with detailed info
- Database storage of moderation data
- Fallback system (always works)

⚠️ **OpenAI API**: 
- Works when not rate-limited
- Automatically falls back to keywords
- No action needed - system handles it

## Next Steps

1. Run `UPDATE_COMMENTS_TABLE.sql` in Supabase
2. Test with various comments
3. Monitor author view to see moderation details
4. Customize keywords as needed

The system is now **fully functional** with or without OpenAI API! 🎉

