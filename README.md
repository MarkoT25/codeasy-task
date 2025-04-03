
# Tourist Guide Backend

A backend service for a tourist guide application that provides APIs to find nearest routes and points within a viewport.



## Features

- Find nearest routes to a specified location
- Find points of interest within a map viewport


## Prerequisites

- Node.js (v16+)
- npm
## Installation

1. Clone the repository

```bash
  git clone https://github.com/MarkoT25/codeasy-task.git
```
2. Install dependencies
```bash
   npm install
```

3. Create a `.env` file (optional)
```bash
   PORT=3000
``` 
## Running the Application

Development mode:
```
npm run dev
```

Production mode:
```
npm run build
npm start
```
## API Endpoints

### Find Nearest Routes

```
GET /api/findNearestRoutes?lng={longitude}&lat={latitude}&count={count}
```

Parameters:
- `lng`: Longitude coordinate
- `lat`: Latitude coordinate
- `count` (optional): Number of routes to return (default: 10)

Example:
```
GET /api/findNearestRoutes?lng=15.9819&lat=45.8150&count=5
```

### Find Points in Viewport

```
GET /api/findPointsInViewport?lng1={longitude1}&lat1={latitude1}&lng2={longitude2}&lat2={latitude2}
```

Parameters:
- `lng1`: Longitude of the first corner
- `lat1`: Latitude of the first corner
- `lng2`: Longitude of the second corner
- `lat2`: Latitude of the second corner

Example:
```
GET /api/findPointsInViewport?lng1=16.37&lat1=43.48&lng2=16.52&lat2=43.55
```
