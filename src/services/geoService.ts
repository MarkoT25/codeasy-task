import { Point, Route } from '../models/types';
import { BBox, Polygon, Feature, Point as GeoJSONPoint } from 'geojson';
import { DataService } from './dataService';
import * as turf from '@turf/turf';

export class GeoService {
    private dataService: DataService;

    constructor() {
        this.dataService = DataService.getInstance();
    }

    // Getting the closest routes to the user coordinates
    public async findNearestRoutes(lng: number, lat: number, count: number = 1): Promise<Route[]> {
        try {
            const routes = await this.dataService.getRoutes();
            const userPoint = turf.point([lng, lat]);

            const routesWithDistance = routes.map(route => {
                try {
                    const distance = this.calculateDistanceToRoute(route, userPoint);
                    return { route, distance };
                } catch (error) {
                    console.error(`Error calculating distance for route ${route.id}:`, error);
                    return { route, distance: Infinity };
                }
            });

            routesWithDistance.sort((a, b) => a.distance - b.distance);

            return routesWithDistance.slice(0, count).map(item => item.route);
        } catch (error) {
            console.error('Error in findNearestRoutes:', error);
            throw error;
        }
    }

    private calculateDistanceToRoute(route: Route, userPoint: Feature<GeoJSONPoint>): number {
        let minDistance = Infinity;

        for (const pointOnRoute of route.pointsOnRoutes) {
            try {
                const point = pointOnRoute.point;
                const region = point.region;

                if (!region?.geometry?.coordinates) continue;

                // Convert all coordinates to numbers and validate the structure
                const cleanCoordinates = this.ensureNumericCoordinates(region.geometry.coordinates);
                if (!cleanCoordinates) continue;

                try {
                    const polygon = turf.polygon(cleanCoordinates);

                    // Check if user is inside the polygon
                    if (turf.booleanPointInPolygon(userPoint, polygon)) {
                        return 0; // User is inside the polygon
                    }

                    const distance = this.calculateMinimumDistanceManually(userPoint, cleanCoordinates);
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                } catch (e) {
                    console.error('Error working with polygon:', e);
                }
            } catch (error) {
                console.error('Error processing point on route:', error);
                continue;
            }
        }
        return minDistance;
    }

