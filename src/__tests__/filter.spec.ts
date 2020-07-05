import redio from '../redio'

describe('Filtering values in a stream', () => {
	test('Filters even values', async () => {
		await expect(
			redio([1, 2, 3, 4, 5, 6])
				.filter((x) => x % 2 === 0)
				.toArray()
		).resolves.toEqual([2, 4, 6])
	})
	test('Matches everything', async () => {
		await expect(
			redio([1, 2, 3])
				.filter(() => true)
				.toArray()
		).resolves.toEqual([1, 2, 3])
	})
	test('Matches nothing', async () => {
		await expect(
			redio([1, 2, 3])
				.filter(() => false)
				.toArray()
		).resolves.toEqual([])
	})
	test('Works with an empty stream', async () => {
		await expect(
			redio<number>([])
				.filter((x) => x % 2 === 0)
				.toArray()
		).resolves.toEqual([])
	})
	test('Filters with promises', async () => {
		await expect(
			redio([1, 2, 3, 4, 5, 6])
				.filter(
					(x) =>
						new Promise<boolean>((resolve) => {
							setTimeout(() => {
								resolve(x % 2 === 0)
							}, 5)
						})
				)
				.toArray()
		).resolves.toEqual([2, 4, 6])
	})
})
