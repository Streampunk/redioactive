import redio from '../redio'

async function run () {
	let result = redio([1, 2, 3, 4, 5, 6], { debug: false })
	.drop(Promise.resolve(2), { debug: false })
	// .drop(2, { debug: false })
	.toArray({ debug: false })
	console.log(await result)
}

run().catch(console.error)
