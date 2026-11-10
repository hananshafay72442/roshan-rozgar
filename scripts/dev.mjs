import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const backend = path.join(root, 'backend')
const python = path.join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const vite = path.join(root, 'frontend/node_modules/vite/bin/vite.js')

if (!existsSync(python) || !existsSync(vite)) {
  console.error('Install the backend virtual environment and frontend dependencies first. See README.md.')
  process.exit(1)
}

const children = []
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env })
  children.push(child)
  child.on('error', (error) => {
    console.error(error.message)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1)
  })
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

start(python, ['-m', 'flask', '--app', 'wsgi:app', 'run', '--port', '5000'], backend)
start(process.execPath, [vite, '--host', '0.0.0.0', '--port', process.env.PORT || '5173', ...process.argv.slice(2)], path.join(root, 'frontend'))
