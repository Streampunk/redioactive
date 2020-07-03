import redio from '../redio'

describe('Dropping values from the start of a stream', () => {
	test('By default, drops a single value from a stream', async () => {
		await expect(redio([1, 2, 3, 4]).drop().toArray()).resolves.toEqual([2, 3, 4])
	})
	test('Drops a single value from a stream', async () => {
		await expect(redio([1, 2, 3, 4]).drop(1).toArray()).resolves.toEqual([2, 3, 4])
	})
	test('Drops two values from a stream', async () => {
		await expect(redio([1, 2, 3, 4]).drop(2).toArray()).resolves.toEqual([3, 4])
	})
	test('Drops two values by a promise from a stream', async () => {
		await expect(redio([1, 2, 3, 4]).drop(Promise.resolve(2)).toArray()).resolves.toEqual([3, 4])
	})
	test('Copes with an empty stream', async () => {
		await expect(redio([]).drop().toArray()).resolves.toEqual([])
	})
	test('Copes with an empty stream and large number', async () => {
		await expect(redio([]).drop(42).toArray()).resolves.toEqual([])
	})
	test('Can be chained', async () => {
		await expect(redio([1, 2, 3, 4]).drop(1).drop(Promise.resolve(2)).toArray()).resolves.toEqual([
			4
		])
	})
})
