import redio from '../redio'

async function wait<T> (v: T): Promise<T> {
	 return new Promise((resolve) => {
		 setTimeout(() => resolve(v), 500)
	 })
}

async function run () {
	redio([1, 2, 3], { debug: false })
	.map(x => wait(x + 1), { debug: false })
	.each(console.log, { debug: false })
	.done(() => { console.log('There we go!') })
}

run().catch(console.error)
