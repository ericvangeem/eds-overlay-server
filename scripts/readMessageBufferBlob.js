const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

// Connection string should be in your .env file
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.CONTAINER_NAME;
const blobName = process.env.BLOB_NAME; // The name of your JSON file

async function readAndPrintJson() {
    try {
        // Create blob service client
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        
        // Get container client
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // Get blob client
        const blobClient = containerClient.getBlobClient(blobName);

        // Download blob content
        const downloadResponse = await blobClient.download();
        const content = await streamToString(downloadResponse.readableStreamBody);

        // Parse and pretty print JSON
        const jsonContent = JSON.parse(content);
        console.log(JSON.stringify(jsonContent, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Helper function to convert stream to string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data.toString());
        });
        readableStream.on('end', () => {
            resolve(chunks.join(''));
        });
        readableStream.on('error', reject);
    });
}

// Run the script
readAndPrintJson().catch(console.error);