import redio from '../redio'
import got from 'got'
import { ServerOptions } from 'https'
import fs from 'fs'

function wait(t: number): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, t)
	})
}

describe('Run a sequence of pull tests', () => {
	wait(1)
	const serverOptions: ServerOptions = {
		key: fs.readFileSync(__dirname + '/security/server.key'),
		cert: fs.readFileSync(__dirname + '/security/server.cert'),
		rejectUnauthorized: false
	}
	const https = {
		key: serverOptions.key,
		certificateAuthority: serverOptions.cert
	}
	describe('Set up a simple http pull stream of number', () => {
		beforeAll(async () => {
			redio([1, 2, 3]).http('/my/stream/id', { httpsPort: 8001, serverOptions })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>('https://localhost:8001/my/stream/id/debug.json', {
				responseType: 'json',
				https
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'https',
				body: 'primitive',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpsPort: 8001
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
		})
		test('Check start redirect', async () => {
			const starter = await got<any>('https://localhost:8001/my/stream/id/start', {
				followRedirect: false,
				https
			})
			expect(starter.headers['location']).toBeTruthy()
			expect(starter.headers['location']).toMatch('https:')
			expect(starter.headers['location']).toMatch(':8001')
			expect(starter.headers['location']).toMatch('/my/stream/id')
			expect(starter.headers['location']?.endsWith('/1')).toBe(true)

			expect(starter.headers['redioactive-bodytype']).toBe('primitive')
			expect(starter.headers['redioactive-idtype']).toBe('counter')
			expect(starter.headers['redioactive-deltatype']).toBe('one')
			expect(starter.headers['redioactice-cadence']).toBeUndefined()
			expect(starter.headers['redioactive-buffersize']).toBe('10')
			expect(starter.headers['content-length']).toBe('0')
		})
		test('Check latest redirect', async () => {
			const latest = await got<any>('https://localhost:8001/my/stream/id/latest', {
				followRedirect: false,
				https
			})
			expect(latest.headers['location']).toBeTruthy()
			expect(latest.headers['location']).toMatch('https:')
			expect(latest.headers['location']).toMatch(':8001')
			expect(latest.headers['location']).toMatch('/my/stream/id')
			expect(latest.headers['location']?.endsWith('/4')).toBe(true)

			expect(latest.headers['redioactive-bodytype']).toBe('primitive')
			expect(latest.headers['redioactive-idtype']).toBe('counter')
			expect(latest.headers['redioactive-deltatype']).toBe('one')
			expect(latest.headers['redioactice-cadence']).toBeUndefined()
			expect(latest.headers['redioactive-buffersize']).toBe('10')
			expect(latest.headers['content-length']).toBe('0')
		})
		test('Pull the first value', async () => {
			const value = await got('https://localhost:8001/my/stream/id/1', {
				responseType: 'json',
				https
			})
			expect(value.body).toBe(1)
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('1')
			expect(value.headers['redioactive-previd']).toBe('1')
			expect(value.headers['redioactive-nextid']).toBe('2')
		})
		test('Pull the end value', async () => {
			const value = await got('https://localhost:8001/my/stream/id/4', {
				responseType: 'json',
				https
			})
			expect(value.body).toEqual({ end: true })
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('4')
			expect(value.headers['redioactive-previd']).toBe('3')
			expect(value.headers['redioactive-nextid']).toBe('4')
		})
		test('Get an empty manifest', async () => {
			const manifest = await got('https://localhost:8001/my/stream/id/manifest.json', {
				responseType: 'json',
				https
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got('https://localhost:8001/my/stream/id/end', { https })
			await wait(500)
		})
	})

	describe('Set up a simple http pull stream of string', () => {
		const port = 8001
		beforeAll(async () => {
			redio(['one', 'two', 'three']).http('my/stream/id////', { httpsPort: 8001, serverOptions })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>(`https://localhost:${port}/my/stream/id/debug.json`, {
				responseType: 'json',
				https
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'https',
				body: 'primitive',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpsPort: port,
				root: '/my/stream/id'
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
		})
		test('Pull the first value', async () => {
			const value = await got(`https://localhost:${port}/my/stream/id/1`, {
				responseType: 'json',
				https
			})
			expect(value.body).toBe('one')
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('1')
			expect(value.headers['redioactive-nextid']).toBe('2')
		})
		test('Pull the end value', async () => {
			const value = await got('https://localhost:8001/my/stream/id/4', {
				responseType: 'json',
				https
			})
			expect(value.body).toEqual({ end: true })
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('4')
			expect(value.headers['redioactive-previd']).toBe('3')
			expect(value.headers['redioactive-nextid']).toBe('4')
		})
		test('Get an empty manifest', async () => {
			const manifest = await got(`https://localhost:${port}/my/stream/id/manifest.json`, {
				responseType: 'json',
				https
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got(`https://localhost:${port}/my/stream/id/end`, { https })
			await wait(500)
		})
	})

	describe('Set up a simple http pull stream of json', () => {
		const port = 8001
		beforeAll(async () => {
			redio([{ one: 1 }, { two: 2 }, { three: 3 }]).http('my/stream/id2/', {
				httpsPort: port,
				serverOptions
			})
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>(`https://localhost:${port}/my/stream/id2/debug.json`, {
				responseType: 'json',
				https
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'https',
				body: 'json',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpsPort: port,
				root: '/my/stream/id2'
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
		})
		test('Check start redirect', async () => {
			const starter = await got<any>(`https://localhost:${port}/my/stream/id2/start`, {
				followRedirect: false,
				https
			})
			expect(starter.headers['location']).toBeTruthy()
			expect(starter.headers['location']).toMatch('https:')
			expect(starter.headers['location']).toMatch(`:${port}`)
			expect(starter.headers['location']).toMatch('/my/stream/id2')
			expect(starter.headers['location']?.endsWith('/1')).toBe(true)

			expect(starter.headers['redioactive-bodytype']).toBe('json')
			expect(starter.headers['redioactive-idtype']).toBe('counter')
			expect(starter.headers['redioactive-deltatype']).toBe('one')
			expect(starter.headers['redioactice-cadence']).toBeUndefined()
			expect(starter.headers['redioactive-buffersize']).toBe('10')
			expect(starter.headers['content-length']).toBe('0')
		})
		test('Check latest redirect', async () => {
			const latest = await got<any>(`https://localhost:${port}/my/stream/id2/latest`, {
				followRedirect: false,
				https
			})
			expect(latest.headers['location']).toBeTruthy()
			expect(latest.headers['location']).toMatch('https:')
			expect(latest.headers['location']).toMatch(`:${port}`)
			expect(latest.headers['location']).toMatch('/my/stream/id2')
			expect(latest.headers['location']?.endsWith('/4')).toBe(true)

			expect(latest.headers['redioactive-bodytype']).toBe('json')
			expect(latest.headers['redioactive-idtype']).toBe('counter')
			expect(latest.headers['redioactive-deltatype']).toBe('one')
			expect(latest.headers['redioactice-cadence']).toBeUndefined()
			expect(latest.headers['redioactive-buffersize']).toBe('10')
			expect(latest.headers['content-length']).toBe('0')
		})
		test('Pull the first value', async () => {
			const value = await got(`https://localhost:${port}/my/stream/id2/1`, {
				responseType: 'json',
				https
			})
			expect(value.body).toEqual({ one: 1 })
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('1')
			expect(value.headers['redioactive-nextid']).toBe('2')
		})
		test('Pull the end value', async () => {
			const value = await got('https://localhost:8001/my/stream/id2/4', {
				responseType: 'json',
				https
			})
			expect(value.body).toEqual({ end: true })
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('4')
			expect(value.headers['redioactive-previd']).toBe('3')
			expect(value.headers['redioactive-nextid']).toBe('4')
		})
		test('Get an empty manifest', async () => {
			const manifest = await got(`https://localhost:${port}/my/stream/id2/manifest.json`, {
				responseType: 'json',
				https
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got(`https://localhost:${port}/my/stream/id2/end`, { https })
			await wait(500)
		})
	})

	describe('Set up a simple http pull stream of blobs', () => {
		const port = 8001
		beforeAll(async () => {
			redio([
				{ one: 1, data: Buffer.from([1, 1, 1]) },
				{ two: 2, data: Buffer.from([2, 2, 2]) },
				{ three: 3, data: Buffer.from([3, 3, 3]) }
			]).http('my/stream/id2/', { httpsPort: port, blob: 'data', serverOptions })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>(`https://localhost:${port}/my/stream/id2/debug.json`, {
				responseType: 'json',
				https
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'https',
				body: 'blob',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpsPort: port,
				root: '/my/stream/id2'
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
		})
		test('Check start redirect', async () => {
			const starter = await got<any>(`https://localhost:${port}/my/stream/id2/start`, {
				followRedirect: false,
				https
			})
			expect(starter.headers['location']).toBeTruthy()
			expect(starter.headers['location']).toMatch('https:')
			expect(starter.headers['location']).toMatch(`:${port}`)
			expect(starter.headers['location']).toMatch('/my/stream/id2')
			expect(starter.headers['location']?.endsWith('/1')).toBe(true)

			expect(starter.headers['redioactive-bodytype']).toBe('blob')
			expect(starter.headers['redioactive-idtype']).toBe('counter')
			expect(starter.headers['redioactive-deltatype']).toBe('one')
			expect(starter.headers['redioactice-cadence']).toBeUndefined()
			expect(starter.headers['redioactive-buffersize']).toBe('10')
			expect(starter.headers['content-length']).toBe('0')
		})
		test('Check latest redirect', async () => {
			const latest = await got<any>(`https://localhost:${port}/my/stream/id2/latest`, {
				followRedirect: false,
				https
			})
			expect(latest.headers['location']).toBeTruthy()
			expect(latest.headers['location']).toMatch('https:')
			expect(latest.headers['location']).toMatch(`:${port}`)
			expect(latest.headers['location']).toMatch('/my/stream/id2')
			expect(latest.headers['location']?.endsWith('/4')).toBe(true)

			expect(latest.headers['redioactive-bodytype']).toBe('blob')
			expect(latest.headers['redioactive-idtype']).toBe('counter')
			expect(latest.headers['redioactive-deltatype']).toBe('one')
			expect(latest.headers['redioactice-cadence']).toBeUndefined()
			expect(latest.headers['redioactive-buffersize']).toBe('10')
			expect(latest.headers['content-length']).toBe('0')
		})
		test('Pull the first value', async () => {
			const value = await got(`https://localhost:${port}/my/stream/id2/1`, {
				responseType: 'buffer',
				https
			})
			expect(value.body).toEqual(Buffer.from([1, 1, 1]))
			expect(value.headers['content-type']).toBe('application/octet-stream')
			expect(value.headers['content-length']).toBe('3')
			expect(value.headers['redioactive-id']).toBe('1')
			expect(value.headers['redioactive-nextid']).toBe('2')
			const redioDetails = value.headers['redioactive-details']
			const redioDetails2 = Array.isArray(redioDetails) ? redioDetails[0] : redioDetails
			expect(JSON.parse(redioDetails2 || '')).toEqual({ one: 1 })
		})
		test('Pull the end value', async () => {
			const value = await got('https://localhost:8001/my/stream/id2/4', {
				responseType: 'buffer',
				https
			})
			expect(value.headers['redioactive-details']).toEqual(JSON.stringify({ end: true }))
			expect(value.headers['content-type']).toBe('application/octet-stream')
			expect(value.headers['content-length']).toBe('0')
			expect(value.headers['redioactive-id']).toBe('4')
			expect(value.headers['redioactive-previd']).toBe('3')
			expect(value.headers['redioactive-nextid']).toBe('4')
			expect(value.body.length).toBe(0)
		})
		test('Get an empty manifest', async () => {
			const manifest = await got(`https://localhost:${port}/my/stream/id2/manifest.json`, {
				responseType: 'json',
				https
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got(`https://localhost:${port}/my/stream/id2/end`, { https })
			await wait(500)
		})
	})
})
