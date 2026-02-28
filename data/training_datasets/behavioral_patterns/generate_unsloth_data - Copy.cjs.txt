const fs = require('fs');

const inputFile = 'temp_patterns.json';
const outputFile = 'unsloth_dataset.jsonl';

const systemInstruction = "Analyze the following text and extract the forensic behavioral pattern, category, and severity score (1-10) based on MCL 722.23 factors. Output a strict JSON object.";

const lines = fs.readFileSync(inputFile, 'utf-8').split('\n').filter(Boolean);

let count = 0;
const writeStream = fs.createWriteStream(outputFile);

for (const line of lines) {
  try {
    // The line is in JS object format: { name: '...', category: '...', ... }
    // We can safely evaluate it since we generated it
    const obj = eval(`(${line})`);
    
    // Unsloth Alpaca Format
    const unslothEntry = {
      instruction: systemInstruction,
      input: obj.pattern, // The actual phrase or trigger
      output: JSON.stringify({
        name: obj.name,
        category: obj.category,
        description: obj.description,
        severity: obj.severity
      })
    };

    writeStream.write(JSON.stringify(unslothEntry) + '\n');
    count++;
  } catch (err) {
    console.error(`Failed to parse line: ${line}`, err);
  }
}

writeStream.end();
console.log(`✅ Successfully generated ${count} training examples for Unsloth in ${outputFile}`);
