#!/usr/bin/env node
/**
 * Dev runner — start / stop / restart / status for client + server.
 *
 *   npm run dev          → start both (foreground)
 *   npm run dev:stop     → kill processes on dev ports
 *   npm run dev:restart  → stop then start
 *   npm run dev:status   → show which ports are in use
 */

import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLIENT_PORTS = [3000, 3001, 3002, 3003]
const SERVER_PORT = 4000
const ALL_PORTS = [...CLIENT_PORTS, SERVER_PORT]

const isWin = process.platform === 'win32'

function log(msg) {
  console.log(`[dev] ${msg}`)
}

function killPort(port) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      const pids = new Set()
      for (const line of out.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.includes('LISTENING')) continue
        const parts = trimmed.split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && pid !== '0') pids.add(pid)
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
          log(`Stopped PID ${pid} (port ${port})`)
        } catch { /* already gone */ }
      }
      return pids.size > 0
    }

    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', shell: true })
    return true
  } catch {
    return false
  }
}

function stop() {
  log('Stopping dev servers…')
  let killed = 0
  for (const port of ALL_PORTS) {
    if (killPort(port)) killed++
  }
  if (!killed) log('No dev servers found on ports 3000–3003 or 4000.')
  else log('Done.')
}

function portStatus(port) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      const line = out.split('\n').find(l => l.includes('LISTENING'))
      if (!line) return null
      const pid = line.trim().split(/\s+/).pop()
      return { port, pid, up: true }
    }
    const pid = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n')[0]
    return pid ? { port, pid, up: true } : null
  } catch {
    return { port, up: false }
  }
}

function status() {
  log('Port status:')
  for (const port of ALL_PORTS) {
    const s = portStatus(port)
    const label = port === SERVER_PORT ? 'backend' : 'frontend'
    if (s?.up) log(`  :${port} (${label}) — running, PID ${s.pid}`)
    else log(`  :${port} (${label}) — free`)
  }
}

function start() {
  log('Starting backend (:4000) + frontend (:3000)…')
  log('Press Ctrl+C to stop both.')
  log('Or in another terminal: npm run dev:stop')
  console.log('')

  const concurrentlyArgs = [
    'concurrently',
    '-k',
    '--names', 'server,client',
    '--prefix-colors', 'blue,green',
    'npm run dev:server',
    'npm run dev:client',
  ]

  const child = isWin
    ? spawn(`npx ${concurrentlyArgs.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`, {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
      })
    : spawn('npx', concurrentlyArgs, { cwd: ROOT, stdio: 'inherit' })

  child.on('exit', (code) => process.exit(code ?? 0))
}

const command = process.argv[2] || 'start'

switch (command) {
  case 'start':
    start()
    break
  case 'stop':
    stop()
    break
  case 'restart':
    stop()
    setTimeout(start, 800)
    break
  case 'status':
    status()
    break
  default:
    console.error(`Unknown command: ${command}`)
    console.error('Usage: node scripts/dev-runner.mjs [start|stop|restart|status]')
    process.exit(1)
}
