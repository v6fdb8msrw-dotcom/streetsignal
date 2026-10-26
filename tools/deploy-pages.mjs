// Lädt den Inhalt von dist/ in den Zweig gh-pages hoch; GitHub Pages zeigt diesen Zweig als Webseite.
import { execSync } from 'node:child_process'
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' })
const remote = execSync('git remote get-url origin').toString().trim()
const commit = execSync('git rev-parse --short HEAD').toString().trim()

const dir = mkdtempSync(join(tmpdir(), 'streetsignal-pages-'))
cpSync('dist', dir, { recursive: true })
// Ohne diese Datei würde GitHub die Seite noch einmal mit Jekyll verarbeiten
writeFileSync(join(dir, '.nojekyll'), '')
run('git init -q -b gh-pages', dir)
run('git add -A', dir)
run(`git commit -q -m "Webseite aus ${commit}"`, dir)
run(`git push -q -f ${remote} gh-pages`, dir)
rmSync(dir, { recursive: true, force: true })
console.log('Webseite hochgeladen: https://v6fdb8msrw-dotcom.github.io/streetsignal/')
