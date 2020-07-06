import redio from '../redio'

describe('Set up a pull stream', () => {
	test('Does it work', async () => {
		expect(redio([1, 2, 3]).http('/my/stream/id', { httpPort: 8001 })).toBeTruthy()
	})
})
