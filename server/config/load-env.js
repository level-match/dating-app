const path = require('path')
const fs   = require('fs')
const dotenv = require('dotenv')

const serverRoot = path.join(__dirname, '..')

// npm scripts set NODE_ENV; default to development for local `node` runs.
const env = process.env.NODE_ENV || 'development'
if (!process.env.NODE_ENV) process.env.NODE_ENV = env

dotenv.config({ path: path.join(serverRoot, '.env') })

const envPath = path.join(serverRoot, `.env.${env}`)
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true })
}

module.exports = { env }
