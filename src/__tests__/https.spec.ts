import redio, { Funnel, Liquid, end } from '../redio'
import got from 'got'
import { ServerOptions, RequestOptions } from 'https'
import fs from 'fs'

function wait(t: number): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, t)
	})
}

const serverOptions: ServerOptions = {
	key: fs.readFileSync(__dirname + '/security/server-key.pem'),
	cert: fs.readFileSync(__dirname + '/security/server-crt.pem'),
	ca: fs.readFileSync(__dirname + '/security/ca-crt.pem')
}
const https = {
	// For got
	certificateAuthority: serverOptions.ca
}
const requestOptions: RequestOptions = {
	// For Node.js direct requests
	ca: serverOptions.ca
}

describe.skip('Run a sequence of pull tests', () => {
	wait(1)
	describe('Set up a simple http pull stream of number', () => {
		beforeAll(async () => {
			redio([1, 2, 3]).http('/my/stream/id', { httpsPort: 9001, serverOptions })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>('https://localhost:9001/my/stream/id/debug.json', {
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
				httpsPort: 9001
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
		})
		test('Check start redirect', async () => {
			const starter = await got<any>('https://localhost:9001/my/stream/id/start', {
				followRedirect: false,
				https
			})
			expect(starter.headers['location']).toBeTruthy()
			expect(starter.headers['location']).toMatch('https:')
			expect(starter.headers['location']).toMatch(':9001')
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
			const latest = await got<any>('https://localhost:9001/my/stream/id/latest', {
				followRedirect: false,
				https
			})
			expect(latest.headers['location']).toBeTruthy()
			expect(latest.headers['location']).toMatch('https:')
			expect(latest.headers['location']).toMatch(':9001')
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
			const value = await got('https://localhost:9001/my/stream/id/1', {
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
			const value = await got('https://localhost:9001/my/stream/id/4', {
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
			const manifest = await got('https://localhost:9001/my/stream/id/manifest.json', {
				responseType: 'json',
				https
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got('https://localhost:9001/my/stream/id/end', { https })
			await wait(500)
		})
	})

	describe('Set up a simple http pull stream of string', () => {
		const port = 9001
		beforeAll(async () => {
			redio(['one', 'two', 'three']).http('my/stream/id////', { httpsPort: 9001, serverOptions })
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
			const value = await got('https://localhost:9001/my/stream/id/4', {
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
		const port = 9001
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
			const value = await got('https://localhost:9001/my/stream/id2/4', {
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
		const port = 9001
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
			const value = await got('https://localhost:9001/my/stream/id2/4', {
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

describe.skip('Receive an HTTP pull stream', () => {
	const port = 9002
	describe('Receive a stream of primitive values', () => {
		beforeAll(async () => {
			redio([1, 2, 3]).http('/my/stream/id', {
				httpsPort: port,
				manifest: { wibble: true, wobble: 'false' },
				serverOptions,
				keepAliveTimeout: 400
			})
			// await wait(500)
		})
		test('Create a redio HTTP stream consumer', async () => {
			await expect(
				redio<number>(`https://localhost:${port}/my/stream/id`, {
					httpsPort: port,
					requestOptions
				}).toArray()
			).resolves.toEqual([1, 2, 3])
		})
		afterAll(async () => {
			await got(`https://localhost:${port}/my/stream/id/end`, { https })
			await wait(500)
		})
	})

	describe('Receive a stream of JSON', () => {
		beforeAll(async () => {
			redio([{ one: 1 }, { two: 'two' }, { three: [1, 'plus', { two: true }] }]).http(
				'/my/stream/id',
				{
					httpsPort: port,
					manifest: { wibble: true, wobble: 'false' },
					serverOptions,
					keepAliveTimeout: 400
				}
			)
		})
		test('Create a redio HTTP stream consumer', async () => {
			await expect(
				redio<number>(`https://localhost:${port}/my/stream/id`, {
					httpsPort: port,
					requestOptions
				}).toArray()
			).resolves.toEqual([{ one: 1 }, { two: 'two' }, { three: [1, 'plus', { two: true }] }])
		})
		afterAll(async () => {
			await got(`https://localhost:${port}/my/stream/id/end`, { https })
			await wait(500)
		})
	})

	describe('Receive a stream of blobs', () => {
		beforeAll(async () => {
			redio([
				{ one: 1, data: Buffer.from([1, 1, 1]) },
				{ two: 'two', data: Buffer.from([2, 2, 2]) },
				{ three: [1, 'plus', { two: true }], data: Buffer.from([3, 3, 3]) }
			]).http('/my/stream/id', {
				httpsPort: port,
				manifest: { wibble: true, wobble: 'false' },
				blob: 'data',
				serverOptions,
				keepAliveTimeout: 400
			})
			// await wait(500)
		})
		test('Create a redio HTTP stream consumer', async () => {
			await expect(
				redio<number>(`https://localhost:${port}/my/stream/id`, {
					httpsPort: port,
					blob: 'dematerial',
					requestOptions
				}).toArray()
			).resolves.toEqual([
				{ one: 1, dematerial: Buffer.from([1, 1, 1]) },
				{ two: 'two', dematerial: Buffer.from([2, 2, 2]) },
				{ three: [1, 'plus', { two: true }], dematerial: Buffer.from([3, 3, 3]) }
			])
		})
		afterAll(async () => {
			await got(`https://localhost:${port}/my/stream/id/end`, { https })
			await wait(500)
		})
	})

	describe('Receive a manifest', () => {
		beforeAll(async () => {
			redio([{ one: 1 }, { two: 'two' }, { three: [1, 'plus', { two: true }] }]).http(
				'/my/stream/id',
				{
					httpsPort: port,
					manifest: { wibble: true, wobble: 'false' },
					serverOptions,
					keepAliveTimeout: 400
				}
			)
		})
		test('Create a redio HTTP stream consumer', async () => {
			await expect(
				redio<number>(`https://localhost:${port}/my/stream/id`, {
					httpsPort: port,
					manifest: 'manifred',
					requestOptions
				}).toArray()
			).resolves.toEqual([
				{ one: 1, manifred: { wibble: true, wobble: 'false' } },
				{ two: 'two', manifred: { wibble: true, wobble: 'false' } },
				{ three: [1, 'plus', { two: true }], manifred: { wibble: true, wobble: 'false' } }
			])
		})
		afterAll(async () => {
			await got(`https://localhost:${port}/my/stream/id/end`, { https })
			await wait(500)
		})
	})
})

describe.only('Receive an HTTP push stream', () => {
	describe.skip('Receive a stream of primitive values', () => {
		const port = 9005
		let serverSide: Promise<number[]>
		let clientSide: Promise<Liquid<number>>
		let counter = 0
		const genny: Funnel<number> = () =>
			new Promise((resolve) => {
				if (counter++ >= 3) {
					resolve(end)
				} else if (counter > 1) {
					setTimeout(() => {
						resolve(counter)
					}, 200)
				} else {
					resolve(1)
				}
			})
		beforeAll(async () => {
			serverSide = redio<number>(`/my/stream/id`, {
				httpsPort: port,
				serverOptions,
				keepAliveTimeout: 400
			}).toArray()
			clientSide = redio<number>(genny)
				.http(`https://localhost:${port}/my/stream/id`, {
					httpsPort: port,
					manifest: { wibble: true, wobble: 'false' },
					requestOptions
				})
				.toPromise()
		})
		test('Stream provides debug', async () => {
			await wait(100)
			const debugRes = await got(`https://localhost:${port}/my/stream/id/debug.json`, {
				responseType: 'json',
				https
			})
			expect(debugRes.headers['content-type']).toBe('application/json')
			expect(debugRes.headers['content-length']).toBeTruthy()
			expect(debugRes.body).toMatchObject({
				info: {
					type: 'push',
					protocol: 'https',
					root: '/my/stream/id',
					idType: 'counter',
					body: 'primitive',
					delta: 'one',
					manifest: { wibble: true, wobble: 'false' },
					httpsPort: port
				},
				uri: '/my/stream/id',
				url: `https://localhost:${port}/my/stream/id`,
				streamIDs: { '/my/stream/id': { httpsPort: port } }
			})
		})
		test('Stream provides manifest', async () => {
			const manifest = await got(`https://localhost:${port}/my/stream/id/manifest.json`, {
				responseType: 'json',
				https
			})
			expect(manifest.body).toEqual({ wibble: true, wobble: 'false' })
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBeTruthy()
		})
		test('Stream arrives as expected', async () => {
			await clientSide
			await expect(serverSide).resolves.toEqual([1, 2, 3])
		})
		test('Server closes afterwards', async () => {
			await wait(500)
			await expect(
				got(`https://localhost:${port}/my/stream/id/debug.json`, { https, retry: 0, timeout: 200 })
			).rejects.toThrow(/Timeout/)
			await wait(4000)
		})
	})

	describe('Receive a stream of JSON', () => {
		const port = 9006
		let serverSide: Promise<Record<string, unknown>[]>
		beforeAll(async () => {
			serverSide = redio<Record<string, unknown>>(`/my/stream/id`, {
				httpsPort: port,
				manifest: 'manifred',
				serverOptions,
				keepAliveTimeout: 400
			})
				.doto(console.log)
				.toArray()
			await redio([{ one: 1 }, { two: 'two' }, { three: [1, 'plus', { two: true }] }])
				.http(`https://localhost:${port}/my/stream/id`, {
					httpsPort: port,
					manifest: { wibble: true, wobble: 'false' },
					requestOptions
				})
				.toPromise()
				.then(() => {
					console.log('Sending ending')
				})
		})
		test('Stream arrives as expected', async () => {
			await expect(serverSide).resolves.toEqual([
				{ one: 1, manifred: { wibble: true, wobble: 'false' } },
				{ two: 'two', manifred: { wibble: true, wobble: 'false' } },
				{ three: [1, 'plus', { two: true }], manifred: { wibble: true, wobble: 'false' } }
			])
		})
		test('Server closes afterwards', async () => {
			await wait(500)
			await expect(
				got(`https://localhost:${port}/my/stream/id/debug.json`, { https, retry: 0, timeout: 200 })
			).rejects.toThrow(/Timeout/)
			await wait(500)
		})
	})
})
