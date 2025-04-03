import { Request, Response } from 'express';
import { GeoService } from '../services/geoService';

export class RouteController {
    private _geoService: GeoService;

    constructor(geoService: GeoService) {
        this._geoService = geoService;
    }

    public findNearestRoutes = async (req: Request, res: Response): Promise<void> => {
        try {
            const lng = parseFloat(req.query.lng as string);
            const lat = parseFloat(req.query.lat as string);
            const count = req.query.count ? parseInt(req.query.count as string) : 10;

            if (isNaN(lng) || isNaN(lat)) {
                res.status(400).json({ error: 'Incorrect latitude and longitude parameters' });
                return;
            }

            if (isNaN(count) || count <= 0) {
                res.status(400).json({ error: 'Invalid counting parameter' });
                return;
            }

            const routes = await this._geoService.findNearestRoutes(lng, lat, count);
            res.status(200).json({ routes });
        } catch (error) {
            console.error('Error in findNearestRoutes', error);
            res.status(500).json({ error: 'Error while finding nearest routes.' });
        }
    };


    public findPointsInViewport = async (req: Request, res: Response): Promise<void> => {
        try {
            const lng1 = parseFloat(req.query.lng1 as string);
            const lat1 = parseFloat(req.query.lat1 as string);
            const lng2 = parseFloat(req.query.lng2 as string);
            const lat2 = parseFloat(req.query.lat2 as string);

            if (isNaN(lng1) || isNaN(lat1) || isNaN(lng2) || isNaN(lat2)) {
                res.status(400).json({ error: 'Invalid viewport parameters.' });
                return;
            }

            const points = await this._geoService.findPointsInViewport(lng1, lat1, lng2, lat2);
            res.status(200).json({ points });
        } catch (error) {
            console.error('Error in findPointsInViewport:', error);
            res.status(500).json({ error: 'Error in finding point in viewport.' });
        }
    };
}