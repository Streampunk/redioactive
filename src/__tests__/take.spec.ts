import redio from '../redio'

describe('Taking values from the start of the stream', () => {
	test('By default, takes a single value from the stream', async () => {
		await expect(redio([1, 2, 3, 4]).take().toArray()).resolves.toEqual([1])
	})
	test('Take a single value from a stream', async () => {
		await expect(redio([1, 2, 3, 4]).take(1).toArray()).resolves.toEqual([1])
	})
	test('Take two values from a stream', async () => {
		await expect(redio([1, 2, 3, 4]).take(2).toArray()).resolves.toEqual([1, 2])
	})
	test('Copes with an empty stream', async () => {
		await expect(redio([]).take(3).toArray()).resolves.toEqual([])
	})
	test('Takes more values than the stream length', async () => {
		await expect(redio([1, 2, 3, 4]).take(10).toArray()).resolves.toEqual([1, 2, 3, 4])
	})
	test('Takes the same number as stream length', async () => {
		await expect(redio([1, 2, 3, 4]).take(4).toArray()).resolves.toEqual([1, 2, 3, 4])
	})
	test('Drops two values by promise', async () => {
		await expect(redio([1, 2, 3, 4]).take(Promise.resolve(2)).toArray()).resolves.toEqual([1, 2])
	})
	test('Can be chained', async () => {
		await expect(redio([1, 2, 3, 4]).take(3).take(Promise.resolve(2)).toArray()).resolves.toEqual([
			1, 2
		])
	})
})
