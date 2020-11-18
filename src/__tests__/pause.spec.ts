import redio, { Funnel, end, isValue, RedioEnd, RedioPipe } from '../redio'

describe('Stream pausing', () => {
	test('Pause a stream', async () => {
		let pauseCount = 0
		await expect(
			redio([1, 2, 3, 4, 5])
				.pause((t) => {
					if (isValue(t)) {
						const doPause = t > 2 && pauseCount < 3
						if (doPause) pauseCount++
						return doPause
					} else return false
				})
				.toArray()
		).resolves.toEqual([1, 2, 3, 3, 3, 3, 4, 5])
	})

	test('Pause with slow speed input stream', async () => {
		const wait = async (t: number) => new Promise<number>((r) => setTimeout(() => r(t), t * 5))
		function addWait(n: number): Funnel<number> {
			let count = 0
			return async () => (count < n ? await wait(++count) : end)
		}
		let pauseCount = 0
		await expect(
			(redio(addWait(5)) as RedioPipe<number>)
				.pause((t) => {
					if (isValue(t)) {
						const doPause = t > 2 && pauseCount < 3
						if (doPause) pauseCount++
						return doPause
					} else return false
				})
				.toArray()
		).resolves.toEqual([1, 2, 3, 3, 3, 3, 4, 5])
	})

	test('Pause with slow speed output stream', async () => {
		let pauseCount = 0
		await expect(
			redio([1, 2, 3, 4, 5])
				.pause((t) => {
					if (isValue(t)) {
						const doPause = t > 2 && pauseCount < 3
						if (doPause) pauseCount++
						return doPause
					} else return false
				})
				.valve<number>(async (v: number | RedioEnd) => {
					if (isValue(v)) {
						return new Promise<number>((resolve) => {
							setTimeout(() => resolve(v), 10)
						})
					} else return v
				})
				.toArray()
		).resolves.toEqual([1, 2, 3, 3, 3, 3, 4, 5])
	})
})
