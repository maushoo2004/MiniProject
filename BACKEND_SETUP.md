# Backend Proxy Server Setup

## Why a Backend Proxy?

The Hugging Face API doesn't allow direct browser requests due to CORS (Cross-Origin Resource Sharing) restrictions. The backend proxy server solves this by:

- ✅ Making API calls server-side (where CORS doesn't apply)
- ✅ Securely handling API keys (never exposed to browser)
- ✅ Reliable and production-ready

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install:

- `express` - Web server framework
- `cors` - CORS middleware
- `node-fetch` - HTTP client for Node.js
- `concurrently` - Run multiple commands simultaneously

### 2. Run Both Servers

**Option A: Run both servers together (Recommended)**

```bash
npm run dev
```

This starts:

- Backend proxy server on `http://localhost:3001`
- React frontend on `http://localhost:3000`

**Option B: Run servers separately**

Terminal 1 (Backend):

```bash
npm run server
```

Terminal 2 (Frontend):

```bash
npm start
```

### 3. Verify Backend is Running

Open `http://localhost:3001/api/health` in your browser. You should see:

```json
{ "status": "ok", "message": "Backend proxy server is running" }
```

## Environment Variables

Make sure you have a `.env` file in the root directory with:

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_key
REACT_APP_HUGGINGFACE_API_KEY=hf_your_token_here
REACT_APP_BACKEND_URL=http://localhost:3001
```

**Note:** `REACT_APP_BACKEND_URL` is optional - defaults to `http://localhost:3001` if not set.

## How It Works

1. **Frontend** (React app) makes requests to your backend proxy
2. **Backend** (Express server) forwards requests to Hugging Face API
3. **Hugging Face** processes the request and returns results
4. **Backend** forwards the response back to frontend

This way, the API key stays on the server and CORS is never an issue!

## API Endpoints

### Health Check

```
GET /api/health
```

### Moderation (Toxicity Detection)

```
POST /api/moderation
Body: { text: "comment text", apiKey: "hf_..." }
```

### Rephrasing (AI Suggestions)

```
POST /api/rephrase
Body: { text: "comment text", apiKey: "hf_...", isHindi: false }
```

## Troubleshooting

### Backend won't start

- Make sure port 3001 is not in use
- Check that all dependencies are installed: `npm install`

### CORS errors still appearing

- Verify backend is running on port 3001
- Check browser console for the actual error
- Make sure `REACT_APP_BACKEND_URL` is set correctly (or using default)

### API calls failing

- Verify your Hugging Face API key is correct
- Check backend server logs for detailed error messages
- Make sure the backend server is running before starting the frontend

## Production Deployment

For production, you'll need to:

1. Deploy the backend server (e.g., Heroku, Railway, Render)
2. Update `REACT_APP_BACKEND_URL` to your production backend URL
3. Set environment variables on your hosting platform

Example production `.env`:

```env
REACT_APP_BACKEND_URL=https://your-backend.herokuapp.com
```

