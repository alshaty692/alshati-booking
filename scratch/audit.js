const fs = require('fs');
const path = require('path');

function findRoutes(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findRoutes(filePath, fileList);
    } else if (file === 'route.ts') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const adminRoutes = findRoutes(path.join(__dirname, '../src/app/api/admin'));
const missing = [];

for (const route of adminRoutes) {
  const content = fs.readFileSync(route, 'utf8');
  if (!content.includes('requirePermission')) {
    missing.push(route);
  }
}

console.log(missing.join('\n'));
