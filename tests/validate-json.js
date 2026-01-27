// JSON validation script for CI
const fs = require('fs');
const glob = require('glob');

const patterns = ['manifest.json', 'data/*.json', 'tests/test-data.json'];
let failed = false;

patterns.forEach(pattern => {
  const files = pattern.includes('*') ? glob.sync(pattern) : [pattern];
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        JSON.parse(fs.readFileSync(file, 'utf-8'));
        console.log(`✓ ${file}`);
      }
    } catch (e) {
      console.error(`✗ ${file}: ${e.message}`);
      failed = true;
    }
  });
});

process.exit(failed ? 1 : 0);
