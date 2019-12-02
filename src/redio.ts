import { types } from 'util'
import { EventEmitter } from 'events'
const { isPromise } = types

export type RedioEnd = {}
export const end: RedioEnd = {}
export function isEnd (t: RedioEnd): t is RedioEnd {
	return t === end
}

export type RedioNil = {}
export const nil: RedioNil = {}
export function isNil (t: RedioNil): t is RedioNil {
	return t === nil
}

export interface Funnel<T> {
	(): Promise<T | Array<T> | RedioEnd> | T | Array<T> | RedioEnd
}

export interface Valve<S, T> {
	(s: S | RedioEnd): Promise<T | Array<T> | RedioEnd> | T | Array<T> | RedioEnd | RedioNil
}

export interface Spout<T> {
	(t: T | RedioEnd): Promise<void> | void
}

export interface Generator<T> {
	(push: (t: T | RedioEnd | Error) => void, next: () => void): void
}

export function literal<T> (o: T) {
	return o
}

export interface RedioOptions {
	bufferSizeMax?: number
	drainFactor?: number
	debug?: boolean
	oneToMany?: boolean
}

abstract class RedioPipe<T> {
	protected _follow: RedioPipe<any> | RedioSink<T> | null = null
	protected _buffer: (T | RedioEnd)[] = []
	protected _running: boolean = true
	protected _bufferSizeMax: number = 10
	protected _drainFactor: number = 0.7
	protected _debug: boolean = false
	protected _oneToMany: boolean = false

	constructor (options?: RedioOptions) {
		if (options) {
			if (typeof options.bufferSizeMax === 'number' && options.bufferSizeMax > 0) {
				this._bufferSizeMax = options.bufferSizeMax
			}
			if (typeof options.drainFactor === 'number' && options.drainFactor >= 0.0 && options.drainFactor <= 1.0) {
				this._drainFactor = options.drainFactor
			}
			if (typeof options.debug === 'boolean') {
				this._debug = options.debug
			}
			if (options && options.hasOwnProperty('oneToMany')) {
				this._oneToMany = options.oneToMany as boolean
			}
		}
	}

