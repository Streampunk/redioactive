import { types } from 'util'
import { EventEmitter } from 'events'
const { isPromise } = types

export type RedioEnd = {}
export const end: RedioEnd = {}
export function isEnd (t: RedioEnd): t is RedioEnd {
	return t === end
}

export interface Funnel<T> {
	(): Promise<T | RedioEnd> | T | RedioEnd
}

export interface Valve<S, T> {
	(s: S | RedioEnd): Promise<T | RedioEnd> | T | RedioEnd
}

export interface Spout<T> {
	(t: T | RedioEnd): Promise<void> | void
}

export interface Generator<T> {
	(push: (t: T | RedioEnd | Error) => void, next: () => void): void
}

export interface RedioOptions {
	bufferSizeMax?: number
	drainFactor?: number
}

class RedioPipe<T> {
	protected _follow: RedioPipe<any> | RedioSink<T> | null = null
	protected _buffer: (T | RedioEnd)[] = []
	protected _running: boolean = true
	protected _bufferSizeMax: number = 10
	protected _drainFactor: number = 0.7

	constructor (options?: RedioOptions) {
		if (options) {
			if (typeof options.bufferSizeMax === 'number' && options.bufferSizeMax > 0) {
				this._bufferSizeMax = options.bufferSizeMax
			}
			if (typeof options.drainFactor === 'number' && options.drainFactor >= 0.0 && options.drainFactor <= 1.0) {
				this._drainFactor = options.drainFactor
			}
		}
	}

	protected push (x: T | RedioEnd): void {
		this._buffer.push(x)
		console.log('Push', x, this._buffer.length)
		if (this._buffer.length >= this._bufferSizeMax) this._running = false
		if (this._follow) this._follow.next()
	}

	pull (): T | RedioEnd | null {
		let val = this._buffer.shift()
		if (!this._running && this._buffer.length < this._drainFactor * this._bufferSizeMax) {
			this._running = true
			this.next()
		}
		return val ? val : null
	}

	next (): Promise<void> { return Promise.resolve() }

	append (v: Promise<T> | T | RedioEnd, _options?: RedioOptions): RedioPipe<T> {
		return new RedioMiddle<T, T>(this, (t: T | RedioEnd) => {
			console.log('>>>', t, isEnd(t))
			if (isEnd(t)) { return v }
			return t
		})
	}

	map<M> (mapper: Valve<T, M>, _options?: RedioOptions): RedioMiddle<T, M> {
		let redm = new RedioMiddle(this, mapper)
		return redm
	}

