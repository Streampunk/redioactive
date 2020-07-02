import redio, { Funnel, end } from '../index'

const wait = (t: number) => new Promise<number>((r) => setTimeout(() => r(t), t * 500))
function addWait(n: number): Funnel<number> {
	let count = 0
	return async () => (count < n ? await wait(++count) : end)
}
redio<number>(addWait(4))
	.doto((x) => console.log('doto', x))
	.toArray()
	.then(console.log)
// output: doto 1  (after 0.5 s, then wait 1.0s)
//         doto 2  (then wait 1.0s)
//         doto 3  (then wait 1.5s)
//         doto 4
//         [ 1, 2, 3, 4 ]
