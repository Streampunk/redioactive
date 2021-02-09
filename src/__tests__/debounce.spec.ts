import redio, { end, Funnel, RedioEnd, Liquid } from '../redio'

describe('Debounce vales', () => {
	test('Sends the last value', async () => {
		await expect(redio([1, 2, 3]).debounce(10).toArray()).resolves.toEqual([3])
	})
	test('Works with an empty stream', async () => {
		await expect(redio([]).debounce(10).toArray()).resolves.toEqual([])
	})
	const genny: () => Funnel<number> = () => {
		let counter = 0
		return () =>
			new Promise((resolve) => {
				if (counter++ >= 3) {
					resolve(end)
				} else {
					setTimeout(() => {
						resolve(counter)
					}, counter * 10)
				}
			})
	}
	test('Generated stream with delay', async () => {
		await expect(redio(genny()).debounce(30).toArray()).resolves.toEqual([2, 3])
	})
	test('Debounce with negative value', async () => {
		await expect(redio([1, 2, 3]).debounce(-10).toArray()).resolves.toEqual([3])
	})

	let pusher: (v: number | RedioEnd | PromiseLike<number | RedioEnd>) => void = () => {
		/* void */
	}
	const funnel: Funnel<number> = () =>
		new Promise<Liquid<number>>((resolve) => {
			pusher = resolve
		})
	const wait = (t: number) =>
		new Promise<void>((resolve) => {
			setTimeout(resolve, t)
		})
	test('Funnel-created debouncable stream', async () => {
		const stream = redio(funnel).debounce(75).toArray()
		pusher(1)
		await wait(10)
		pusher(2)
		await wait(100)
		pusher(3)
		await wait(50)
		pusher(end)
		await expect(stream).resolves.toEqual([2, 3])
	})
})
