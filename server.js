const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.raw({ type: '*/*', limit: '50mb' }));

app.use(async (req, res) => {
  try {
    const targetUrl = `https://shredsauce.com${req.originalUrl}`;
    const forwardHeaders = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      Referer: 'https://shredsauce.com',
      Origin: 'https://shredsauce.com'
    };

    if (req.headers.range) {
      forwardHeaders.Range = req.headers.range;
    }
    if (req.headers['content-type']) {
      forwardHeaders['Content-Type'] = req.headers['content-type'];
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      headers: forwardHeaders,
      decompress: true,
      validateStatus: () => true
    });

    const contentType = (response.headers['content-type'] || '').toLowerCase();
    const myHost = `https://${req.get('host')}`;

    Object.entries(response.headers).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      if (!['transfer-encoding', 'connection', 'content-security-policy', 'content-encoding', 'content-length'].includes(lower)) {
        res.setHeader(key, value);
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Rewrite hardcoded shredsauce.com URLs inside HTML and JS files so everything routes through Render
    if (contentType.includes('text/html') || contentType.includes('javascript') || contentType.includes('json')) {
      let text = Buffer.from(response.data).toString('utf8');
      text = text.replace(/https?:\/\/(www\.)?shredsauce\.com/g, myHost);
      return res.status(response.status).send(text);
    }

    res.status(response.status).send(Buffer.from(response.data));
  } catch (error) {
    res.status(502).send('Proxy error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
