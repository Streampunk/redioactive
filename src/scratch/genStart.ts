import { default as redio, end, RedioEnd, valve, spout } from '../redio'

const wait = async (t: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, t)
	})

const doStream = async (delay: number): Promise<void> => {
	let counter = 0
	const gen = redio<number>(
		async (): Promise<number | RedioEnd> => (counter < 6 ? counter++ : end),
		{ bufferSizeMax: 3, debug: true }
	)

	if (delay > 0) {
		console.log('Waiting for start')
		await wait(100)
		console.log('Waited for start')
	}

	return new Promise<void>((resolve) => {
		const testValve = new valve<number, number>(
			async (count: number | RedioEnd) => {
				await wait(200)
				return count
			},
			{ debug: delay > 0 }
		)

		const testSpout = new spout<number>(async (count: number | RedioEnd) => console.log(count), {
			debug: true
		})

		const pipe =
			delay > 0
				? testSpout.connectSrc(testValve)
				: testValve.each(async (count) => console.log(count), { debug: true })

		pipe
			.done(() => {
				console.log('There we go!')
				resolve()
			})
			.catch(console.error)

		testValve.connectSrc(gen)
	})
}

async function run(): Promise<void> {
	console.log('No waiting for start...')
	await doStream(0)
	console.log('\nAgain but with wait...')
	await doStream(20)
}

run()
	.then(() => {
		console.log('\nFinished')
	})
	.catch(console.error)
	.finally(() => console.log('Finally!'))
