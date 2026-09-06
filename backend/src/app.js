import express from 'express';
import cors from 'cors';
import resumeRoutes from './routes/resumeRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import careerRoutes from './routes/careerRoutes.js';
import { analyzeJobDescription } from './controllers/jobController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'PlaceNexus API is healthy' });
});

app.use('/resume', resumeRoutes);
app.post('/analyze', analyzeJobDescription);
app.use('/job', jobRoutes);
app.use('/career', careerRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
