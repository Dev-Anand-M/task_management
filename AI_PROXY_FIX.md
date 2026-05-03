# AI Proxy Fix - Deployment CORS Solution

## Problem
The app was experiencing `ERR_CONNECTION_CLOSED` errors in production because:
1. Direct browser-to-AI-provider API calls are blocked by CORS
2. AI providers (Gemini, OpenAI, Anthropic, Perplexity, SambaNova) don't allow browser requests
3. API keys stored in localStorage are a security risk

## Solution Implemented
Created a Vercel serverless function proxy to handle AI API requests securely.

### Files Modified

#### 1. `/api/ai-proxy.js` (NEW)
- Serverless function that proxies requests to AI providers
- Handles CORS properly
- Supports all 5 AI providers (Gemini, OpenAI, Anthropic, Perplexity, SambaNova)
- Provider-specific authentication handling

#### 2. `/src/services/aiService.js` (MODIFIED)
- Added `callAIProxy()` helper function
- Updated `generateContent()` to route all requests through the proxy
- Updated `validateAPIKey()` to use the proxy for validation
- All direct fetch() calls to AI providers now go through `/api/ai-proxy`

#### 3. `/vercel.json` (MODIFIED)
- Added API route handling to ensure `/api/*` requests go to serverless functions
- Maintains SPA routing for all other paths

## How It Works

### Before (Direct Calls - FAILED)
```
Browser → AI Provider API (BLOCKED by CORS)
```

### After (Proxy - WORKS)
```
Browser → /api/ai-proxy → AI Provider API ✓
```

## Testing Locally

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Run locally with Vercel dev server:
   ```bash
   vercel dev
   ```

3. Test AI features in the app at `http://localhost:3000`

## Deployment

1. Commit changes:
   ```bash
   git add .
   git commit -m "fix: Add serverless proxy for AI API calls to resolve CORS issues"
   ```

2. Push to trigger Vercel deployment:
   ```bash
   git push
   ```

3. Vercel will automatically:
   - Deploy the serverless function to `/api/ai-proxy`
   - Build and deploy the frontend
   - Route requests correctly

## Security Notes

- API keys are still stored in localStorage (client-side)
- For production, consider:
  - Moving API keys to environment variables on Vercel
  - Storing encrypted keys in Supabase
  - Implementing rate limiting on the proxy
  - Adding authentication to the proxy endpoint

## API Proxy Endpoint

**Endpoint:** `POST /api/ai-proxy`

**Request Body:**
```json
{
  "provider": "gemini|openai|anthropic|perplexity|sambanova",
  "endpoint": "/v1/...",
  "apiKey": "your-api-key",
  "body": { /* provider-specific request body */ },
  "method": "POST"
}
```

**Response:**
- Success: Returns the AI provider's response
- Error: Returns error details with appropriate status code

## Next Steps

1. ✅ Fix CSS build errors (unrelated to proxy)
2. ✅ Test all AI features after deployment
3. 🔄 Consider moving API keys to server-side storage
4. 🔄 Add rate limiting to prevent abuse
5. 🔄 Add request logging for debugging

## Troubleshooting

### If AI requests still fail:
1. Check browser console for errors
2. Check Vercel function logs
3. Verify API keys are still valid
4. Test the proxy endpoint directly with curl/Postman

### Common Issues:
- **401 Unauthorized**: Invalid API key
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Check Vercel function logs
