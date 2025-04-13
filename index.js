const express = require('express');
const axios = require('axios');

const app = express();

// Middleware
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vercel Express App</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>Welcome to My Vercel Express App</h1>
        <p>This app is deployed on Vercel using serverless functions!</p>
        <a href="/api/users">View Users API</a>
      </body>
    </html>
  `);
});

// Sample API route
app.get('/api/users', async (req, res) => {
  try {
    // Fetch users from JSONPlaceholder
    const response = await axios.get('https://jsonplaceholder.typicode.com/users');
    res.json(response.data.slice(0, 5)); // Return first 5 users
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Vercel-specific export
module.exports = app;

// Local development server
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
