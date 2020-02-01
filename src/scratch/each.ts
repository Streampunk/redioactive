import redio from '../redio'

let wait = (x: number) => new Promise<void>((resolve: () => void) => {
	setTimeout(resolve, x)
})

async function run () {
	redio([0, 1, 2, 3], { debug: false }).each(async x => { await wait(500); console.log(`Each: ${x}`) }, { debug: true })
}

run().catch(console.error)
