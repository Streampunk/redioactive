import { default as redio, RedioEnd } from '../redio'

const wait = async (t: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, t)
	})

async function run(): Promise<void> {
	return new Promise((resolve) => {
		const gen1 = redio([0, 1, 2, 3, 4, 5, 6], { debug: false }).valve(
			async (v: number | RedioEnd) => {
				await wait(20)
				return v
			},
			{ debug: false }
		)
		const gen2 = redio(['A', 'B', 'C', 'D', 'E', 'F', 'G'], { debug: false }).valve(
			async (v: string | RedioEnd) => {
				await wait(10)
				return v
			},
			{ debug: false }
		)

		gen1
			.zip(gen2, { oneToMany: false, bufferSizeMax: 3, debug: true })
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
