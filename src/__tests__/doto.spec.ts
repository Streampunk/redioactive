import redio from '../redio'

describe('Doto side effect values', () => {
	test('Each is called the expected number of times', async () => {
		const dotoFn = jest.fn()
		await redio([1, 2, 3])
			.doto(dotoFn)
			.each(() => {
				/* void */
			})
			.toPromise()
		expect(dotoFn).toHaveBeenCalledTimes(3)
		expect(dotoFn.mock.calls).toEqual([[1], [2], [3]])
	})
	test('Words with an empty stream', async () => {
		const dotoFn = jest.fn()
		await redio([])
			.doto(dotoFn)
			.each(() => {
				/* void */
			})
			.toPromise()
		expect(dotoFn).not.toHaveBeenCalled()
	})
	test('Side effect example', async () => {
		await expect(
			redio([[1], [2], [3]])
				.doto((x) => {
					x.push(1)
				})
				.toArray()
		).resolves.toEqual([
			[1, 1],
			[2, 1],
			[3, 1]
		])
	})
})
