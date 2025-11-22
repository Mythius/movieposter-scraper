# Movie Poster Scraper

A simple Express API that scrapes movie posters from TMDB and returns the image file.

## Features

- Search for movies by name (handles partial/fuzzy matches)
- Downloads high-resolution poster images
- Returns image files directly via API
- Saves posters locally in `downloads/` folder

## Installation

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### Get Movie Poster

```
GET /poster?movie=MovieName
```

**Parameters:**
- `movie` (required) - The name of the movie (can be partial)

**Example:**

```bash
curl "http://localhost:3000/poster?movie=Inception" --output inception.jpg
```

Or visit in browser:
```
http://localhost:3000/poster?movie=Inception
```

**Response:**
- Returns the poster image file (JPG)
- Image is also saved in the `downloads/` folder

### Health Check

```
GET /
```

Returns API information and usage instructions.

## Examples

```bash
# Get poster for "The Matrix"
curl "http://localhost:3000/poster?movie=The Matrix" --output matrix.jpg

# Get poster with partial name
curl "http://localhost:3000/poster?movie=dark knight" --output batman.jpg

# Get poster for "Interstellar"
curl "http://localhost:3000/poster?movie=Interstellar" --output interstellar.jpg
```

## Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Dependencies

- **express** - Web framework
- **axios** - HTTP client for requests
- **cheerio** - HTML parsing and scraping
