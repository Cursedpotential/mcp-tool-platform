import initSqlJs from 'sql.js';

(async () => {
  const SQL = await initSqlJs();
  // Let's just fetch directly to see the data format
  const response = await fetch('https://raw.githubusercontent.com/valeriobasile/hurtlex/master/lexica/EN/1.2/hurtlex_EN.tsv');
  const text = await response.text();
  const lines = text.split('\n').slice(0, 10); // First 10 lines

  console.log('First 10 lines of HurtLex data:');
  lines.forEach((line, i) => {
    console.log(`${i}: ${line}`);
    if (i < 3) {
      const parts = line.split('\t');
      console.log(`   Parts: ${parts.length} - ${parts.join(' | ')}`);
    }
  });
})();