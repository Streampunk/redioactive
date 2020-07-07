import redio from '../redio'
import got from 'got'

function wait(t: number): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, t)
	})
}

describe('Set up a simple http pull stream', () => {
	beforeAll(async () => {
		redio([1, 2, 3]).http('/my/stream/id', { httpPort: 8001 })
		await wait(500)
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
		await wait(1000)
	})
})
