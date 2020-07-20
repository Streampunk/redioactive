import redio, { end } from '../redio'

describe('Mapping values in a stream', () => {
	test('Convert some uppercase strings to lowercase', async () => {
		await expect(
			redio(['ONE', 'Two', 'ThReE'])
				.map((x) => x.toLowerCase())
				.toArray()
		).resolves.toEqual(['one', 'two', 'three'])
	})
	test('Convert strings to numbers', async () => {
		await expect(
			redio(['1', '-2.3', '42'])
				.map((x) => +x)
				.toArray()
		).resolves.toEqual([1, -2.3, 42])
	})
	test('Copes with an empty streem', async () => {
		await expect(
			redio([])
				.map((x) => +x)
				.toArray()
		).resolves.toEqual([])
	})
	test('Mapping via a promise', async () => {
		await expect(
			redio(['1', '2', '3'])
				.map<number>(
					(x) =>
						new Promise<number>((resolve) => {
							setTimeout(() => resolve(+x), 1)
						})
				)
				.toArray()
		).resolves.toEqual([1, 2, 3])
	})
	test('One to many mapping - double up', async () => {
		await expect(
			redio(['1', '2', '3'])
				.map((x) => [+x, +x], { oneToMany: true })
				.toArray()
		).resolves.toEqual([1, 1, 2, 2, 3, 3])
	})
	test('Many to less mapping - select evens', async () => {
		await expect(
			redio([1, 2, 3, 4, 5, 6])
				.map((x) => (x % 2 === 0 ? [x] : []), { oneToMany: true })
				.toArray()
		).resolves.toEqual([2, 4, 6])
	})
	test('One to many with end', async () => {
		await expect(
			redio([1, 2, 3, 4, 5, 6])
				.map((x) => (x < 4 ? [x] : [4, end]), { oneToMany: true })
				.toArray()
		).resolves.toEqual([1, 2, 3, 4])
	})
})
