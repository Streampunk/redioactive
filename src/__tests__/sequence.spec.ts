import redio, { end, Funnel, Liquid, RedioPipe, isPipe } from '../redio'

describe('Testing sequences of pipes', () => {
	test('Sequence should flatten pipes', async () => {
		await expect(
			redio([redio([1, 2, 3]), redio([4, 5]), redio([6])])
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3, 4, 5, 6])
	})
	test('Flattens a single stream', async () => {
		await expect(
			redio([redio([1, 2, 3])])
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3])
	})
	test('Flattens a single empty stream', async () => {
		await expect(
			redio([redio([])])
				.sequence()
				.toArray()
		).resolves.toEqual([])
	})
	test('Handles empty stream at the start', async () => {
		await expect(
			redio([redio([]), redio([4, 5]), redio([6])])
				.sequence()
				.toArray()
		).resolves.toEqual([4, 5, 6])
	})
	test('Handles empty stream in the middle', async () => {
		await expect(
			redio([redio([1, 2, 3]), redio([]), redio([6])])
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3, 6])
	})
	test('Handles empty stream at the end', async () => {
		await expect(
			redio([redio([1, 2, 3]), redio([4, 5]), redio([])])
				.sequence()
				.toArray()
		).resolves.toEqual([1, 2, 3, 4, 5])
	})
	test('Slow consumer', async () => {
		const eachFn = jest.fn()
		await expect(
			redio([redio([1, 2, 3]), redio([4, 5]), redio([6])])
				.sequence<number>()
				.each(
					(x) =>
						new Promise<void>((resolve) => {
							setTimeout(() => {
								resolve()
								eachFn(x)
							}, 50)
						})
				)
				.toPromise()
		).resolves.toEqual(6)
		expect(eachFn).toHaveBeenCalledTimes(6)
	})
	function innerGenny(length: number, delay: number): Funnel<number> {
		let lengthCount = 0
		return () =>
			new Promise<Liquid<number>>((resolve, _reject) => {
				if (lengthCount++ >= length) {
					resolve(end)
				} else {
					setTimeout(() => {
						resolve(lengthCount)
					}, delay)
				}
			})
	}
	function genny(streams: number, delay: number): Funnel<RedioPipe<number>> {
		let streamCount = 0
		return () =>
			new Promise<Liquid<RedioPipe<number>>>((resolve, _reject) => {
				if (streamCount++ >= streams) {
					resolve(end)
				} else {
					setTimeout(() => {
						resolve(redio(innerGenny(streamCount, 20)))
					}, delay)
				}
			})
	}
	test.only('Slow producers', async () => {
		await expect(redio(genny(3, 40)).sequence().toArray()).resolves.toEqual([1, 1, 2, 1, 2, 3])
	})
	test('Is it a pipe? Is it a plane?', async () => {
		await expect(redio(genny(3, 20)).map(isPipe).toArray()).resolves.toEqual([true, true, true])
	})
})
