import { default as redio, nil } from '../redio'

async function run(): Promise<void> {
	redio([1, 2, 3, 5, 5, 2, 2, 5], { debug: false })
		.map((x) => {
			if (x === 2) throw new Error('This is a number two!')
			else return x
		})
		.errors((err) => {
			console.error('Found an error', err.message)
			return nil
		})
		.each(
			(x) => {
				console.log(`Each: ${x}`)
			},
			{ rejectUnhandled: true }
		)
		.catch((err: Error) => {
			console.error(err.message)
		})
}

run().catch(console.error)
