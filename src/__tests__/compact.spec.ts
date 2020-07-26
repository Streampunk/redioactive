import redio from '../redio'

describe('Compact the stream to truthy values only', () => {
	test('Compacts the example stream', async () => {
		await expect(redio([1, null, 2, undefined, 0, '', 3]).compact().toArray()).resolves.toEqual([
			1,
			2,
			3
		])
	})
	test('Compacts an empty stream', async () => {
		await expect(redio([]).compact().toArray()).resolves.toEqual([])
	})
	test('Does not compact a truthy stream', async () => {
		await expect(redio(['This', 'should', 'work', 2]).compact().toArray()).resolves.toEqual([
			'This',
			'should',
			'work',
			2
		])
	})
})
