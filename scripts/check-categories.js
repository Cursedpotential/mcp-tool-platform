import initSqlJs from 'sql.js';

(async () => {
  const SQL = await initSqlJs();
  // Let's check what categories exist
  const response = await fetch('https://raw.githubusercontent.com/valeriobasile/hurtlex/master/lexica/EN/1.2/hurtlex_EN.tsv');
  const text = await response.text();
  const lines = text.split('\n').slice(1, 100); // Skip header, check first 100 lines

  const categories = new Set();
  for (const line of lines) {
    if (line.trim()) {
      const parts = line.split('\t');
      if (parts.length >= 6) {
        categories.add(parts[2].trim()); // category is column 3 (index 2)
      }
    }
  }

  console.log('Categories found in HurtLex data:');
  Array.from(categories).sort().forEach(cat => console.log(`- ${cat}`));
  console.log(`\nTotal categories: ${categories.size}`);
})();