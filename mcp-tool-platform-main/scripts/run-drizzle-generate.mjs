import { spawn } from 'child_process';

const proc = spawn('npx', ['drizzle-kit', 'generate'], { 
  stdio: ['pipe', 'inherit', 'inherit'],
  cwd: process.cwd()
});

// Send 30 newlines to auto-select first option for all prompts
for (let i = 0; i < 30; i++) {
  proc.stdin.write('\n');
}
setTimeout(() => proc.stdin.end(), 500);
proc.on('close', code => process.exit(code));
