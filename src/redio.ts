/**
 *  Redioactive is a reactive streams library for Node.js, designed to work
 *  with native promises and typescript types. The motivation for its development is for the processing
 *  of media streams at or faster than real time on non-real time computer systems.
 *  Designed for the _async/await with typescript generation_, this library is
 *  inspired by Highland.js and adds support for configurable buffers at each stage.
 */

import { types } from 'util'
import { EventEmitter } from 'events'
const { isPromise } = types

/** Type of a value sent down a stream to indicate that it has ended. No values
 *  should follow.
 */
export type RedioEnd = {}
/** Constant value indicating the [[RedioEnd|end]] of a stream. */
export const end: RedioEnd = {}
/**
 *  Test that a value is the end of a stream.
 *  @param t Value to test.
 *  @return True is the value is the end of a stream.
 */
export function isEnd (t: any): t is RedioEnd {
	return t === end
}

/** Empty value. Nil values are sent down streams to indicate no value in the
 *  stream at this time. Nil values will be dropped at the earliest opportunity
 *  and should never be received at the end of a stream.
 *
 *  Nil values can be used in processing stages that consume more values than they
 *  produce.
 */
export type RedioNil = {}
/** Constant representing a [[RedioNil|nil]] value. */
export const nil: RedioNil = {}
/**
 *  Test a value to see if it is an [[RedioNil|empty value]].
 *  @param t Value to test.
 *  @return True if the value is the _nil_ empty value.
 */
export function isNil (t: any): t is RedioNil {
	return t === nil
}

/** Types of values that can flow down a stream. Values are either of the given
 *  type, the [[end]] or [[nil]].
 */
export type Liquid<T> = T | RedioEnd | RedioNil | Error
/** A collection of values that can flow down a stream. This type is used
 *  when a processing stage produces more than it consumes, a _one-to-many_
 *  function, to represent a sequence of values to be flattenned into the stream.
 */
export type LotsOfLiquid<T> = Liquid<T> | Array<Liquid<T>>

/**
 *  A function that can be used to produce a stream of items that is
 *  poured into a stream via a funnel.
 *  @typeparam T Type of the items produced.
 */
export interface Funnel<T> {
	/**
	 *  Thunk that generates values for a stream. Each call to the function
	 *  should create one or more values that are sent on down the stream. THE
	 *  function should generate an [[end]] value once completed.
	 *  @return Promise to produce item(s) or the direct production of item(s).
	 */
	(): Promise<LotsOfLiquid<T>> | LotsOfLiquid<T>
}

/**
 *  A funciton that can be used to process an incoming stream of liquid and
 *  create a possibly different kind of stream of liquid.
 *  @typeparam S Source type for the itemsconsumed.
 *  @typeparam T Target type for items produced.
 */
export interface Valve<S, T> {
	/**
	 *  A function that consumes a single item from an incoming stream and produces
	 *  values for an outgoing stream. The function an return [[nil]] if the
	 *  input produces no output. Set the [[RedioOptions.oneToMany]] flag if the
	 *  funciton can produce more than one value per input and the output Will
	 *  be flattenned.
	 *  @param s Single item to consume.
	 *  @return Promise to produce item(s) or the direct production of item(s).
	 */
	(s: S | RedioEnd): Promise<LotsOfLiquid<T>> | LotsOfLiquid<T>
}

/**
 *  Function at the end of a pipe for handling the output of a stream.
 *  @typeparam T Type of items at the end of the stream.
 */
export interface Spout<T> {
	/**
	 *  A function that consumes a single item at the end of a stream, executing
	 *  a side effect or operation that acts on the value.
	 *  @param t Item to consume.
	 */
	(t: T | RedioEnd): Promise<void> | void
}

export interface Generator<T> {
	(push: (t: T | RedioEnd | Error) => void, next: () => void): void
}

/**
 *  Utility function to create literal values of stream items.
 *  @typeparam T Type of value to create.
 *  @param t Value describing the literal to create.
 *  @return Literal value.
 */
export function literal<T> (o: T) {
	return o
}

