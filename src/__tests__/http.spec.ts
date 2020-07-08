import redio from '../redio'
import got from 'got'

function wait(t: number): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, t)
	})
}

describe('Run a sequence of pull tests', () => {
	wait(1)
	describe('Set up a simple http pull stream of number', () => {
		beforeAll(async () => {
			redio([1, 2, 3]).http('/my/stream/id', { httpPort: 8001 })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>('http://localhost:8001/my/stream/id/debug.json', {
				responseType: 'json'
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'http',
				body: 'primitive',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpPort: 8001
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
			console.log(debug.body)
		})
		test('Pull the first value', async () => {
			const value = await got('http://localhost:8001/my/stream/id/1', { responseType: 'json' })
			expect(value.body).toBe(1)
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('1')
			expect(value.headers['redioactive-nextid']).toBe('2')
		})
		test('Get an empty manifest', async () => {
			const manifest = await got('http://localhost:8001/my/stream/id/manifest.json', {
				responseType: 'json'
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got('http://localhost:8001/my/stream/id/end')
			await wait(500)
		})
	})

	describe('Set up a simple http pull stream of string', () => {
		const port = 8001
		beforeAll(async () => {
			redio(['one', 'two', 'three']).http('my/stream/id////', { httpPort: port })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>(`http://localhost:${port}/my/stream/id/debug.json`, {
				responseType: 'json'
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'http',
				body: 'primitive',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpPort: port,
				root: '/my/stream/id'
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
			console.log(debug.body)
		})
		test('Pull the first value', async () => {
			const value = await got(`http://localhost:${port}/my/stream/id/1`, { responseType: 'json' })
			expect(value.body).toBe('one')
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('1')
			expect(value.headers['redioactive-nextid']).toBe('2')
		})
		test('Get an empty manifest', async () => {
			const manifest = await got(`http://localhost:${port}/my/stream/id/manifest.json`, {
				responseType: 'json'
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got(`http://localhost:${port}/my/stream/id/end`)
			await wait(500)
		})
	})

	describe('Set up a simple http pull stream of json', () => {
		const port = 8001
		beforeAll(async () => {
			redio([{ one: 1 }, { two: 2 }, { three: 3 }]).http('my/stream/id2/', { httpPort: port })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>(`http://localhost:${port}/my/stream/id2/debug.json`, {
				responseType: 'json'
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'http',
				body: 'json',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpPort: port,
				root: '/my/stream/id2'
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
			console.log(debug.body)
		})
		test('Pull the first value', async () => {
			const value = await got(`http://localhost:${port}/my/stream/id2/1`, { responseType: 'json' })
			expect(value.body).toEqual({ one: 1 })
			expect(value.headers['content-type']).toBe('application/json')
			expect(value.headers['redioactive-id']).toBe('1')
			expect(value.headers['redioactive-nextid']).toBe('2')
		})
		test('Get an empty manifest', async () => {
			const manifest = await got(`http://localhost:${port}/my/stream/id2/manifest.json`, {
				responseType: 'json'
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got(`http://localhost:${port}/my/stream/id2/end`)
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
			]).http('my/stream/id2/', { httpPort: port, blob: 'data' })
			// await wait(500)
		})
		test('Check debug info', async () => {
			const debug = await got<any>(`http://localhost:${port}/my/stream/id2/debug.json`, {
				responseType: 'json'
			})
			expect(debug.body).toBeTruthy()
			expect(debug.headers['content-type']).toBe('application/json')
			expect(debug.body.info).toMatchObject({
				type: 'pull',
				protocol: 'http',
				body: 'blob',
				idType: 'counter',
				delta: 'one',
				manifest: {},
				httpPort: port,
				root: '/my/stream/id2'
			})
			expect(debug.body.tChestSize).toBe(4)
			expect(debug.body.ended).toBe(true)
			console.log(debug.body)
		})
		test('Pull the first value', async () => {
			const value = await got(`http://localhost:${port}/my/stream/id2/1`, {
				responseType: 'buffer'
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
		test('Get an empty manifest', async () => {
			const manifest = await got(`http://localhost:${port}/my/stream/id2/manifest.json`, {
				responseType: 'json'
			})
			expect(manifest.body).toEqual({})
			expect(manifest.headers['content-type']).toBe('application/json')
			expect(manifest.headers['content-length']).toBe('2')
		})
		afterAll(async () => {
			await got(`http://localhost:${port}/my/stream/id2/end`)
			await wait(500)
		})
	})
})
