import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import { register } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import express from 'express'
import config from '../../../../main/config.js'

describe('POST /receive per-file submissions', () => {
    let root
    let clientDir
    let server
    let baseUrl
    const previousWorkdirectory = config.workdirectory
    const previousExamServerList = config.examServerList

    before(async () => {
        const loader = `
            export async function resolve(specifier, context, nextResolve) {
                if (specifier === 'archiver') return { url: 'data:text/javascript,export%20default%20()%3D%3E%7B%7D', shortCircuit: true }
                return nextResolve(specifier, context)
            }
            export async function load(url, context, nextLoad) {
                if (url.endsWith('.json')) {
                    const { readFile } = await import('node:fs/promises')
                    const json = JSON.parse(await readFile(new URL(url), 'utf8'))
                    return { format: 'module', shortCircuit: true, source: 'export default ' + JSON.stringify(json) }
                }
                return nextLoad(url, context)
            }
        `
        register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url)
        const { default: dataRoutes } = await import('./data.js')
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-data-test-'))
        config.workdirectory = root
        config.examServerList = {
            test: {
                serverinfo: { servername: 'test' },
                studentList: [{ token: 'student-token', clientname: 'student' }],
            },
        }
        clientDir = path.join(root, 'test', 'student')
        const app = express()
        app.use(express.json())
        app.use('/data', dataRoutes)
        server = http.createServer(app)
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
        baseUrl = `http://127.0.0.1:${server.address().port}`
    })

    after(async () => {
        await new Promise((resolve) => server.close(resolve))
        config.workdirectory = previousWorkdirectory
        config.examServerList = previousExamServerList
        await fs.rm(root, { recursive: true, force: true })
    })

    async function upload(body) {
        const response = await fetch(`${baseUrl}/data/receive/test`, {
            method: 'POST',
            headers: {
                authorization: 'Bearer student-token',
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
        })
        return { response, body: await response.json() }
    }

    it('recognizes the iOS top-level file payload rather than treating it as ZIP input', async () => {
        const { response, body } = await upload({
            path: 'nested/ios.txt',
            file: Buffer.from('iOS file').toString('base64'),
            submission: 'ios-submission',
        })

        assert.equal(response.status, 200)
        assert.equal(body.status, 'success')
        assert.equal(await fs.readFile(path.join(clientDir, 'ios-submission', 'nested', 'ios.txt'), 'utf8'), 'iOS file')
    })

    it('accepts the existing files[] payload shape', async () => {
        const { response, body } = await upload({
            files: [{ path: 'legacy.txt', file: Buffer.from('files array').toString('base64') }],
            submission: 'files-array-submission',
        })

        assert.equal(response.status, 200)
        assert.equal(body.status, 'success')
        assert.equal(await fs.readFile(path.join(clientDir, 'files-array-submission', 'legacy.txt'), 'utf8'), 'files array')
    })

    it('preserves a pre-existing submission folder and file when a later file fails', async () => {
        const submissionDir = path.join(clientDir, 'existing-submission')
        await fs.mkdir(submissionDir, { recursive: true })
        await fs.writeFile(path.join(submissionDir, 'keep.txt'), 'pre-existing')

        const { response, body } = await upload({
            files: [
                { path: 'first.txt', file: Buffer.from('first').toString('base64') },
                { path: '../escape.txt', file: Buffer.from('invalid').toString('base64') },
            ],
            submission: 'existing-submission',
        })

        assert.equal(response.status, 400)
        assert.equal(body.status, 'error')
        assert.equal(await fs.readFile(path.join(submissionDir, 'keep.txt'), 'utf8'), 'pre-existing')
        assert.equal(await fs.readFile(path.join(submissionDir, 'first.txt'), 'utf8'), 'first')
    })

    it('still removes the partial archive folder after a ZIP extraction failure', async () => {
        const { response, body } = await upload({
            filename: 'broken.zip',
            file: Buffer.from('not a zip archive').toString('base64'),
        })

        assert.equal(response.status, 400)
        assert.equal(body.status, 'error')
        assert.deepEqual((await fs.readdir(clientDir)).sort(), ['existing-submission', 'files-array-submission', 'ios-submission'])
    })
})
