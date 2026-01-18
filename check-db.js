import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

(async () => {
  const SQL = await initSqlJs();
  const filebuffer = readFileSync('./data/salem.db');
  const db = new SQL.Database(filebuffer);

  const result = db.exec('SELECT category, COUNT(*) as count FROM behavioralPatterns GROUP BY category ORDER BY category');
  console.log('Database categories:');
  result[0].values.forEach(row => {
    console.log(row[0] + ':', row[1]);
  });

  db.close();
})();