/**
 *  Options that can be used to configure each stage of processing. The options
 *  implicitly pass onto the next processing stage unless explicitly overidden.
 *  For example, setting the `debug` flag to true on the first element will cause
 *  all subsequent stages of processing to generate debug unless subsequently
 *  set to false.
 */
export interface RedioOptions {
	/** Maximum number of stream items to buffer before pausing the producer. */
	bufferSizeMax?: number
	/** Factor applied to `maxBufferSize` to apply to determine
	 *  how many elements have to drain before the stream is
	 *  restarted after pausing. For example, `drainFactor` is `0.7`, `bufferSizeMax`
	 *  is `10`, processing is restarted when the buffer size has drained to a
	 *  size of `7`.
	 */
	drainFactor?: number
	/** Set this flag to enerate debugging information for this. */
	debug?: boolean
	/** Set this flag if the stage can produce arrays of output values
	 *  ([[LotsOfLiquid]]) that should be flattenned.
	 */
	oneToMany?: boolean
}

export interface RedioPipe<T> {
	append (v: Promise<T> | T, options?: RedioOptions): RedioPipe<T>
	map<M> (mapper: (t: T) => Promise<M> | M, options?: RedioOptions): RedioPipe<M>
	filter (filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>
	drop (num: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
	take (num: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
	each (dotoall: (t: T) => void, options?: RedioOptions): RedioStream<T>
	toArray (options?: RedioOptions): Promise<Array<T>>
}

abstract class RedioProducer<T> implements RedioPipe<T> {
	protected _follow: RedioProducer<any> | RedioSink<T> | null = null
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

	append (v: Promise<T> | T, options?: RedioOptions): RedioPipe<T> {
		return this.valve((t: Promise<T> | T | RedioEnd) => {
			if (this._debug) { console.log(`Append at end ${isEnd(t)} value ${t}`) }
			if (isEnd(t)) { return v }
			return t
		}, options)
	}

	map<M> (mapper: (t: T) => M | Promise<M>, options?: RedioOptions): RedioPipe<M> {
		return this.valve((t: T | RedioEnd): M | RedioEnd => {
			if (!isEnd(t)) return mapper(t)
			return end
		}, options)
	}

	filter (filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T> {
		return this.valve((t: T | RedioEnd): T | RedioEnd => {
			if (!isEnd(t)) {
				return filter(t) ? t : nil
			}
			return end
		}, options)
	}

	flatMap<M> (_mapper: (t: T | RedioEnd) => RedioPipe<M>, _options?: RedioOptions): RedioPipe<M> {
		throw new Error('Not implemented')
	}

	drop (num: number | Promise<number>, options?: RedioOptions): RedioPipe<T> {
		let count = 0
		return this.valve(async (t: T | RedioEnd): Promise<T | RedioEnd> => {
			if (!isEnd(t)) {
				return count++ >= await num ? t : nil
			}
			return end
		}, options)
	}

	take (num: number | Promise<number>, options?: RedioOptions): RedioPipe<T> {
		let count = 0
		return this.valve(async (t: T | RedioEnd): Promise<T | RedioEnd> => {
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

	spout (spout: Spout<T>, options?: RedioOptions): RedioStream<T> {
		this._follow = new RedioSink<T>(this, spout, options)
		return this._follow
	}

	each (dotoall: (t: T) => void, options?: RedioOptions): RedioStream<T> {
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

class RedioStart<T> extends RedioProducer<T> {
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

class RedioMiddle<S, T> extends RedioProducer<T> {
	private _middler: Valve<S, T>
	private _ready: boolean = true
	private _prev: RedioProducer<S>

	constructor (prev: RedioProducer<S>, middler: Valve<S, T>, options?: RedioOptions) {
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

export interface RedioStream<T> {
	done (thatsAllFolks: () => void): RedioStream<T>
}

class RedioSink<T> implements RedioStream<T> {
	private _sinker: Spout<T>
	private _prev: RedioProducer<T>
	private _ready: boolean = true
	private _debug: boolean
	private _thatsAllFolks: (() => void) | null = null

	constructor (prev: RedioProducer<T>, sinker: Spout<T>, options?: RedioOptions) {
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

	done (thatsAllFolks: () => void): RedioStream<T> {
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