	protected push (x: T | RedioEnd): void {
		this._buffer.push(x)
		if (this._debug) { console.log(`Push: buffer now length=${this._buffer.length} value=${x}`) }
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

	append (v: Promise<T> | T | RedioEnd, options?: RedioOptions): RedioPipe<T | RedioEnd> {
		return this.valve((t: Promise<T> | T | RedioEnd) => {
			if (this._debug) { console.log(`Append at end ${isEnd(t)} value ${t}`) }
			if (isEnd(t)) { return v }
			return t
		}, options)
	}

	map<M> (mapper: (t: T) => M | Promise<M>, options?: RedioOptions): RedioPipe<M | RedioEnd> {
		return this.valve((t: T | RedioEnd) => {
			if (!isEnd(t)) return mapper(t)
			return end
		}, options)
	}

	filter (filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T | RedioEnd> {
		return this.valve((t: T | RedioEnd) => {
			if (!isEnd(t)) {
				return filter(t) ? t : nil
			}
			return end
		}, options)
	}

	flatMap<M> (_mapper: (t: T | RedioEnd) => RedioPipe<M>, _options?: RedioOptions): RedioPipe<M> {
		throw new Error('Not implemented')
	}

	drop (num: number | Promise<number>, options?: RedioOptions): RedioPipe<T | RedioEnd> {
		let count = 0
		return this.valve(async (t: T | RedioEnd) => {
			if (!isEnd(t)) {
				return count++ >= await num ? t : nil
			}
			return end
		}, options)
	}

	take (num: number | Promise<number>, options?: RedioOptions): RedioPipe<T | RedioEnd> {
		let count = 0
		return this.valve(async (t: T | RedioEnd) => {
			if (!isEnd(t)) {
				return count++ < await num ? t : nil
			}
			return end
		}, options)
	}

	observe (_options?: RedioOptions): { observer: RedioPipe<T>, source: RedioPipe<T> } {
		throw new Error('Not implemented')
	}

	split (_options?: RedioOptions): { first: RedioPipe<T>, second: RedioPipe<T> } {
		throw new Error('Not implemented')
	}

	valve <S> (valve: Valve<T, S>, options?: RedioOptions): RedioPipe<S> {
		this._follow = new RedioMiddle<T, S>(this, valve, options)
		return this._follow as RedioPipe<S>
	}

	spout (spout: Spout<T>, options?: RedioOptions): RedioSink<T> {
		this._follow = new RedioSink<T>(this, spout, options)
		return this._follow
	}

	each (dotoall: (t: T) => void, options?: RedioOptions): RedioSink<T> {
		return this.spout((tt: T | RedioEnd) => {
			if (isEnd(tt)) {
				if (options && options.debug) {
					console.log('Each: THE END')
				}
				return
			}
			dotoall(tt)
		}, options)
	}

	async toArray (options?: RedioOptions): Promise<Array<T>> {
		let result: Array<T> = []
		let promisedArray: Promise<Array<T>> = new Promise((resolve, _reject) => {
			this.spout((tt: T | RedioEnd) => {
				if (isEnd(tt)) {
					resolve(result)
				} else {
					result.push(tt)
				}
			}, options)
		})
		return promisedArray
	}

	toPromise (): Promise<T> { throw new Error('Not implemented') }

	pipe (_stream: WritableStream<T>) {
		throw new Error('Not implemented')
	}

	get options (): RedioOptions {
		return literal<RedioOptions>({
			bufferSizeMax: this._bufferSizeMax,
			drainFactor: this._drainFactor,
			debug: this._debug
		})
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
			if (this._oneToMany && Array.isArray(result)) {
				result.forEach(x => this.push(x))
			} else if (isNil(result)) {
				// Don't push
			} else {
				this.push(result)
			}
			if (result !== end) {
				this.next()
			}
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

	constructor (prev: RedioPipe<S>, middler: Valve<S, T>, options?: RedioOptions) {
		super(Object.assign(prev.options, options))
		this._middler = (s: S | RedioEnd) => new Promise<T | RedioEnd>((resolve, reject) => {
			this._ready = false
			let callIt = middler(s)
			let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
			promisy.then((t: T | RedioEnd) => {
				this._ready = true
				resolve(t)
				if (this._debug) {
					console.log(`middler(${isEnd(s) ? 'THE END' : s}) = ${t}`)
				}
				// if (!isEnd(t)) {
				// 	this.next()
				// }
			}, err => {
				this._ready = true
				reject(err)
				// this.next()
			})
		})
		this._prev = prev
	}

	async next () {
		if (this._running && this._ready) {
			let v: S | RedioEnd | null = this._prev.pull()
			if (v !== null) {
				let result = await this._middler(v)
				if (this._oneToMany && Array.isArray(result)) {
					result.forEach(x => this.push(x))
					if (isEnd(v) && result.length > 0 && !isEnd(result[result.length - 1])) {
						this.push(end)
					}
				} else if (isNil(result)) {
					// Don't push
					if (isEnd(v)) {
						 this.push(end)
					}
				} else {
					this.push(result)
					if (isEnd(v) && !isEnd(result)) {
						this.push(end)
					}
				}
				this.next()
			}
		}
	}
}

class RedioSink<T> {
	private _sinker: Spout<T>
	private _prev: RedioPipe<T>
	private _ready: boolean = true
	private _debug: boolean
	private _thatsAllFolks: (() => void) | null = null

	constructor (prev: RedioPipe<T>, sinker: Spout<T>, options?: RedioOptions) {
		this._debug = options && options.hasOwnProperty('debug') ? options.debug as boolean : prev.options.debug as boolean
		this._sinker = (t: T | RedioEnd) => new Promise<void>((resolve, reject) => {
			this._ready = false
			let callIt = sinker(t)
			let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
			promisy.then((): void => {
				this._ready = true
				resolve()
				if (!isEnd(t)) {
					this.next()
				} else if (this._thatsAllFolks) {
					this._thatsAllFolks()
				}
			}, (err?: any): void => {
				this._ready = true
				reject(err)
				if (!isEnd(t)) this.next()
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

	done (thatsAllFolks: () => void): RedioSink<T> {
		this._thatsAllFolks = thatsAllFolks
		return this
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
	args2?: RedioOptions | string,
	_args3?: RedioOptions): RedioPipe<T> | null {

	// if (typeof args1 === 'function') {
	// 	return new RedioStart(args1 as Funnel<T>, args2 as RedioOptions | undefined)
	// }
	if (Array.isArray(args1)) {
		let index = 0
		let options: RedioOptions | undefined = args2 as RedioOptions | undefined
		return new RedioStart<T>(() => {
			if (options && options.debug) {
				console.log(`Generating index=${index} value=${index < args1.length ? args1[index] : 'THE END'}`)
			}
			if (index >= args1.length) {
				return end
			}
			return args1[index++]
		}, options)
	}
	return null
}
