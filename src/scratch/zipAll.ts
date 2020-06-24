import { default as redio, zipAll, RedioEnd } from '../redio'

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
		const gen2 = redio([10, 11, 12, 13, 14, 15, 16], { debug: false }).valve(
			async (v: number | RedioEnd) => {
				await wait(10)
				return v
			},
			{ debug: false }
		)

		new zipAll<number>({ oneToMany: false, bufferSizeMax: 3, debug: true })
			.connectSrc([gen1, gen2])
			.each(async (v: number | number[]) => console.log(v), { debug: false })
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
