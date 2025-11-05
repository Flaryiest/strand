import express from 'express';

const api = express.Router();

api.get('/test', (req, res) => {
  res.send('API is working properly');
});

export default api;
