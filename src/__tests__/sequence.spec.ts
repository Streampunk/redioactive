import redio from '../redio'

describe('Testing sequences of pipes', () => {
	test.only('Sequence should flatten pipes', async () => {
		await expect(
			redio([redio([1, 2, 3]), redio([4, 5]), redio([6])])
				.doto(console.log)
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3, 4, 5, 6])
	})
	test('Flattens a single stream', async () => {
		await expect(
			redio([redio([1, 2, 3])])
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3])
	})
	test('Flattens a single empty stream', async () => {
		await expect(
			redio([redio([])])
				.sequence()
				.toArray()
		).resolves.toEqual([])
	})
	test('Handles empty stream at the start', async () => {
		await expect(
			redio([redio([]), redio([4, 5]), redio([6])])
				.sequence()
				.toArray()
		).resolves.toEqual([4, 5, 6])
	})
	test('Handles empty stream in the middle', async () => {
		await expect(
			redio([redio([1, 2, 3]), redio([]), redio([6])])
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3, 6])
	})
	test('Handles empty stream at the end', async () => {
		await expect(
			redio([redio([1, 2, 3]), redio([4, 5]), redio([])])
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3, 4, 5])
	})
	test('Slow consumer', async () => {
		const eachFn = jest.fn()
		await expect(
			redio([redio([1, 2, 3]), redio([4, 5]), redio([6])])
				.sequence<number>()
				.each(
					(x) =>
						new Promise<void>((resolve) => {
							setTimeout(() => {
								resolve()
								eachFn(x)
							}, 50)
						})
				)
				.toPromise()
		).resolves.toEqual(6)
		expect(eachFn).toHaveBeenCalledTimes(6)
	})
})
