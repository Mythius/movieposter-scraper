const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 2525;

app.use(express.json());

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Cache file path
const cacheFilePath = path.join(__dirname, 'movie-cache.json');

// Load cache from file or create empty cache
function loadCache() {
  try {
    if (fs.existsSync(cacheFilePath)) {
      const data = fs.readFileSync(cacheFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cache:', error.message);
  }
  return {};
}

// Save cache to file
function saveCache(cache) {
  try {
    fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error.message);
  }
}

// Initialize cache
let movieCache = loadCache();

// Function to search for movie on TMDB (using their website)
async function searchMovie(movieName) {
  try {
    const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(movieName)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    // Find the first movie result
    const firstResult = $('.card.v4.tight').first();
    const posterPath = firstResult.find('img.poster').attr('src');

    if (posterPath) {
      // TMDB uses relative paths, convert to full URL
      let fullPosterUrl = posterPath;
      if (posterPath.startsWith('//')) {
        fullPosterUrl = 'https:' + posterPath;
      } else if (posterPath.startsWith('/')) {
        fullPosterUrl = 'https://www.themoviedb.org' + posterPath;
      }

      // Get high-resolution version - replace any size variant with 'original'
      fullPosterUrl = fullPosterUrl.replace(/\/w\d+_and_h\d+_[a-z0-9]+/i, '/original');

      return fullPosterUrl;
    }

    return null;
  } catch (error) {
    console.error('Error searching movie:', error.message);
    throw error;
  }
}

// Function to download image
async function downloadImage(imageUrl, filename) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const filepath = path.join(downloadsDir, filename);
    fs.writeFileSync(filepath, response.data);

    return filepath;
  } catch (error) {
    console.error('Error downloading image:', error.message);
    throw error;
  }
}

// Main endpoint to get movie poster
app.get('/poster', async (req, res) => {
  try {
    const { movie } = req.query;

    if (!movie) {
      return res.status(400).json({ error: 'Movie name is required. Use ?movie=YourMovieName' });
    }

    console.log(`Searching for movie: ${movie}`);

    // Normalize movie name for cache key (case-insensitive)
    const cacheKey = movie.toLowerCase().trim();

    // Check cache first
    let filepath = movieCache[cacheKey];

    if (filepath && fs.existsSync(filepath)) {
      console.log(`Found in cache: ${filepath}`);
    } else {
      // Search for the movie if not in cache
      const posterUrl = await searchMovie(movie);

      if (!posterUrl) {
        return res.status(404).json({ error: 'Movie poster not found' });
      }

      console.log(`Found poster URL: ${posterUrl}`);

      // Generate filename (without timestamp for consistency)
      const sanitizedMovieName = movie.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${sanitizedMovieName}.jpg`;

      // Download the image
      filepath = await downloadImage(posterUrl, filename);

      console.log(`Poster saved to: ${filepath}`);

      // Save filepath to cache
      movieCache[cacheKey] = filepath;
      saveCache(movieCache);
      console.log('Cached for future requests');
    }

    // Send the image file
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ error: 'Error sending file' });
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching the poster', details: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Movie Poster Scraper API',
    usage: 'GET /poster?movie=MovieName',
    example: 'GET /poster?movie=Inception'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Usage: GET http://localhost:${PORT}/poster?movie=YourMovieName`);
});
