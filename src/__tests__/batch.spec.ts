import redio from '../redio'

describe('Batching values in a stream', () => {
	test('Batches 5 values into batch length 2', async () => {
		await expect(redio([1, 2, 3, 4, 5]).batch(2).toArray()).resolves.toEqual([[1, 2], [3, 4], [5]])
	})
	test('Batches 6 values into batch length 2', async () => {
		await expect(redio([1, 2, 3, 4, 5, 6]).batch(2).toArray()).resolves.toEqual([
			[1, 2],
			[3, 4],
			[5, 6]
		])
	})
	test('Works with an empty stream', async () => {
		await expect(redio([]).batch(2).toArray()).resolves.toEqual([])
	})
	test('Batch size bigger than stream', async () => {
		await expect(redio([1, 2, 3]).batch(4).toArray()).resolves.toEqual([[1, 2, 3]])
	})
	test('Batch size and stream size are the same', async () => {
		await expect(redio([1, 2, 3]).batch(3).toArray()).resolves.toEqual([[1, 2, 3]])
	})
	test('Batch size is a promise', async () => {
		await expect(redio([1, 2, 3, 4, 5]).batch(Promise.resolve(2)).toArray()).resolves.toEqual([
			[1, 2],
			[3, 4],
			[5]
		])
	})
	test('Batches 5 values into batch length 1', async () => {
		await expect(redio([1, 2, 3, 4, 5]).batch(1).toArray()).resolves.toEqual([
			[1],
			[2],
			[3],
			[4],
			[5]
		])
	})
	test('Batch size 0 is an error', async () => {
		await expect(redio([1, 2, 3]).batch(0).toArray()).rejects.toThrowError(/Batch/)
	})
})
