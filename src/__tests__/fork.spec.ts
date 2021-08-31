import redio, { isEnd, isValue, Liquid, RedioOptions, RedioPipe } from '../redio'

const toArrayWait = (src: RedioPipe<number>, delay: number, options?: RedioOptions) => {
	const wait = (t: number) => new Promise<number>((r) => setTimeout(() => r(t), t))
	const result: Array<number> = []
	const promisedArray: Promise<Array<number>> = new Promise((resolve, reject) => {
		const sp = src.spout(async (tt: Liquid<number>) => {
			if (isEnd(tt)) {
				resolve(result)
			} else if (isValue(tt)) {
				if (delay > 0) await wait(delay)
				result.push(tt)
			}
		}, options)
		sp.catch(reject)
		return sp
	})
	return promisedArray
}

describe('Forking values in a stream', () => {
	test('Simple single fork', async () => {
		const src = redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 })
		const result = await src.fork().toArray()
		expect(result).toEqual([1, 2, 3, 4, 5, 6])
	})
	test('Fork to two streams', async () => {
		const src = redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 })
		const result = await Promise.all([src.fork().toArray(), src.fork().toArray()])
		expect(result).toEqual([
			[1, 2, 3, 4, 5, 6],
			[1, 2, 3, 4, 5, 6]
		])
	})
	test('Fork to three streams', async () => {
		const src = redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 })
		const result = await Promise.all([
			src.fork().toArray(),
			src.fork().toArray(),
			src.fork().toArray()
		])
		expect(result).toEqual([
			[1, 2, 3, 4, 5, 6],
			[1, 2, 3, 4, 5, 6],
			[1, 2, 3, 4, 5, 6]
		])
	})
	test('Fork to two streams with different delays', async () => {
		const src = redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 })
		const f1 = toArrayWait(src.fork({ bufferSizeMax: 1 }), 10, { bufferSizeMax: 1 })
		const f2 = toArrayWait(src.fork({ bufferSizeMax: 1 }), 50, { bufferSizeMax: 1 })
		const result = await Promise.all([f1, f2])
		expect(result).toEqual([
			[1, 2, 3, 4, 5, 6],
			[1, 2, 3, 4, 5, 6]
		])
	}, 1000)
	test('Fork to three streams with different delays', async () => {
		const src = redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 })
		const f1 = toArrayWait(src.fork({ bufferSizeMax: 1 }), 10, { bufferSizeMax: 1 })
		const f2 = toArrayWait(src.fork({ bufferSizeMax: 1 }), 30, { bufferSizeMax: 1 })
		const f3 = toArrayWait(src.fork({ bufferSizeMax: 1 }), 50, { bufferSizeMax: 1 })
		const result = await Promise.all([f1, f2, f3])
		expect(result).toEqual([
			[1, 2, 3, 4, 5, 6],
			[1, 2, 3, 4, 5, 6],
			[1, 2, 3, 4, 5, 6]
		])
	}, 1000)
	test('Async single fork & unfork', async () => {
		const src = redio([1, 2, 3, 4, 5, 6])
		const f1 = src.fork({ bufferSizeMax: 1 })
		const f1Result = toArrayWait(f1, 10)

		const result = await new Promise((resolve) => {
			setTimeout(() => {
				const f2 = src.fork({ bufferSizeMax: 1 })
				setTimeout(() => src.unfork(f2), 10)

				resolve(Promise.all([f1Result, toArrayWait(f2, 4)]))
			}, 10)
		})

		expect(result).toEqual([
			[1, 2, 3, 4, 5, 6],
			[3, 4]
		])
	})
})
