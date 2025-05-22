const express = require('express');
const axios = require('axios');
const { toUrlFriendlyName } = require('./utils/nameUtils');
const { fetchAndPopulateTemplate } = require('./utils/templateUtils');

const azureUserApiCode = process.env.AZURE_USER_API_CODE || '';
const azureUserApiUrl = `${process.env.AZURE_USER_API_URL || ''}${azureUserApiCode ? `?code=${azureUserApiCode}` : ''}`;

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

// People route with name parameter
app.get('/people/:name', async (req, res) => {
  
  try {
    const urlName = req.params.name.toLowerCase();

    // If the name is 'template', return a 404 since this comes from the base content source.
    if (urlName === 'template') {
      return res.status(404).send('Not Found');
    }
    
    const apiUrl = new URL(azureUserApiUrl);
    apiUrl.searchParams.append('slug', urlName);

    console.log('azureUserApiUrl', apiUrl.toString());

    const response = await axios.get(apiUrl.toString());
    
    console.log('API Response:', response.data);

    const user = response.data;

    if (!user) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>User Not Found</title></head>
          <body>
            <h1>User Not Found</h1>
            <p>Sorry, we couldn't find a user with that name.</p>
            <a href="/">Back to Home</a>
          </body>
        </html>
      `);
    }

    // Fetch and populate template
    const templateUrl = 'https://main--unch-providers--herodigital.aem.live/people/template';
    const html = await fetchAndPopulateTemplate(templateUrl, { user });
    res.send(html);

  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>Sorry, something went wrong: ${error.message}</p>
          <a href="/">Back to Home</a>
        </body>
      </html>
    `);
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
