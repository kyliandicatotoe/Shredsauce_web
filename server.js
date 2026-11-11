import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.static('public'));

app.get('/start-game', async (req, res) => {
  try {
    const response = await axios.post(
      'https://hyperbeam.com',
      { start_url: 'https://shredsauce.com' },
      { headers: { Authorization: `Bearer ${process.env.HB_API_KEY}` } }
    );
    res.json({ url: response.data.embed_url });
  } catch (error) {
    res.status(500).json({
      status: error.response?.status,
      details: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
