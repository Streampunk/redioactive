import redio from '../redio'

describe('Appending values to stream', () => {
	test('Appends a single value', async () => {
		await expect(redio([1, 2, 3]).append(4).toArray()).resolves.toEqual([1, 2, 3, 4])
	})

	test('Appends a single resolved value', async () => {
		await expect(redio([1, 2, 3]).append(Promise.resolve(4)).toArray()).resolves.toEqual([
			1,
			2,
			3,
			4
		])
	})

	test('Appends to the empty stream', async () => {
		await expect(redio<number>([]).append(1).toArray()).resolves.toEqual([1])
	})

	test('Appends multiple values', async () => {
		await expect(redio([1, 2, 3]).append(4).append(5).append(6).toArray()).resolves.toEqual([
			1,
			2,
			3,
			4,
			5,
			6
		])
	})
})
