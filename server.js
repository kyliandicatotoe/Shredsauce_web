const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.raw({ type: '*/*', limit: '50mb' }));

app.all('/ext-proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url');
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      headers: { 'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0' },
      validateStatus: () => true
    });
    if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).send(Buffer.from(response.data));
  } catch (e) {
    return res.status(502).send('External proxy error');
  }
});

app.use(async (req, res) => {
  try {
    const targetUrl = `https://shredsauce.com${req.originalUrl}`;
    const forwardHeaders = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      Referer: 'https://shredsauce.com',
      Origin: 'https://shredsauce.com'
    };

    if (req.headers.range) forwardHeaders.Range = req.headers.range;
    if (req.headers['content-type']) forwardHeaders['Content-Type'] = req.headers['content-type'];
    if (req.headers.cookie) forwardHeaders.Cookie = req.headers.cookie;

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
      if (lower === 'set-cookie' && Array.isArray(value)) {
        const fixedCookies = value.map(c => c.replace(/;\s*Domain=[^;]+/gi, ''));
        res.setHeader('Set-Cookie', fixedCookies);
      } else if (!['transfer-encoding', 'connection', 'content-security-policy', 'content-encoding', 'content-length'].includes(lower)) {
        res.setHeader(key, value);
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (contentType.includes('text/html')) {
      let html = Buffer.from(response.data).toString('utf8');
      html = html.replace(/https?:\/\/(www\.)?shredsauce\.com/g, myHost);

      const interceptor = `
        <script>
          (function() {
            const myHost = "${myHost}";
            const rewrite = (url) => {
              if (typeof url !== 'string') return url;
              if (/^https?:\\/\\/(www\\.)?shredsauce\\.com/i.test(url)) {
                return url.replace(/^https?:\\/\\/(www\\.)?shredsauce\\.com/i, myHost);
              }
              if (/^https?:\\/\\//i.test(url) && !url.startsWith(myHost)) {
                return myHost + '/ext-proxy?url=' + encodeURIComponent(url);
              }
              return url;
            };
            const origFetch = window.fetch;
            window.fetch = function(input, init) {
              if (typeof input === 'string') input = rewrite(input);
              else if (input instanceof Request) input = new Request(rewrite(input.url), input);
              return origFetch.call(this, input, init);
            };
            const origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
              return origOpen.call(this, method, rewrite(url), ...rest);
            };
          })();
        </script>
      `;
      html = html.replace('<head>', `<head>${interceptor}`);
      return res.status(response.status).send(html);
    }

    if (contentType.includes('javascript') || contentType.includes('json')) {
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
