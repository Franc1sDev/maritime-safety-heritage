// Copies non-TypeScript files the compiled code needs (SQL migrations, sample data) into dist/.
const fs = require('fs');
const path = require('path');
const pairs = [
  ['src/database/migrations', 'dist/database/migrations'],
  ['src/database/sample-data.json', 'dist/database/sample-data.json'],
];
for (const [from, to] of pairs) {
  fs.cpSync(path.join(__dirname, '..', from), path.join(__dirname, '..', to), { recursive: true });
}
console.log('Copied migrations and sample data into dist/.');
