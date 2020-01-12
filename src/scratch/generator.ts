import { default as redio, LotsOfLiquid, end } from '../redio'

let wait = async (t: number) => new Promise((resolve) => {
	setTimeout(resolve, t)
})

async function run () {
	let counter = 0
	// redio(async (push: (t: LotsOfLiquid<number>) => void, next: () => void) => {
	// 	await wait(500)
	// 	push(counter < 5 ? counter++ : end)
	// 	if (counter <= 5) {
	// 		await wait(1500)
	// 		next()
	// 	}
	// }, { debug: true })
	redio(async () => {
		return counter < 6 ? counter++ : end
 	}, { oneToMany: true })
	.each(console.log, { debug: true })
	.done(() => { console.log('There we go!') })
}

run().catch(console.error)
