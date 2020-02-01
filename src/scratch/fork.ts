import redio from '../redio'

let wait = (x: number) => new Promise<void>((resolve: () => void) => {
	setTimeout(resolve, x)
})

async function run () {
	let source = redio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], { debug: false })
	let f1 = source.fork({ debug: false })
	let f2 = source.fork({ debug: false })
	let f3 = source.fork({ debug: false })
	f1.each(async (x) => { await wait(0); console.log('f1', x) }).done(() => { console.log('f1 is done') })
	f2.each(async x => { await wait(0); console.log('f2', x) }).done(() => { console.log('f2 is done') })
	f3.each(async x => { await wait(0); console.log('f3', x) }).done(() => { console.log('f3 is done') })

}

run().catch(console.error)
