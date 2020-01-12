import { default as redio, end } from '../redio'

let wait = async (t: number) => new Promise((resolve) => {
	setTimeout(resolve, t)
})

async function run () {
	redio([1, 2, 3, 4, 5, 6], { debug: false })
	.flatMap(x => redio(async (push, next) => {
		console.log(x)
		push(x)
		push(end)
		next()
	}), { debug: true })
	.each(console.log, { debug: true })
	.done(() => { console.log('There we go!') })
}

run().catch(console.error)
