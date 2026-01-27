// Simple test runner for SafeExtensions
const fs = require('fs');
const path = require('path');

console.log('Running SafeExtensions tests...\n');

let passed = 0;
let failed = 0;

// Test 1: Validate manifest.json structure
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf-8'));
  if (!manifest.manifest_version || !manifest.name || !manifest.version) {
    throw new Error('Missing required manifest fields');
  }
  console.log('✓ manifest.json structure valid');
  passed++;
} catch (e) {
  console.error('✗ manifest.json validation failed:', e.message);
  failed++;
}

// Test 2: Validate data files exist and parse
const dataFiles = ['risk-patterns.json', 'safe-developers.json', 'tracker-domains.json'];
dataFiles.forEach(file => {
  try {
    const filePath = path.join('data', file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!data) throw new Error('Empty data');
    console.log(`✓ ${file} is valid JSON`);
    passed++;
  } catch (e) {
    console.error(`✗ ${file} validation failed:`, e.message);
    failed++;
  }
});

// Test 3: Check for required files
const requiredFiles = [
  'background/service-worker.js',
  'popup/popup.html',
  'popup/popup.js',
  'CODE_OF_CONDUCT.md',
  'docs/CONTRIBUTING.md'
];
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file} exists`);
    passed++;
  } else {
    console.error(`✗ ${file} missing`);
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
