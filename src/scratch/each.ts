import redio from '../redio'

async function run () {
	redio([1, 2, 3]).each(x => { console.log(x) })
}

run().catch(console.error)
