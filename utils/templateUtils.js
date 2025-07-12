const axios = require('axios');
const { AEM_BASE_URL } = require('../constants');

async function fetchAndPopulateTemplate(templateUrl, data) {
  try {
    const response = await axios.get(templateUrl);
    let html = response.data;
    
// Replace all {{path.to.property}} placeholders, including URL-encoded versions
html = html.replace(/(%7B%7B|{{)([^}%]+)(%7D%7D|}})/g, (match, openBrace, path, closeBrace) => {
  // Decode the path in case it contains URL-encoded characters
  const decodedPath = decodeURIComponent(path);
  const value = decodedPath.split('.').reduce((obj, key) => obj?.[key], data);
  return value !== undefined ? value : match;
});

    // Convert relative media URLs to absolute URLs and remove query parameters
    html = html.replace(/(src|srcset)="\.\/media_([^"]+)"/g, (match, attr, path) => {
      // Remove query parameters from the path
      const pathWithoutQuery = path.split('?')[0];
      return `${attr}="${AEM_BASE_URL}/media_${pathWithoutQuery}"`;
    });
    
    return html;
  } catch (error) {
    throw new Error(`Failed to fetch or process template: ${error.message}`);
  }
}

module.exports = { fetchAndPopulateTemplate }; 