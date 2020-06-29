import redio from '../redio'

const wait = (x: number): Promise<void> =>
	new Promise<void>((resolve: () => void) => {
		setTimeout(resolve, x)
	})

async function run(): Promise<void> {
	const source = redio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], { debug: false })
	const f1 = source.fork({ debug: false })
	const f2 = source.fork({ debug: false })
	const f3 = source.fork({ debug: false })
	f1.each(async (x) => {
		await wait(0)
		console.log('f1', x)
	}).done(() => {
		console.log('f1 is done')
	})
	f2.each(async (x) => {
		await wait(0)
		console.log('f2', x)
	}).done(() => {
		console.log('f2 is done')
	})
	f3.each(async (x) => {
		await wait(0)
		console.log('f3', x)
	}).done(() => {
		console.log('f3 is done')
	})
}

run().catch(console.error)
