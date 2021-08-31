import redio from '../redio'

describe('Testing flat mapping of a stream to streams', () => {
	test('Convert some uppercase strings to lowercase', async () => {
		await expect(
			redio(['ONE', 'Two', 'ThReE'])
				.flatMap((x) => redio<string>([x.toLowerCase()]))
				.toArray()
		).resolves.toEqual(['one', 'two', 'three'])
	})
	test('Copes with an empty streem', async () => {
		await expect(
			redio([])
				.flatMap((x) => redio([+x]))
				.toArray()
		).resolves.toEqual([])
	})
	test('Empty out a stream', async () => {
		await expect(
			redio([1, 2, 3])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				.flatMap((_x) => redio([]))
				.toArray()
		).resolves.toEqual([])
	})
	test('Double up a stream', async () => {
		await expect(
			redio([1, 2, 3])
				.flatMap((x) => redio([x, x]))
				.toArray()
		).resolves.toEqual([1, 1, 2, 2, 3, 3])
	})
})
