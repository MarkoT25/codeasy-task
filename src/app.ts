import express from 'express';
import cors from "cors";
import dotenv from 'dotenv';
import { RouteController } from './controllers/routeController';
import { GeoService } from './services/geoService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const geoService = new GeoService();
const routeController = new RouteController(geoService);

app.use(cors());  
app.use(express.json()); 

app.get('/api/findNearestRoutes', routeController.findNearestRoutes);
app.get('/api/findPointsInViewport', routeController.findPointsInViewport);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Servis is active and running!');
});

app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});