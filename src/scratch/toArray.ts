import redio from '../redio'

async function run(): Promise<void> {
	console.log(await redio([1, 2, 3], { debug: true }).toArray())
}

run().catch(console.error)
