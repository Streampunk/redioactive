import redio from '../redio'

async function run () {
	redio([0, 1, 2, 3], { debug: false }).each(x => { console.log(`Each: ${x}`) }, { debug: true })
}

run().catch(console.error)
