import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import api from './routes/api.routes.js';
import auth from './routes/auth.routes.js';
const app = express();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', api);
app.use('/auth', auth);

app.listen(port, () => {
  console.log('Server is running on port: ' + String(port));
});

export default app;
