import redio from '../redio'

async function run () {
	redio([1, 2, 3], { debug: true }).each(x => { console.log(`Each: ${x}`) })
}

run().catch(console.error)
