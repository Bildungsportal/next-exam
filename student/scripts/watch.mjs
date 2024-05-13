import { spawn } from 'child_process'
import { createServer, build } from 'vite'
import electron from 'electron'

/**
 * @type {(server: import('vite').ViteDevServer) => Promise<import('rollup').RollupWatcher>}
 */
function watchMain(server) {
  /**
   * @type {import('child_process').ChildProcessWithoutNullStreams | null}
   */
  let electronProcess = null
  const address = server.httpServer.address()
  console.log(address)
  const env = Object.assign(process.env, {
    VITE_DEV_SERVER_HOST: address.address,
    VITE_DEV_SERVER_PORT: address.port,
    //NODE_TLS_REJECT_UNAUTHORIZED : 0
  })



  return build({
    configFile: 'packages/main/vite.config.ts',
    mode: 'development',
    plugins: [{
      name: 'electron-main-watcher',
      writeBundle() {
        electronProcess && electronProcess.kill()
        electronProcess = spawn(electron, ['.', '--js-flags=--expose-gc', '--inspect=5858'], { stdio: 'inherit', env })
        //electronProcess = spawn(electron, ['.'], { stdio: 'inherit', env })
      },
    }],
    build: {
      watch: true,
      target: 'esnext'
    },
  })
}

/**
 * @type {(server: import('vite').ViteDevServer) => Promise<import('rollup').RollupWatcher>}
 */
function watchPreload(server) {
  return build({
    configFile: 'packages/preload/vite.config.ts',
    mode: 'development',
    plugins: [{
      name: 'electron-preload-watcher',
      writeBundle() {
        server.ws.send({ type: 'full-reload' })
      },
    }],
    build: {
      watch: true,
      target: 'esnext'
    },
  })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// bootstrap
const server = await createServer({ configFile: 'packages/renderer/vite.config.ts' })

await server.listen({port: 3001, host: '127.0.0.1' })
await watchPreload(server)
await watchMain(server)
