import { default as redio, end } from '../redio'

async function run(): Promise<void> {
	await redio([1, 2, 3, 4, 5, 6], { debug: false })
		.flatMap((x) => redio([x]), { debug: false })
		.each(console.log, { debug: false })
		.done(() => {
			console.log('There we go!')
		})
		.toPromise()

	await redio([1, 2, 3, 4, 5, 6], { debug: false })
		.flatMap(
			(x) => {
				// let sent = false
				return redio(
					() => {
						return [x, end]
					},
					{ oneToMany: true }
				)
			},
			{ debug: false }
		)
		.each(console.log, { debug: false })
		.done(() => {
			console.log('There we go!')
		})
		.toPromise()
		.then(console.log)

	await redio([1, 2, 3, 4, 5, 6], { debug: false })
		.flatMap(
			(x) => {
				let sent = false
				return redio(
					() => {
						const y = sent ? end : x
						sent = true
						return y
					},
					{ oneToMany: false }
				)
			},
			{ debug: false }
		)
		.each(console.log, { debug: false })
		.done(() => {
			console.log('There we go!')
		})
		.toPromise()

	await redio([1, 2, 3, 4, 5, 6], { debug: false })
		.flatMap(
			(x) => {
				return redio(
					() => {
						return [x, end]
					},
					{ oneToMany: true }
				)
			},
			{ debug: false }
		)
		.each(console.log, { debug: false })
		.done(() => {
			console.log('There we go!')
		})
		.toPromise()

	await redio([1, 2, 3, 4, 5, 6], { debug: false })
		.flatMap(
			(x) =>
				redio(
					(push, next) => {
						push(x)
						push(end)
						next()
					},
					{ oneToMany: false }
				),
			{ debug: false }
		)
		.each(console.log, { debug: false })
		.done(() => {
			console.log('There we go!')
		})
		.toPromise()
}

run().catch(console.error)
