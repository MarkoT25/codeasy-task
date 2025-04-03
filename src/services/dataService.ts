import axios from 'axios';
import { Route } from '../models/types';

export class DataService {
    private static instance: DataService;

    private cachedData: Route[] | null = null;
    private lastFetchTime: number = 0;
    private readonly CACHE_TTL = 1000 * 60 * 10; // 10 minuta

    private constructor() { }

    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
    }

    // Getting routes with caching (10 minutes)
    public async getRoutes(): Promise<Route[]> {
        const currentTime = Date.now();

        if (this.cachedData && currentTime - this.lastFetchTime < this.CACHE_TTL) {
            return this.cachedData;
        }

        try {
            const response = await axios.get('http://chat.codeasy.com/api/public/job-application');
            this.cachedData = response.data as Route[];
            this.lastFetchTime = currentTime;
            return this.cachedData;
        } catch (error) {
            console.error('Greška pri dohvaćanju podataka:', error);

            //If the data is not available, return the cached data if it exists
            if (this.cachedData) {
                return this.cachedData;
            }

            throw new Error('Unable to fetch data and no cached data available.');
        }
    }
}