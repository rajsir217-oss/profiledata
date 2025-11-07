#!/usr/bin/env node
/**
 * Generate build info JSON file
 * Run during build to capture build timestamp
 */

const fs = require('fs');
const path = require('path');

const buildInfo = {
  buildTime: new Date().toISOString(),
  buildDate: new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }),
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  gitCommit: process.env.GIT_COMMIT || 'unknown',
  gitBranch: process.env.GIT_BRANCH || 'unknown'
};

const outputPath = path.join(__dirname, 'public', 'build-info.json');

fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

console.log('✅ Build info generated:', buildInfo);
console.log('📝 Written to:', outputPath);
