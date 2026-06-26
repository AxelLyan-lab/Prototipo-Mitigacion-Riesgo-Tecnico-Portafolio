const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const envConfigFile = `export const environment = {
  production: false,
  googleMapsApiKey: '${process.env.GOOGLE_MAPS_API_KEY || ''}',
};
`;

const targetPath = './src/environments/environment.ts';
const targetDir = './src/environments';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(targetPath, envConfigFile);
console.log(`Environment generated at ${targetPath}`);
