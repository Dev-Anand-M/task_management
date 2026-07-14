// Vercel Serverless Function - AI API Proxy
// Handles CORS and routes requests to AI providers

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers - must be set first
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-API-Key, X-Provider'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log(`[AI Proxy] Method ${req.method} not allowed`);
    return res.status(405).json({ 
      error: 'Method not allowed', 
      method: req.method,
      allowedMethods: ['POST'] 
    });
  }

  // Auth verification - require valid Supabase session
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const sb = createClient(supabaseUrl, supabaseKey);
      const { data: { user }, error } = await sb.auth.getUser(authHeader.split(' ')[1]);
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
    } catch (authError) {
      console.error('[AI Proxy] Auth verification failed:', authError.message);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }

  try {
    console.log('[AI Proxy] Received request:', {
      method: req.method,
      headers: req.headers,
      bodyKeys: Object.keys(req.body || {})
    });

    const { provider, endpoint, apiKey, body: requestBody, method = 'POST' } = req.body || {};

    if (!provider || !endpoint || !apiKey) {
      console.log('[AI Proxy] Missing required fields:', { provider: !!provider, endpoint: !!endpoint, apiKey: !!apiKey });
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { provider: !!provider, endpoint: !!endpoint, apiKey: !!apiKey },
        received: req.body
      });
    }

    // Provider base URLs
    const providerUrls = {
      gemini: 'https://generativelanguage.googleapis.com',
      openai: 'https://api.openai.com',
      anthropic: 'https://api.anthropic.com',
      perplexity: 'https://api.perplexity.ai',
      sambanova: 'https://api.sambanova.ai',
      groq: 'https://api.groq.com',
      hcnsec: 'https://api.hcnsec.cn'
    };

    const baseUrl = providerUrls[provider];
    if (!baseUrl) {
      console.log(`[AI Proxy] Invalid provider: ${provider}`);
      return res.status(400).json({ error: `Invalid provider: ${provider}`, validProviders: Object.keys(providerUrls) });
    }

    // Build headers
    const headers = {
      'Content-Type': 'application/json'
    };

    let url = `${baseUrl}${endpoint}`;

    // Provider-specific auth
    if (provider === 'gemini') {
      // Gemini uses query param
      url = `${url}?key=${apiKey}`;
    } else if (provider === 'openai' || provider === 'perplexity' || provider === 'sambanova' || provider === 'groq' || provider === 'hcnsec') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }

    console.log(`[AI Proxy] Making ${provider.toUpperCase()} request to ${endpoint}`);

    // Make the request
    const response = await fetch(url, {
      method,
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined
    });

    console.log(`[AI Proxy] ${provider} response status:`, response.status);

    // Handle response
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log(`[AI Proxy] Non-JSON response from ${provider}:`, text.substring(0, 200));
      data = { error: 'Non-JSON response', body: text.substring(0, 500) };
    }

    if (!response.ok) {
      console.error(`[AI Proxy] ${provider} error:`, response.status, data);
      return res.status(response.status).json(data);
    }

    console.log(`[AI Proxy] ${provider} success, returning data`);
    return res.status(200).json(data);

  } catch (error) {
    console.error('[AI Proxy] Error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
