// GeoJSON types
export interface Geometry {
    type: "Polygon";
    coordinates: number[][][];
}

export interface GeoJSONFeature {
    type: "Feature";
    geometry: Geometry;
    properties?: {
        center?: number[];
        radius?: number;
    };
}

export interface Region {
    type: "Feature";
    geometry: Geometry;
    properties: {
        center: number[];
        radius: number;
    };
}

// Main
export interface Point {
    id: number;
    createdAt: string;
    region: Region;
}

export interface Route {
    id: number;
    createdAt: string;
    pointsOnRoutes: { point: Point }[];
}