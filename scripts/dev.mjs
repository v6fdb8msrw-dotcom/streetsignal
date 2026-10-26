// Startet den lokalen Import-Server und Vite gemeinsam; Strg+C beendet beide.
import { spawn } from 'node:child_process'

const procs = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' }),
  spawn('npx', ['vite', ...process.argv.slice(2)], { stdio: 'inherit', shell: process.platform === 'win32' }),
]
const stop = () => procs.forEach((p) => p.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
procs.forEach((p) => p.on('exit', stop))
