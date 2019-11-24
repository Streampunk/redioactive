import redio from '../redio'

async function run () {
	console.log(await redio([1, 2, 3]).toArray())
}

run().catch(console.error)
