const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful customer service assistant. Answer questions politely and redirect off-topic queries back to relevant topics.';

const config = {
  apiUrl: process.env.LLM_API_URL || '',
  authToken: process.env.LLM_AUTH_TOKEN || '',
  contentType: process.env.LLM_CONTENT_TYPE || 'application/json',
  model: process.env.LLM_MODEL || '',
  systemPrompt: process.env.LLM_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    chatConfigured: Boolean(config.apiUrl && config.model),
  });
});

app.get('/api/chat/status', (_req, res) => {
  res.json({
    configured: Boolean(config.apiUrl && config.model),
    model: config.model || null,
  });
});

app.post('/api/chat', async (req, res) => {
  if (!config.apiUrl || !config.model) {
    return res.status(503).json({
      error: 'Chat service is not configured. Set LLM_API_URL and LLM_MODEL in the ConfigMap.',
    });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const llmMessages = [
    { role: 'system', content: config.systemPrompt },
    ...messages.filter((m) => m.role && m.content),
  ];

  const headers = {
    'Content-Type': config.contentType,
    Accept: 'text/event-stream',
  };

  if (config.authToken) {
    headers.Authorization = config.authToken.startsWith('Bearer ')
      ? config.authToken
      : `Bearer ${config.authToken}`;
  }

  try {
    const upstream = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: llmMessages,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      return res.status(upstream.status).json({
        error: `LLM API error (${upstream.status})`,
        detail: body.slice(0, 500),
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
        res.end();
      } catch (err) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      }
    };

    req.on('close', () => reader.cancel());
    pump();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to reach LLM API', detail: err.message });
    }
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App listening on port ${PORT}`);
  console.log(`Chat configured: ${Boolean(config.apiUrl && config.model)}`);
  if (config.model) console.log(`LLM model: ${config.model}`);
});
