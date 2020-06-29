import redio from '../redio'

async function run(): Promise<void> {
	redio([1, 2, 3], { debug: false })
		.append(4, { debug: false })
		.append(Promise.resolve(5), { debug: false })
		.each(console.log, { debug: false })
}

run().catch(console.error)
