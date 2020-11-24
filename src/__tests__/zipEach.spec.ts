import redio, { Funnel, end } from '../redio'

describe('Zipping multiple streams', () => {
	test('Zip two streams of equal length is as expected', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two', 'three'])
		await expect(numbers.zipEach([words]).toArray()).resolves.toEqual([
			[1, 'one'],
			[2, 'two'],
			[3, 'three']
		])
	})
	test('Zip three streams of equal length is as expected', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux', 'troix'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, 'three', 'troix']
		])
	})
	test('Zip three empty streams', async () => {
		const empty1 = redio([])
		const empty2 = redio([])
		const empty3 = redio([])
		await expect(empty1.zipEach([empty2, empty3]).toArray()).resolves.toEqual([])
	})
	test('Zip three streams of different lengths - shorter first', async () => {
		const numbers = redio([1, 2])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux', 'troix'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux']
		])
	})
	test('Zip three streams of different lengths - shorter second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two'])
		const wordsF = redio(['une', 'deux', 'troix'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, 'troix']
		])
	})
	test('Zip three streams of different lengths - shorter third', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, 'three']
		])
	})
	test('Zip one stream with null array', async () => {
		const numbers = redio([1, 2, 3])
		await expect(numbers.zipEach([]).toArray()).resolves.toEqual([[1], [2], [3]])
	})
	test('Zip two streams with one empty - empty second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio([])
		await expect(numbers.zipEach([words]).toArray()).resolves.toEqual([[1], [2], [3]])
	})
	test('Zip three streams with one empty - empty first', async () => {
		const numbers = redio([])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux', 'troix'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([])
	})
	test('Zip three streams with one empty - empty second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio([])
		const wordsF = redio(['une', 'deux', 'troix'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'une'],
			[2, 'deux'],
			[3, 'troix']
		])
	})
	test('Zip three streams with one empty - empty third', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio([])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one'],
			[2, 'two'],
			[3, 'three']
		])
	})
	test('Zip three streams with big difference in lengths', async () => {
		const numbers = redio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux', 'troix'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, 'three', 'troix'],
			// eslint-disable-next-line prettier/prettier
			[4], [5],	[6], [7],	[8], [9], [10],	[11], [12],	[13], [14], [15]
		])
	})
	test('Zip with different speed streams', async () => {
		const wait = (t: number) => new Promise<number>((r) => setTimeout(() => r(t), t * 5))
		function addWait(n: number): Funnel<number> {
			let count = 0
			return async () => (count < n ? await wait(++count) : end)
		}

		await expect(
			redio(addWait(3))
				.zipEach([redio(['one', 'two', 'three'])])
				.toArray()
		).resolves.toEqual([
			[1, 'one'],
			[2, 'two'],
			[3, 'three']
		])
	})
})