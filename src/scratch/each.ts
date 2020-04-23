import redio from '../redio'

const wait = (x: number): Promise<void> =>
	new Promise<void>((resolve: () => void) => {
		setTimeout(resolve, x)
	})

async function run(): Promise<void> {
	redio([0, 1, 2, 3], { debug: false }).each(
		async (x) => {
			await wait(500)
			console.log(`Each: ${x}`)
		},
		{ debug: true }
	)
}

run().catch(console.error)
