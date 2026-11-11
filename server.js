const express = require('express');
const axios = require('axios');

const app = express();

app.use(async (req, res) => {
  try {
    const targetUrl = `https://shredsauce.com${req.originalUrl}`;
    const response = await axios({
      method: req.method,
      url: targetUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        Referer: 'https://shredsauce.com',
        Origin: 'https://shredsauce.com'
      },
      decompress: false,
      validateStatus: () => true
    });

    Object.entries(response.headers).forEach(([key, value]) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);
    response.data.pipe(res);
  } catch (error) {
    res.status(502).send('Stream error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
