import axios from 'axios';
import xml2js from 'xml2js';
import clipboardy from 'clipboardy';

async function fetchSitemap(sitemapUrl) {
    try {
        // Fetch the sitemap XML
        const response = await axios.get(sitemapUrl);
        const parser = new xml2js.Parser();
        
        // Parse the XML
        const result = await parser.parseStringPromise(response.data);
        
        // Extract URLs from the sitemap
        const urls = result.urlset.url.map(urlObj => urlObj.loc[0]);
        
        // Print URLs to console
        console.log('Found URLs:');
        urls.forEach(url => console.log(url));
        console.log(`\nTotal URLs found: ${urls.length}`);
        
        // Copy URLs to clipboard
        try {
            await clipboardy.write(urls.join('\n'));
            console.log('\nURLs have been copied to clipboard!');
        } catch (clipboardError) {
            console.warn('\nFailed to copy to clipboard:', clipboardError.message);
        }
        
        return urls;
    } catch (error) {
        console.error('Error fetching or parsing sitemap:', error.message);
        throw error;
    }
}

// Usage example
const sitemapUrl = process.argv[2] || 'https://example.com/sitemap.xml';
fetchSitemap(sitemapUrl).catch(console.error); 