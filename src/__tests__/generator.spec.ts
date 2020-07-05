import { default as redio, Liquid, end, Funnel, Generator, RedioEnd, nil } from '../redio'

describe('Generate a stream by sync thunk', () => {
	const gen = (x: number) => {
		let count = 0
		return () => (count < x ? count++ : end)
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
})

describe('Generate a stream by async thunk', () => {
	const gen = (x: number): Funnel<number> => {
		let count = 0
		return () =>
			new Promise<Liquid<number>>((resolve) => {
				setTimeout(() => {
					resolve(count < x ? count++ : end)
				}, 5)
			})
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
	test('Value generate more than buffer size', async () => {
		await expect(redio(gen(20)).toArray()).resolves.toHaveLength(20)
	})
})

describe('Generate a stream by sync callback generator', () => {
	const gen = (x: number): Generator<number> => {
		let count = 0
		return (push: (t: number | RedioEnd) => void, next: () => void) => {
			push(count < x ? count++ : end)
			next()
		}
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
})

describe('Generate a stream by async callback generator', () => {
	const gen = (x: number): Generator<number> => {
		let count = 0
		return (push: (t: number | RedioEnd) => void, next: () => void) => {
			push(count < x ? count++ : end)
			setTimeout(next, 5)
		}
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
})

describe('Generate a stream from an array', () => {
	test('Array with no values', async () => {
		await expect(redio([]).toArray()).resolves.toHaveLength(0)
	})
	test('Array with one value', async () => {
		await expect(redio([42]).toArray()).resolves.toHaveLength(1)
	})
	test('Array with 5 values', async () => {
		await expect(redio([10, 20, 30, 40, 50]).toArray()).resolves.toHaveLength(5)
	})
	test('Array with 20 values - greater than buffer', async () => {
		await expect(
			redio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]).toArray()
		).resolves.toHaveLength(20)
	})
	test('Generate with sparse array', async () => {
		const a = new Array(5)
		a[0] = 0
		a[2] = 2
		a[4] = 4
		await expect(redio(a).toArray()).resolves.toEqual([0, 2, 4])
	})
	test('Generate with nil values', async () => {
		const a = [0, nil, 2, nil, 4]
		await expect(redio(a).toArray()).resolves.toEqual([0, 2, 4])
	})
})
