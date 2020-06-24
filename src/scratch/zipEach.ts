import { default as redio } from '../redio'

async function run(): Promise<void> {
	return new Promise((resolve) => {
		const gen1 = redio([0, 1, 2, 3], { debug: false })
		const gen2 = redio(['A', 'B', 'C'], { debug: false })
		const gen3 = redio(['D', 'E', 'F'], { debug: false })
		const gen4 = redio(['G', 'H', 'I'], { debug: false })

		gen1
			.zipEach([gen2, gen3, gen4], { oneToMany: false, bufferSizeMax: 3, debug: true })
			.each(async (v: Array<number | string> | number | string) => console.log(v), { debug: false })
			.done(() => {
				console.log('There we go!')
				resolve()
			})
	})
}

run()
	.then(() => {
		console.log('\nFinished')
	})
	.catch(console.error)