    // Check if coordinates are valid and convert to numbers
    private ensureNumericCoordinates(coordinates: number[][][]): number[][][] | null {
        if (!Array.isArray(coordinates)) return null;

        try {
            const result: number[][][] = [];

            for (const ring of coordinates) {
                if (!Array.isArray(ring)) continue;

                const cleanRing: number[][] = [];

                for (const point of ring) {
                    if (!Array.isArray(point) || point.length < 2) continue;

                    const x = Number(point[0]);
                    const y = Number(point[1]);

                    if (isNaN(x) || isNaN(y)) continue;

                    cleanRing.push([x, y]);
                }

                if (cleanRing.length >= 3) {
                    const first = cleanRing[0];
                    const last = cleanRing[cleanRing.length - 1];

                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        cleanRing.push([first[0], first[1]]);
                    }

                    if (cleanRing.length >= 4) {
                        result.push(cleanRing);
                    }
                }
            }

            return result.length > 0 ? result : null;
        } catch (error) {
            console.error('Error ensuring numeric coordinates:', error);
            return null;
        }
    }

    // Calculate the minimum distance to a polygon 
    private calculateMinimumDistanceManually(userPoint: Feature<GeoJSONPoint>, polygonCoordinates: number[][][]): number {
        const userCoords = userPoint.geometry.coordinates;
        let minDistance = Infinity;

        for (const ring of polygonCoordinates) {
            for (let i = 0; i < ring.length - 1; i++) {
                const p1 = ring[i];
                const p2 = ring[i + 1];

                const distance = this.pointToLineDistance(userCoords, p1, p2);

                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
        }

        return minDistance;
    }

    // Calculate distance from a point to a line segment
    private pointToLineDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
        const pointLng = point[0];
        const pointLat = point[1];
        const startLng = lineStart[0];
        const startLat = lineStart[1];
        const endLng = lineEnd[0];
        const endLat = lineEnd[1];
    
        if (startLng === endLng && startLat === endLat) {
            return this.haversineDistance([pointLng, pointLat], [startLng, startLat]);
        }
    
        const lngDiffPoint = pointLng - startLng;
        const latDiffPoint = pointLat - startLat;
        const lngDiffLine = endLng - startLng;
        const latDiffLine = endLat - startLat;
    
        const dotProduct = lngDiffPoint * lngDiffLine + latDiffPoint * latDiffLine;
        const lineLengthSquared = lngDiffLine * lngDiffLine + latDiffLine * latDiffLine;
        let projectionFactor = -1;
    
        if (lineLengthSquared !== 0) projectionFactor = dotProduct / lineLengthSquared;
    
        let nearestLng, nearestLat;
    
        if (projectionFactor < 0) {
            nearestLng = startLng;
            nearestLat = startLat;
        } else if (projectionFactor > 1) {
            nearestLng = endLng;
            nearestLat = endLat;
        } else {
            nearestLng = startLng + projectionFactor * lngDiffLine;
            nearestLat = startLat + projectionFactor * latDiffLine;
        }
    
        return this.haversineDistance([pointLng, pointLat], [nearestLng, nearestLat]);
    }

    // Calculate haversine distance 
    private haversineDistance(point1: number[], point2: number[]): number {
        const [lon1, lat1] = point1;
        const [lon2, lat2] = point2;

        const R = 6371; // Earth radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRadians(degrees: number): number {
        return degrees * Math.PI / 180;
    }

    private isValidPolygonCoordinates(coordinates: number[][][]): boolean {
        if (!Array.isArray(coordinates) || coordinates.length === 0) return false;

        for (const ring of coordinates) {
            // Need at least 4 points for a closed ring
            if (!Array.isArray(ring) || ring.length < 4) return false; 

            for (const point of ring) {
                if (!Array.isArray(point) || point.length < 2) return false;
                if (typeof point[0] !== 'number' || typeof point[1] !== 'number') return false;
                if (isNaN(point[0]) || isNaN(point[1])) return false;
            }

            const first = ring[0];
            const last = ring[ring.length - 1];
            if (!this.arePointsEqual(first, last)) return false;
        }
        return true;
    }

    private arePointsEqual(p1: number[], p2: number[]): boolean {
        return p1[0] === p2[0] && p1[1] === p2[1];
    }

    // Finding points in the viewport defined by two coordinates
    public async findPointsInViewport(lng1: number, lat1: number, lng2: number, lat2: number): Promise<Point[]> {
        try {
            const routes = await this.dataService.getRoutes();
            const bbox: BBox = [Math.min(lng1, lng2), Math.min(lat1, lat2), Math.max(lng1, lng2), Math.max(lat1, lat2)];
            const bboxPolygon = turf.bboxPolygon(bbox);

            const uniquePointsMap = new Map<string | number, Point>();

            routes.forEach(route => {
                route.pointsOnRoutes.forEach(pointOnRoute => {
                    try {
                        const point = pointOnRoute.point;

                        if (point.id && uniquePointsMap.has(point.id)) {
                            return;
                        }

                        if (this.isPointInViewport(point, bboxPolygon)) {
                            if (point.id) {
                                uniquePointsMap.set(point.id, point);
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking point in viewport:`, error);
                    }
                });
            });

            return Array.from(uniquePointsMap.values());
        } catch (error) {
            console.error('Error in findPointsInViewport:', error);
            throw error;
        }
    }

    private isPointInViewport(point: Point, bboxPolygon: Feature<Polygon>): boolean {
        try {
            const region = point.region;
            if (region?.geometry?.type === 'Polygon' && this.isValidPolygonCoordinates(region.geometry.coordinates)) {
                const polygon = turf.polygon(region.geometry.coordinates);
                return turf.booleanIntersects(polygon, bboxPolygon);
            }
            return false;
        } catch (error) {
            console.error('Error in isPointInViewport:', error);
            return false;
        }
    }
}