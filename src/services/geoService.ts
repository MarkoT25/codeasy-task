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

                // Force convert all coordinates to numbers and validate the structure
                const cleanCoordinates = this.ensureNumericCoordinates(region.geometry.coordinates);
                if (!cleanCoordinates) continue;

                try {
                    // Create a new polygon with guaranteed numeric coordinates
                    const polygon = turf.polygon(cleanCoordinates);

                    // Check if user is inside the polygon
                    if (turf.booleanPointInPolygon(userPoint, polygon)) {
                        return 0; // User is inside the polygon
                    }

                    // Manual distance calculation as a fallback
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

    // Helper method to ensure all coordinates are proper numbers
    private ensureNumericCoordinates(coordinates: any): number[][][] | null {
        if (!Array.isArray(coordinates)) return null;

        try {
            const result: number[][][] = [];

            for (const ring of coordinates) {
                if (!Array.isArray(ring)) continue;

                const cleanRing: number[][] = [];

                for (const point of ring) {
                    if (!Array.isArray(point) || point.length < 2) continue;

                    // Explicitly convert to numbers and validate
                    const x = Number(point[0]);
                    const y = Number(point[1]);

                    if (isNaN(x) || isNaN(y)) continue;

                    cleanRing.push([x, y]);
                }

                // Ensure ring is closed
                if (cleanRing.length >= 3) {
                    const first = cleanRing[0];
                    const last = cleanRing[cleanRing.length - 1];

                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        // Close the ring by adding the first point at the end
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

    // Manually calculate the minimum distance to a polygon without relying on complex turf functions
    private calculateMinimumDistanceManually(userPoint: Feature<GeoJSONPoint>, polygonCoordinates: number[][][]): number {
        const userCoords = userPoint.geometry.coordinates;
        let minDistance = Infinity;

        // For each ring in the polygon
        for (const ring of polygonCoordinates) {
            // For each line segment in the ring
            for (let i = 0; i < ring.length - 1; i++) {
                const p1 = ring[i];
                const p2 = ring[i + 1];

                // Calculate distance from point to line segment
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
        const x = point[0];
        const y = point[1];
        const x1 = lineStart[0];
        const y1 = lineStart[1];
        const x2 = lineEnd[0];
        const y2 = lineEnd[1];

        // If line segment is actually a point
        if (x1 === x2 && y1 === y2) {
            return this.haversineDistance([x, y], [x1, y1]);
        }

        // Calculate projection
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return this.haversineDistance([x, y], [xx, yy]);
    }

    // Calculate haversine distance (great-circle distance on earth)
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
            if (!Array.isArray(ring) || ring.length < 4) return false; // Need at least 4 points for a closed ring

            for (const point of ring) {
                if (!Array.isArray(point) || point.length < 2) return false;
                if (typeof point[0] !== 'number' || typeof point[1] !== 'number') return false;
                if (isNaN(point[0]) || isNaN(point[1])) return false;
            }

            // Check if ring is closed (first point equals last point)
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

            // Use a Map to track unique points by ID
            const uniquePointsMap = new Map<string | number, Point>();

            routes.forEach(route => {
                route.pointsOnRoutes.forEach(pointOnRoute => {
                    try {
                        const point = pointOnRoute.point;

                        // Skip if we already have this point (by ID)
                        if (point.id && uniquePointsMap.has(point.id)) {
                            return;
                        }

                        if (this.isPointInViewport(point, bboxPolygon)) {
                            // Add to the map using ID as key
                            if (point.id) {
                                uniquePointsMap.set(point.id, point);
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking point in viewport:`, error);
                    }
                });
            });

            // Convert the map values to an array
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