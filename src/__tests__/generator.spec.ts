import { default as redio, Liquid, end, Funnel, Generator, RedioEnd, nil } from '../redio'
import fs from 'fs'
import { EventEmitter } from 'events'

describe('Generate a stream by sync thunk', () => {
	const gen = (x: number) => {
		let count = 0
		return () => (count < x ? count++ : end)
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
})

describe('Generate a stream by async thunk', () => {
	const gen = (x: number): Funnel<number> => {
		let count = 0
		return () =>
			new Promise<Liquid<number>>((resolve) => {
				setTimeout(() => {
					resolve(count < x ? count++ : end)
				}, 5)
			})
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
	test('Value generate more than buffer size', async () => {
		await expect(redio(gen(20)).toArray()).resolves.toHaveLength(20)
	})
})

describe('Generate a stream by sync callback generator', () => {
	const gen = (x: number): Generator<number> => {
		let count = 0
		return (push: (t: number | RedioEnd) => void, next: () => void) => {
			push(count < x ? count++ : end)
			next()
		}
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
})

describe('Generate a stream by async callback generator', () => {
	const gen = (x: number): Generator<number> => {
		let count = 0
		return (push: (t: number | RedioEnd) => void, next: () => void) => {
			push(count < x ? count++ : end)
			setTimeout(next, 5)
		}
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([0])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([0, 1, 2, 3])
	})
})

describe('Generate a stream of arrays by sync thunk', () => {
	const gen = (x: number): Generator<number[]> => {
		let count = 0
		return () => (count < x ? [0, count++] : end)
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([[0, 0]])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([
			[0, 0],
			[0, 1],
			[0, 2],
			[0, 3]
		])
	})
})

describe.skip('Generate a stream of arrays by sync callback generator', () => {
	const gen = (x: number): Generator<number[]> => {
		let count = 0
		return (push: (t: number[] | RedioEnd) => void, next: () => void) => {
			push(count < x ? [0, count++] : end)
			next()
		}
	}
	test('Value generate zero values', async () => {
		await expect(redio(gen(0)).toArray()).resolves.toEqual([])
	})
	test('Value generate one value', async () => {
		await expect(redio(gen(1)).toArray()).resolves.toEqual([[0, 0]])
	})
	test('Value generate four values', async () => {
		await expect(redio(gen(4)).toArray()).resolves.toEqual([
			[0, 0],
			[0, 1],
			[0, 2],
			[0, 3]
		])
	})
})

describe('Generate a stream from an array', () => {
	test('Array with no values', async () => {
		await expect(redio([]).toArray()).resolves.toHaveLength(0)
	})
	test('Array with one value', async () => {
		await expect(redio([42]).toArray()).resolves.toHaveLength(1)
	})
	test('Array with 5 values', async () => {
		await expect(redio([10, 20, 30, 40, 50]).toArray()).resolves.toHaveLength(5)
	})
	test('Array with 20 values - greater than buffer', async () => {
		await expect(
			redio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]).toArray()
		).resolves.toHaveLength(20)
	})
	test('Generate with sparse array', async () => {
		const a = new Array(5)
		a[0] = 0
		a[2] = 2
		a[4] = 4
		await expect(redio(a).toArray()).resolves.toEqual([0, 2, 4])
	})
	test('Generate with nil values', async () => {
		const a = [0, nil, 2, nil, 4]
		await expect(redio(a).toArray()).resolves.toEqual([0, 2, 4])
	})
})

describe('Generator a stream from an iterable', () => {
	test('Set with no values', async () => {
		await expect(redio(new Set()).toArray()).resolves.toHaveLength(0)
	})
	test('Set with one value', async () => {
		await expect(redio(new Set([1])).toArray()).resolves.toEqual([1])
	})
	test('Set with 4 values', async () => {
		await expect(redio(new Set([1, 2, 3, 4])).toArray()).resolves.toHaveLength(4)
	})
	test('Map with 4 values', async () => {
		await expect(
			redio(
				new Map([
					[1, 'one'],
					[2, 'two']
				])
			).toArray()
		).resolves.toHaveLength(2)
	})
})

describe('Generator from readable', () => {
	test('Read this file', async () => {
		await expect(
			redio(fs.createReadStream('src/__tests__/generator.spec.ts')).toArray()
		).resolves.toHaveLength(1)
	})
	test('Read this file in smaller chunks', async () => {
		const stats = fs.statSync('src/__tests__/generator.spec.ts')
		const expectedChunks = (stats.size / 256) | 0
		await expect(
			redio(fs.createReadStream('src/__tests__/generator.spec.ts'), { chunkSize: 256 }).toArray()
		).resolves.toHaveLength(expectedChunks)
	})
	test('Read this file as a string', async () => {
		await expect(
			redio(fs.createReadStream('src/__tests__/generator.spec.ts'), { encoding: 'utf8' }).toArray()
		).resolves.toEqual(expect.arrayContaining([expect.stringMatching('imp(o)rt')]))
	})
})

class EventMaker extends EventEmitter {
	constructor() {
		super()
	}
	makeOne(name: string, value: string) {
		this.emit(name, value)
	}
	makeOneIn(name: string, value: string, wait: number) {
		setTimeout(() => {
			this.emit(name, value)
		}, wait)
	}
}

describe('Generator from events', () => {
	const emitter = new EventMaker()
	emitter.on('change', (x) => console.log('debuggy', x))
	test('Catch an event', async () => {
		const stream = redio<string>(emitter, 'change').toArray()
		emitter.makeOneIn('change', 'fred', 1)
		emitter.makeOneIn('change', 'ginger', 2)
		emitter.makeOneIn('end', '', 3)
		await expect(stream).resolves.toEqual(['fred', 'ginger'])
	})
})

describe('Generate, then consume later', () => {
	test('Make more than we can eat', async () => {
		const str = redio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const endStr = str.each((_x) => {
			return new Promise<void>((resolve) => {
				setTimeout(() => {
					// console.log(x)
					resolve()
				}, 100)
			})
		})
		await expect(endStr.toPromise()).resolves.toBeTruthy()
	})
})

describe('Delayed generator start test', () => {
	const wait = async (t: number): Promise<void> =>
		new Promise((resolve) => {
			setTimeout(resolve, t)
		})
	const makeGen = () => {
		let counter = 0
		return redio<number>(
			async () => {
				return counter < 6 ? counter++ : end
			},
			{ bufferSizeMax: 3, debug: false }
		)
	}
	test('Start now', async () => {
		const gen = makeGen()
		await expect(gen.toArray()).resolves.toEqual([0, 1, 2, 3, 4, 5])
	})
	test('Start then - direct spout', async () => {
		const gen = makeGen()
		await wait(20)
		await expect(gen.toArray()).resolves.toEqual([0, 1, 2, 3, 4, 5])
	})
	test('Start then - via valc', async () => {
		const gen = makeGen()
		await wait(20)
		await expect(gen.map((x) => x).toArray()).resolves.toEqual([0, 1, 2, 3, 4, 5])
	})
})
