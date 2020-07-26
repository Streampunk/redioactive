import redio, { end, isEnd } from '../redio'

describe('Consming stream values', () => {
	test('Pass through a stream', async () => {
		await expect(
			redio([1, 2, 3])
				.consume((_err, x, push, next) => {
					push(x)
					next()
				})
				.toArray()
		).resolves.toEqual([1, 2, 3])
	})
	test('Works with an empty stream', async () => {
		await expect(
			redio([])
				.consume((_err, x, push, next) => {
					push(x)
					next()
				})
				.toArray()
		).resolves.toEqual([])
	})
	test('Can create an empty stream', async () => {
		await expect(
			redio([1, 2, 3])
				.consume((_err, _x, push, next) => {
					push(end)
					next()
				})
				.toArray()
		).resolves.toEqual([])
	})
	test('Double up values', async () => {
		await expect(
			redio([1, 2, 3])
				.consume((_err, x, push, next) => {
					push(x)
					push(x)
					next()
				})
				.toArray()
		).resolves.toEqual([1, 1, 2, 2, 3, 3])
	})
	test('Filter even values', async () => {
		await expect(
			redio([1, 2, 3, 4, 5, 6])
				.consume((_err, x, push, next) => {
					if (isEnd(x)) {
						push(end)
					} else if (x !== null && x % 2 === 0) {
						push(x)
					}
					next()
				})
				.toArray()
		).resolves.toEqual([2, 4, 6])
	})
	test('Handle errors', async () => {
		fail('Testing errors for consume not implemented')
	})
})
