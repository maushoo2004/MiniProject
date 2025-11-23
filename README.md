# BlogSpace - Blog Site with Comment Moderation

A modern blog platform built with React.js that allows users to post blogs and comment on them, with an intelligent content moderation system to filter out inappropriate comments.

## Features

- 🔐 **Authentication**: User login/signup with Supabase
- 📝 **Blog Posts**: Create and view blog posts
- ✏️ **Create Posts**: Easy-to-use form to create new blog posts (login required)
- 💬 **Comments**: Users can comment on blog posts (login required)
- 🛡️ **Content Moderation**: Automatic filtering of toxic/harassing comments
- 🌐 **Multi-language Support**: Works with Hindi and English (and many other languages)
- 👁️ **Author View**: Blog authors can see flagged comments and report users
- 📊 **Report System**: Track user reports with database integration
- 🔔 **Toast Notifications**: User-friendly notifications for flagged comments
- 🎨 **Modern UI/UX**: Clean and friendly interface

## Content Moderation API

This project uses **Hugging Face Inference API** (primary) with OpenAI and keyword fallback for content moderation. It supports multiple languages including Hindi and English.

### Recommended: Hugging Face Inference API

- ✅ **Free Forever**: No credit card, no rate limits (reasonable use)
- ✅ **Better Accuracy**: Specialized toxicity detection models
- ✅ **Rephrasing Built-in**: Suggests polite alternatives automatically
- ✅ **Multi-language**: Works with Hindi, English, and many others
- ✅ **Simple Setup**: Just an API key

### Quick Setup:

1. **Get your Hugging Face API key**:

   - Visit: https://huggingface.co/settings/tokens
   - Sign up or log in (free account)
   - Create a new token with "Read" permissions
   - Copy the token (starts with `hf_`)

2. **Add to your project**:
   - Create a `.env` file in the root directory
   - Add: `REACT_APP_HUGGINGFACE_API_KEY=hf-your-token-here`
   - (Optional) Also add: `REACT_APP_OPENAI_API_KEY=sk-your-key-here` for fallback
   - Restart your dev server

**See [HUGGINGFACE_SETUP.md](./HUGGINGFACE_SETUP.md) for detailed instructions.**

### Fallback System:

1. **Hugging Face** (Primary) - Best accuracy, free, no rate limits
2. **OpenAI** (Fallback) - Good backup if HF unavailable
3. **Keyword Detection** (Always works) - Catches common toxic words

## Installation

1. Install dependencies:

```bash
npm install
```

2. **Set up Supabase** (Required for authentication):

   - Follow the detailed guide in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
   - Create a Supabase project
   - Set up database tables
   - Get your API keys

3. **Set up environment variables**:

   - Create a `.env` file in the root directory
   - Add your Supabase credentials:
     ```env
     REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
     REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     REACT_APP_HUGGINGFACE_API_KEY=hf-your-token-here
     REACT_APP_OPENAI_API_KEY=sk-your-key-here
     ```
   - Get Supabase keys from: https://supabase.com/dashboard
   - Get Hugging Face token from: https://huggingface.co/settings/tokens (Recommended - Free!)
   - Get OpenAI key from: https://platform.openai.com/api-keys (optional fallback)

4. Start the development server:

```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

**Note**: You must set up Supabase before the app will work properly. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions.

## Project Structure

```
src/
├── components/
│   ├── Home.js              # Home page with blog list
│   ├── CreateBlogPost.js    # Create new blog post form
│   ├── BlogPost.js          # Individual blog post view
│   ├── Comments.js          # Comments container
│   ├── CommentForm.js       # Comment submission form
│   ├── CommentList.js       # List of comments
│   ├── CommentItem.js       # Individual comment display
│   ├── Auth.js              # Login/Signup modal
│   ├── ProtectedRoute.js    # Route protection component
│   └── Toast.js             # Toast notification component
├── contexts/
│   └── AuthContext.js       # Authentication context provider
├── lib/
│   └── supabase.js          # Supabase client configuration
├── services/
│   └── moderationService.js # Content moderation API service (OpenAI)
├── App.js                   # Main app component with routing
└── index.js                 # Entry point
```

## How It Works

1. **Authentication**: Users must sign up/login to create posts and comment
2. **Create Posts**: Logged-in users can create blog posts using the "Create Post" button
3. **Comment Submission**: When a logged-in user submits a comment (in Hindi, English, or mixed), it's checked for toxicity
4. **Moderation**: The comment is analyzed using OpenAI Moderation API (supports multiple languages)
5. **Filtering**: If toxic, the comment is flagged and hidden from public view
6. **Author View**: Blog authors can see all comments, including flagged ones (toggle "Author View" button)
7. **Reporting**: Authors can report users who posted inappropriate comments (stored in Supabase)
8. **Report Tracking**: User report counts are tracked in the database and incremented on each report
9. **Notifications**: Users receive toast notifications when their comment is flagged

## Testing the Moderation

Try posting comments with:

- English toxic words: "hate", "stupid", "idiot"
- Hindi toxic words (transliterated): "bewakoof", "chutiya", "gadha"
- Mixed language content

The system will flag inappropriate content and show a toast notification.

## Database Setup

This project uses **Supabase** (PostgreSQL) for:

- User authentication
- User profiles with report counts
- Report tracking

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed setup instructions.

## Next Steps

- [x] Set up database (Supabase/PostgreSQL)
- [x] Implement user authentication
- [ ] Connect blog posts to database
- [ ] Connect comments to database
- [ ] Add image uploads for blog posts
- [ ] Add user profile pages
- [ ] Add admin dashboard for managing reports

## Technologies Used

- React.js
- React Router
- Supabase (PostgreSQL + Authentication)
- OpenAI Moderation API (for content moderation - supports Hindi, English, and many other languages)
- CSS3

## License

MIT
