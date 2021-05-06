import redio, { Funnel, end, Valve, RedioEnd, isValue, nil } from '../redio'

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
		const wordsF = redio(['une', 'deux', 'trois'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, 'three', 'trois']
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
		const wordsF = redio(['une', 'deux', 'trois'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux']
		])
	})
	test('Zip three streams of different lengths - shorter second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two'])
		const wordsF = redio(['une', 'deux', 'trois'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, end, 'trois']
		])
	})
	test('Zip three streams of different lengths - shorter third', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, 'three', end]
		])
	})
	test('Zip one stream with null array', async () => {
		const numbers = redio([1, 2, 3])
		await expect(numbers.zipEach([]).toArray()).resolves.toEqual([[1], [2], [3]])
	})
	test('Zip two streams with one empty - empty second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio([])
		await expect(numbers.zipEach([words]).toArray()).resolves.toEqual([
			[1, end],
			[2, end],
			[3, end]
		])
	})
	test('Zip three streams with one empty - empty first', async () => {
		const numbers = redio([])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux', 'trois'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([])
	})
	test('Zip three streams with one empty - empty second', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio([])
		const wordsF = redio(['une', 'deux', 'trois'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, end, 'une'],
			[2, end, 'deux'],
			[3, end, 'trois']
		])
	})
	test('Zip three streams with one empty - empty third', async () => {
		const numbers = redio([1, 2, 3])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio([])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', end],
			[2, 'two', end],
			[3, 'three', end]
		])
	})
	test('Zip three streams with big difference in lengths', async () => {
		const numbers = redio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
		const words = redio(['one', 'two', 'three'])
		const wordsF = redio(['une', 'deux', 'trois'])
		await expect(numbers.zipEach([words, wordsF]).toArray()).resolves.toEqual([
			[1, 'one', 'une'],
			[2, 'two', 'deux'],
			[3, 'three', 'trois'],
			[4, end, end],
			[5, end, end],
			[6, end, end],
			[7, end, end],
			[8, end, end],
			[9, end, end],
			[10, end, end],
			[11, end, end],
			[12, end, end]
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

	test('Zip with change of source stream', async () => {
		const numbers = redio([1, 2, 3, 4, 5, 6, 7, 8], { bufferSizeMax: 2 })
		const wordsEN = redio(['one', 'two', 'three'], { bufferSizeMax: 1 })
		const wordsFR = redio(['une', 'deux', 'trois'], { bufferSizeMax: 1 })

		let switched = false
		const sourcePipes = [wordsEN]

		const endValve: Valve<
			[number | RedioEnd, ...(string | RedioEnd)[]],
			[number | RedioEnd, ...(string | RedioEnd)[]]
		> = async (frames) => {
			if (isValue(frames)) {
				// console.log('end valve:', frames, frames.length)
				if (frames.reduce((acc, f) => acc && isValue(f), true)) {
					return frames
				}
				if (!switched) {
					// a source has ended, switch to new source
					sourcePipes.splice(0)
					sourcePipes.push(wordsFR)
				}
				switched = true
				return nil //[frames[0], ...[]]
			} else {
				return frames
			}
		}
		const strValve: Valve<
			[number | RedioEnd, ...(string | RedioEnd)[]],
			[number | RedioEnd, ...(string | RedioEnd)[]]
		> = async (frames) => {
			if (isValue(frames)) {
				// console.log('str valve:', frames)
				return frames
			} else {
				return frames
			}
		}

		const pipe = numbers.zipEach(sourcePipes).valve(endValve).valve(strValve)
		await expect(pipe.toArray()).resolves.toEqual([
			[1, 'one'],
			[2, 'two'],
			[3, 'three'],
			// [4],
			// [5],
			[6, 'une'],
			[7, 'deux'],
			[8, 'trois']
		])
	})
})
