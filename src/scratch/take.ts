import redio from '../redio'

async function run () {
	redio([1, 2, 3, 4, 5, 6], { debug: false })
	.take(Promise.resolve(4), { debug: false })
	.take(3, { debug: false })
	.each(console.log, { debug: true })
}

run().catch(console.error)
