const axios = require('axios');

const BASE_URL = 'http://localhost:2525';

// Movie titles to test
const testMovies = [
  "How To Train Your Dragon 1",
  "Last Crusade 169",
  "National Treasure",
  "Spider Man Into The Spider Verse"
];

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testPosterEndpoint(movieTitle) {
  try {
    console.log(`\n${colors.blue}Testing: ${movieTitle}${colors.reset}`);

    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/poster`, {
      params: { movie: movieTitle },
      responseType: 'arraybuffer',
      timeout: 30000 // 30 second timeout
    });
    const endTime = Date.now();

    const contentType = response.headers['content-type'];
    const contentLength = response.data.length;

    console.log(`  ${colors.green}✓ Success${colors.reset}`);
    console.log(`  Response time: ${endTime - startTime}ms`);
    console.log(`  Content-Type: ${contentType}`);
    console.log(`  Image size: ${(contentLength / 1024).toFixed(2)} KB`);

    return {
      movie: movieTitle,
      success: true,
      responseTime: endTime - startTime,
      contentType,
      size: contentLength
    };
  } catch (error) {
    console.log(`  ${colors.red}✗ Failed${colors.reset}`);

    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Error: ${error.response.data.error || 'Unknown error'}`);
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`  Error: Cannot connect to server at ${BASE_URL}`);
      console.log(`  ${colors.yellow}Make sure the server is running!${colors.reset}`);
    } else {
      console.log(`  Error: ${error.message}`);
    }

    return {
      movie: movieTitle,
      success: false,
      error: error.message
    };
  }
}

async function testHealthCheck() {
  try {
    console.log(`${colors.blue}Testing health check endpoint...${colors.reset}`);
    const response = await axios.get(BASE_URL);
    console.log(`${colors.green}✓ Server is running${colors.reset}`);
    console.log(`Response:`, response.data);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Server is not responding${colors.reset}`);
    if (error.code === 'ECONNREFUSED') {
      console.log(`${colors.yellow}Please start the server with: npm start${colors.reset}`);
    }
    return false;
  }
}

async function runTests() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.blue}Movie Poster Scraper - Test Suite${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);

  // First check if server is running
  const serverRunning = await testHealthCheck();

  if (!serverRunning) {
    console.log(`\n${colors.red}Cannot proceed with tests - server is not running${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${testMovies.length} movies...`);
  console.log(`${'='.repeat(60)}`);

  const results = [];

  for (const movie of testMovies) {
    const result = await testPosterEndpoint(movie);
    results.push(result);

    // Wait a bit between requests to be respectful to TMDB
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total tests: ${results.length}`);
  console.log(`${colors.green}Passed: ${successful}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);

  if (successful > 0) {
    const avgResponseTime = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.responseTime, 0) / successful;
    console.log(`\nAverage response time: ${avgResponseTime.toFixed(2)}ms`);
  }

  // Show failed tests
  if (failed > 0) {
    console.log(`\n${colors.yellow}Failed tests:${colors.reset}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.movie}: ${r.error}`);
    });
  }

  console.log(`\n${'='.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
});
