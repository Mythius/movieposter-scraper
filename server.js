const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 2525;

app.use(express.json());

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Serve static files from public directory
app.use('/public', express.static(publicDir));

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

// Path to the public HTML file
const dataHtmlPath = path.join(publicDir, 'data.html');

// Initialize the HTML file if it doesn't exist
function initializeHtmlFile() {
  if (!fs.existsSync(dataHtmlPath)) {
    const initialHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submitted Data</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    .entry {
      background: white;
      padding: 15px;
      margin: 15px 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .timestamp {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    .data {
      background: #f9f9f9;
      padding: 10px;
      border-left: 4px solid #4CAF50;
      margin-top: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <h1>Submitted Data</h1>
  <p>All submissions appear below:</p>
</body>
</html>`;
    fs.writeFileSync(dataHtmlPath, initialHtml);
  }
}

// Initialize the HTML file on startup
initializeHtmlFile();

// Function to validate submitted data
function validateData(data) {
  const allowedPattern = /^[a-zA-Z0-9()\-.,\s]{1,15}$/;
  const errors = [];

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push(`Field "${key}" must be a string or number`);
      continue;
    }

    const stringValue = String(value);

    if (stringValue.length > 15) {
      errors.push(`Field "${key}" exceeds 15 characters (has ${stringValue.length})`);
    }

    if (!allowedPattern.test(stringValue)) {
      errors.push(`Field "${key}" contains invalid characters. Only letters, numbers, and ()-., are allowed`);
    }
  }

  return errors;
}

// Endpoint to receive and append data
app.get('/submit', (req, res) => {
  try {
    const submittedData = req.query;

    if (!submittedData || Object.keys(submittedData).length === 0) {
      return res.status(400).json({ error: 'No data provided. Use /submit?key=value' });
    }

    // Validate the submitted data
    const validationErrors = validateData(submittedData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Invalid data format',
        details: validationErrors
      });
    }

    // Read the current HTML file
    let htmlContent = fs.readFileSync(dataHtmlPath, 'utf8');

    // Create the new entry HTML
    const timestamp = new Date().toLocaleString();
    const dataString = JSON.stringify(submittedData, null, 2);

    const newEntry = `
  <div class="entry">
    <div class="timestamp">Submitted on: ${timestamp}</div>
    <div class="data">${escapeHtml(dataString)}</div>
  </div>`;

    // Insert the new entry before the closing </body> tag
    htmlContent = htmlContent.replace('</body>', `${newEntry}\n</body>`);

    // Write the updated HTML back to the file
    fs.writeFileSync(dataHtmlPath, htmlContent);

    console.log(`Data appended at ${timestamp}`);

    res.json({
      success: true,
      message: 'Data successfully submitted',
      viewAt: `/public/data.html`
    });

  } catch (error) {
    console.error('Error submitting data:', error.message);
    res.status(500).json({ error: 'An error occurred while submitting data', details: error.message });
  }
});

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Movie Poster Scraper API',
    endpoints: {
      poster: 'GET /poster?movie=MovieName',
      submit: 'GET /submit?key=value',
      viewData: 'GET /public/data.html'
    },
    examples: {
      poster: 'GET /poster?movie=Inception',
      submit: 'GET /submit?name=John&message=Hello'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Usage: GET http://localhost:${PORT}/poster?movie=YourMovieName`);
});
