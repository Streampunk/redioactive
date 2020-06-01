import { default as redio, end } from '../redio'

const wait = async (t: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, t)
	})

const doStream = async (delay: number): Promise<void> => {
	let counter = 0
	const gen = redio<number>(
		async () => {
			return counter < 6 ? counter++ : end
		},
		{ bufferSizeMax: 3, debug: true }
	)

	if (delay > 0) {
		console.log('Waiting for start')
		await wait(20)
		console.log('Waited for start')
	}

	return new Promise<void>((resolve) => {
		console.log('Connecting', gen)
		gen
			.valve<number>(async (count) => count, { debug: delay > 0 })
			.each(console.log, { debug: true })
			.done(async () => {
				console.log('There we go!')
				return resolve()
			})
			.catch(console.error)
	})
}

async function run(): Promise<void> {
	console.log('No waiting for start...')
	await doStream(0)
	console.log('\nAgain but with wait...')
	await doStream(20)
}

run().catch(console.error)
