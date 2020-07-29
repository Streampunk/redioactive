import redio, { nil } from '../redio'

describe('Finding a value in a stream', () => {
	test('Finds a value', async () => {
		await expect(
			redio([1, 2, 3])
				.find((x) => x >= 2)
				.toArray()
		).resolves.toEqual([2])
	})
	test('Works with an empty stream', async () => {
		await expect(
			redio([])
				.find((x) => x >= 2)
				.toArray()
		).resolves.toEqual([])
	})
	test('Documentation example', async () => {
		const docs = [
			{ name: 'one', value: 1 },
			{ name: 'two', value: 2 },
			{ name: 'three', value: 3 }
		]
		await expect(
			redio(docs)
				.find((x) => x.value >= 2)
				.toArray()
		).resolves.toEqual([{ name: 'two', value: 2 }])
	})
	test('No matches', async () => {
		await expect(
			redio([1, 2, 3])
				.find(() => false)
				.toArray()
		).resolves.toEqual([])
	})
	test('Matches the first', async () => {
		await expect(
			redio([1, 2, 3])
				.find(() => true)
				.toArray()
		).resolves.toEqual([1])
	})
	test('No matches - toPromise', async () => {
		await expect(
			redio([1, 2, 3])
				.find(() => false)
				.each(() => {
					/* void */
				})
				.toPromise()
		).resolves.toEqual(nil)
	})
	test('Matches the first - toPromise', async () => {
		await expect(
			redio([1, 2, 3])
				.find(() => true)
				.each(() => {
					/* void */
				})
				.toPromise()
		).resolves.toEqual(1)
	})
	test('Finds a value with a promise', async () => {
		await expect(
			redio([1, 2, 3])
				.find((x) => Promise.resolve(x >= 2))
				.toArray()
		).resolves.toEqual([2])
	})
})
