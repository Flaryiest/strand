import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import api from './routes/api.routes.js';
import auth from './routes/auth.routes.js';
import chat from './routes/chat.routes.js';
import maps from './routes/maps.routes.js';
const app = express();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header)
      if (!origin) return callback(null, true);

      const allowedExact = new Set([
        'http://localhost:5173',
        'https://usestrand.space',
        'https://www.usestrand.space',
        'https://backend.usestrand.space'
      ]);

      if (allowedExact.has(origin)) return callback(null, true);
      if (origin.endsWith('.usestrand.space')) return callback(null, true);

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', api);
app.use('/auth', auth);
app.use('/chat', chat);
app.use('/maps', maps);

app.listen(port, () => {
  console.log('Server is running on port: ' + String(port));
});

export default app;
