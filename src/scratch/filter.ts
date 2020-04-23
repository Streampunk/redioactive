import redio from '../redio'

async function run(): Promise<void> {
	redio([1, 2, 3, 4, 5, 6], { debug: false })
		.filter((x) => x % 2 !== 0, { debug: false })
		.each(console.log, { debug: true })
		.done(() => {
			console.log('There we go!')
		})
}

run().catch(console.error)