	filter (_filter: (t: T | RedioEnd) => Promise<boolean> | boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	flatMap<M> (_mapper: (t: T | RedioEnd) => RedioPipe<M>, _options?: RedioOptions): RedioPipe<M> {
		throw new Error('Not implemented')
	}

	drop (_count: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	take (_count: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	observe (_options?: RedioOptions): { observer: RedioPipe<T>, source: RedioPipe<T> } {
		throw new Error('Not implemented')
	}

	split (_options?: RedioOptions): { first: RedioPipe<T>, second: RedioPipe<T> } {
		throw new Error('Not implemented')
	}

	valve <S> (valve: Valve<T, S>): RedioPipe<S> {
		this._follow = new RedioMiddle<T, S>(this, valve)
		return this._follow
	}

	spout (spout: Spout<T>): RedioSink<T> {
		this._follow = new RedioSink<T>(this, spout)
		return this._follow
	}

	each (dotoall: (t: T) => void): RedioSink<T> {
		return this.spout((tt: T | RedioEnd) => {
			if (isEnd(tt)) { console.log(tt); return }
			dotoall(tt)
		})
	}

	async toArray (): Promise<Array<T>> {
		let result: Array<T> = []
		let promisedArray: Promise<Array<T>> = new Promise((resolve, _reject) => {
			this.spout((tt: T | RedioEnd) => {
				if (isEnd(tt)) {
					resolve(result)
				} else {
					result.push(tt)
				}
			})
		})
		return promisedArray
	}

	toPromise (): Promise<T> { throw new Error('Not implemented') }

	pipe (_stream: WritableStream<T>) {
		throw new Error('Not implemented')
	}
}

class RedioStart<T> extends RedioPipe<T> {
	private _maker: Funnel<T>

	constructor (maker: Funnel<T>, options?: RedioOptions) {
		super(options)
		this._maker = maker
		this.next()
	}

	async next () {
		if (this._running) {
			let result = await this._maker()
			this.push(result)
			if (result !== end) this.next()
		}
	}

}

function isAPromise<T> (o: any): o is Promise<T> {
	return isPromise(o)
}

class RedioMiddle<S, T> extends RedioPipe<T> {
	private _middler: Valve<S, T>
	private _ready: boolean = true
	private _prev: RedioPipe<S>

	constructor (prev: RedioPipe<S>, middler: Valve<S, T>) {
		super()
		this._middler = (s: S | RedioEnd) => new Promise<T | RedioEnd>((resolve, reject) => {
			this._ready = false
			let callIt = middler(s)
			let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
			promisy.then((t: T | RedioEnd) => {
				this._ready = true
				resolve(t)
				this.next()
			}, err => {
				this._ready = true
				reject(err)
				this.next()
			})
		})
		this._prev = prev
	}

	async next () {
		if (this._running && this._ready) {
			let v: S | RedioEnd | null = this._prev.pull()
			if (v !== null) {
				let result = await this._middler(v)
				this.push(result)
				this.next()
			}
		}
	}
}

class RedioSink<T> {
	private _sinker: Spout<T>
	private _prev: RedioPipe<T>
	private _ready: boolean = true

	constructor (prev: RedioPipe<T>, sinker: Spout<T>) {
		this._sinker = (t: T | RedioEnd) => new Promise<void>((resolve, reject) => {
			this._ready = false
			let callIt = sinker(t)
			let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
			promisy.then(() => {
				this._ready = true
				resolve()
				console.log('Time for tea?', t !== end)
				if (t !== end) this.next()
				// else process.exit(1)
			}, (err?: any) => {
				this._ready = true
				reject(err)
				if (t !== end) this.next()
			})
		})
		this._prev = prev
	}

	next () {
		if (this._ready) {
			let v: T | RedioEnd | null = this._prev.pull()
			if (v !== null) {
				this._sinker(v)
			}
		}
	}
}

// let counter = 0
// let test = new RedioStart<number>(() => new Promise((resolve) => setTimeout(() => resolve(counter++), Math.random() * 1000)))
//
// test.sink((t: number | RedioEnd) => new Promise((resolve) => {
// 	console.log('Starting to process slow coach', t)
// 	setTimeout(() => {
// 		console.log('Ending the slow coach', t)
// 		resolve()
// 	}, 750)
// }))

// export default function<T> (iterable: Iterable<T>, options?: RedioOptions): RedioPipe<T>
// export default function<T> (iterator: Iterator<T>, options?: RedioOptions): RedioPipe<T>
// export default function<T> (generator: Generator<T>, options?: RedioOptions): RedioPipe<T>
// export default function<T> (stream: ReadableStream<T>): RedioPipe<T>
// export default function<T> (e: EventEmitter, eventName: string, options?: RedioOptions): RedioPipe<T>
export default function<T> (data: Array<T>, options?: RedioOptions): RedioPipe<T>
// export default function<T> (url: string, options?: RedioOptions): RedioPipe<T>
// export default function<T> (funnel: Funnel<T>, options?: RedioOptions): RedioPipe<T>
export default function<T> (
	args1: Funnel<T> | string | Array<T> | EventEmitter | ReadableStream<T> | Generator<T> | Iterable<T> | Iterator<T>,
	_args2?: RedioOptions | string,
	_args3?: RedioOptions): RedioPipe<T> | null {

	// if (typeof args1 === 'function') {
	// 	return new RedioStart(args1 as Funnel<T>, args2 as RedioOptions | undefined)
	// }
	if (Array.isArray(args1)) {
		let index = 0
		return new RedioStart<T>(() => {
			console.log('Hello from here!', index, args1[index])
			if (index >= args1.length) { console.log('THE END'); return end }
			return args1[index++]
		})
	}
	return null
}
