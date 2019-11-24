import redio from '../redio'

async function run () {
	redio([1, 2, 3]).append(4).each(console.log)
}

run().catch(console.error)
