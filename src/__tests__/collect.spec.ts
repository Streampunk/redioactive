import redio from '../redio'

describe('Collecting all values in a stream', () => {
	test('Collects a few values', async () => {
		await expect(redio([1, 2, 3]).collect().toArray()).resolves.toEqual([[1, 2, 3]])
	})
	test('Works with an empty stream', async () => {
		await expect(redio([]).collect().toArray()).resolves.toEqual([[]])
	})
	test('Test with each', async () => {
		const eachFn = jest.fn()
		await expect(redio([1, 2, 3]).collect().each(eachFn).toPromise()).resolves.toEqual([1, 2, 3])
		expect(eachFn).toHaveBeenCalledTimes(1)
		expect(eachFn).toHaveBeenCalledWith([1, 2, 3])
	})
	test('Rejects on error', async () => {
		// const errorFn = jest.fn()
		// await expect(redio(() => { throw new Error('Bang') }).errors(console.error).each(errorFn).toPromise()).resolves.toEqual([])
		// expect(errorFn).toHaveBeenCalledTimes(1)
		fail('Need to test collection errors')
	})
})
