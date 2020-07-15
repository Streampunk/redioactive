import redio, { Funnel, end } from '../redio'

describe('Zipping two streams', () => {
	test('Zip two streams of equal length is as expected', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two', 'three'])
		await expect(numbers.zip(words).toArray()).resolves.toEqual([
			[1, 'one'],
			[2, 'two'],
			[3, 'three']
		])
	})
	test('Zip two empty streams', async () => {
		const empty1 = redio([])
		const empty2 = redio([])
		await expect(empty1.zip(empty2).toArray()).resolves.toEqual([])
	})
	test('Zip streams of different lengths - shorter first', async () => {
		const numbers = redio([1, 2])
		const words = redio(['one', 'two', 'three'])
		await expect(numbers.zip(words).toArray()).resolves.toEqual([
			[1, 'one'],
			[2, 'two']
		])
	})
	test('Zip streams of different lengths - shorter second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two'])
		await expect(numbers.zip(words).toArray()).resolves.toEqual([
			[1, 'one'],
			[2, 'two']
		])
	})
	test('Zip streams with one empty - empty first', async () => {
		const numbers = redio([])
		const words = redio(['one', 'two', 'three'])
		await expect(numbers.zip(words).toArray()).resolves.toEqual([])
	})
	test('Zip streams with one empty - empty second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio([])
		await expect(numbers.zip(words).toArray()).resolves.toEqual([])
	})
	test('Zip streams with big difference in lengths', async () => {
		const numbers = redio([1, 2, 3, 4, 5, 6, 7, 8, 8, 10, 11, 12, 13, 14, 15])
		const words = redio(['one', 'two', 'three'])
		await expect(numbers.zip(words).toArray()).resolves.toEqual([
			[1, 'one'],
			[2, 'two'],
			[3, 'three']
		])
	})
	test('Zip with different speed streams', async () => {
		const wait = (t: number) => new Promise<number>((r) => setTimeout(() => r(t), t * 5))
		function addWait(n: number): Funnel<number> {
			let count = 0
			return async () => (count < n ? await wait(++count) : end)
		}
		await expect(
			redio(addWait(4))
				.zip(redio(['one', 'two', 'three']))
				.toArray()
		).resolves.toEqual([
			[1, 'one'],
			[2, 'two'],
			[3, 'three']
		])
	})
})
