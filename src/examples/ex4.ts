import redio, { Spout, Liquid } from '../index'

const wait = (t: number) => new Promise((r) => setTimeout(() => r(t), t * 500))
const addWait: Spout<number> = async (n: Liquid<number>) => {
	if (typeof n === 'number') console.log(await wait(n))
}

redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 })
	.doto((x) => console.log('doto', x))
	.spout(addWait)
