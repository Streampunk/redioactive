/**
 *  Redioactive is a reactive streams library for Node.js, designed to work
 *  with native promises and typescript types. The motivation for its development
 *  is for the processing of media streams at or faster than real time on non-real
 *  time computer systems.
 *  Designed for the _async/await with typescript generation_, this library is
 *  inspired by Highland.js and adds support for configurable buffers at each stage.
 */

import { types } from 'util'
import { EventEmitter } from 'events'
import { URL } from 'url'
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

/**
 *  Test a value to see if it is an [[Error]].
 *  @param t Value to test.
 *  @return True if the value is an error.
 */
export function isAnError (t: any): t is Error {
	return types.isNativeError(t)
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
	 *  should create one or more values that are sent on down the stream. This
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
	(s: Liquid<S>): Promise<LotsOfLiquid<T>> | LotsOfLiquid<T>
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
	(t: Liquid<T>): Promise<void> | void
}

/**
 *  A function that generates an item or items to push onto a stream. The
 *  `push` function is like a standard callback function that can be called
 *  asynchronously to push values into the stream. The generator function will
 *  not be called again until `next` has been called. Remeber to push [[end]]
 *  to complete the stream, otherwise it is infinite.
 *  Note: Set `oneToMany` to true for arrays to be flattenned to a stream of
 *  separate values.
 *  @typeparam T Type of values to be pushed onto the stream.
 */
export interface Generator<T> {
	/**
	 *  Implemented to provided the lazy generation of a stream of values.
	 *  @param push Function called to push values onto the stream.
	 *  @param next Call when the generator function can be called again.
	 */
	(push: (t: LotsOfLiquid<T>) => void, next: () => void): void
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
	/** Set this flag to cause an [unhandled rejection](https://nodejs.org/api/process.html#process_event_unhandledrejection)
	 *  at the end of the pipe. The default value is `true`. May cause the process
	 *  to crash.
	 */
	rejectUnhandled?: boolean
	/** Set this flag to allow a valve to process an error. Defaults to `false` and
	 *  must be set for each stage that it applies to.
	 */
	 processError?: boolean
}

/** Generic properties of any stage in a pipeline. */
interface PipeFitting {
	/** Unique identifier within this Node instance for a stage in the pipeline. */
	readonly fittingId: number
}

/**
 *  Configuration options for an endpoint that transports a stream over the
 *  the HTTP protocol.
 */
export interface HTTPOptions extends RedioOptions {
}

/**
 *  Reactive streams pipeline carrying liquid of a particular type.
 *  @typeparam T Type of liquid travelling down the pipe.
 */
export interface RedioPipe<T> extends PipeFitting {
	/**
	 *  Apply a [[Valve|valve]] function to every element of the stream,
	 *  transforming the stream from type `T` to type `S`.
	 *  @typeparam S Type of elements on the output stream.
	 *  @param valve   Valve function that transforms an element of an input stream
	 *                 into zero or more elements of the output stream.
	 *  @param options Optional options to apply at this stage.
	 *  @returns Pipe containing the stream of transformed elements.
	 */
	valve <S> (valve: Valve<T, S>, options?: RedioOptions): RedioPipe<S>
	/**
	 *  Apply a [[Spout|spout]] function at the end of pipe.
	 *  @param spout  Spout function to apply to each element.
	 *  @returns A completed stream.
	 */
	spout (spout: Spout<T>, options?: RedioOptions): RedioStream<T>

	// Transforms
	/**
	 *  Append a value to the end of a stream.
	 *      redio([1, 2, 3]).append(4) // => 1, 2, 3, 4
	 *  @param v       Value to append to end of stream.
	 *  @param options Optional configuration.
	 *  @returns Pipe containing stream with the additional element.
	 */
	append (v: Liquid<T>, options?: RedioOptions): RedioPipe<T>
	batch (n: Promise<number> | number, options?: RedioOptions): RedioPipe<Array<T>>
	collect (options?: RedioOptions): RedioPipe<Array<T>>
	compact (options?: RedioOptions): RedioPipe<T>
	consume <M> (
		f: (err: Error, x: T, push: (m: Liquid<M>) => void, next: () => void) => Promise<void> | void,
		options?: RedioOptions): RedioPipe<M>
	debounce (ms: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
	doto (f: (t: T) => Promise<void> | void, options?: RedioOptions): RedioPipe<T>
	/**
	 *  Ignores the first `num` values of the stream and emits the rest.
	 *  @param num     Number of values to drop from the source.
	 *  @param options Optional configuration.
	 *  @returns Pipe containing a stream of values with the first `num` values missing.
	 */
	drop (num: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
	/**
	 *  Apply the given function to every error in the stream. All other values
	 *  are passed on. The error can be transformed into a value of the stream
	 *  type, passed on or dropped by returning / resolving to `void`/`null`/`undefined`.
	 *  @param f       Function to transform an error into a value or take a side-effect
	 *                 action. Note that errors can be passed on (return type `Error`)
	 *                 or dropped (return type `RedioNil` or equivalent falsy value).
	 *  @param options Optional configuration. Note the `processError` will always be set.
	 *  @returns Stream of values with errors handled.
	 */
	errors (
		f: (err: Error) => Promise<Liquid<T>> | Liquid<T>,
		options?: RedioOptions): RedioPipe<T>
	/**
	 *  Apply the given filter function to all the values in the stream, keeping
	 *  those that pass the test.
	 *  @param filter  Function returning true for values to keep.
	 *  @param options Optional configuration.
	 *  @returns Stream of values that pass the test.
	 */
	filter (filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>
	find (filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>
	findWhere (props: object, options?: RedioOptions): RedioPipe<T>
	group (f: string | ((t: T) => any), options?: RedioOptions): RedioPipe<T>
	head (options?: RedioOptions): RedioPipe<T>
	intersperse<I> (sep: Promise<I> | I, options?: RedioOptions): RedioPipe<T | I>
	invoke<R> (method: string, args: Array<any>, options?: RedioOptions): RedioPipe<R>
	last (options?: RedioOptions): RedioPipe<T>
	latest (options?: RedioOptions): RedioPipe<T>
	/**
	 *  Transform a stream by applying the given `mapper` function to each element.
	 *  @typeparam M Type of the values in the output stream.
	 *  @param mapper  Function to transform each value.
	 *  @param options Optional configuration.
	 *  @returns Stream of transformed values.
	 */
	map<M> (mapper: (t: T) => M | Promise<M>, options?: RedioOptions): RedioPipe<M>
	pick (properties: Array<string>, options?: RedioOptions): RedioPipe<T>
	pickBy (f: ((key: string, value: any) => boolean), options?: RedioOptions): RedioPipe<T>
	pluck (prop: string, options?: RedioOptions): RedioPipe<T>
	ratelimit (num: number, ms: number, options?: RedioOptions): RedioPipe<T>
	reduce<R> (iterator: ((a: R, b: T) => R), init: R, options?: RedioOptions): RedioPipe<T>
	reduce1<T> (iterator: ((a: T, b: T) => T), options?: RedioOptions): RedioPipe<T>
	reject (filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>
	scan<R> (iterator: ((a: R, b: T) => R), init: R, options?: RedioOptions): RedioPipe<T>
	scan1 (iterator: ((a: T, b: T) => T), options?: RedioOptions): RedioPipe<T>
	slice (start: number, end: number, options?: RedioOptions): RedioPipe<T>
	sort (options?: RedioOptions): RedioPipe<T>
	sortBy (f: (a: T, b: T) => number, options?: RedioOptions): RedioPipe<T>
	split (options?: RedioOptions): RedioPipe<T>
	splitBy (sep: string | RegExp, options?: RedioOptions): RedioPipe<T>
	stopOnError (f: (err: Error) => void, options?: RedioOptions): RedioPipe<T>
	/**
	 *  Take the first `num` elements from the stream, drop the rest.
	 *  @param num     Number of elements to include from the start of the stream.
	 *  @param options Optional configuration.
	 *  @returns Stream containing only the first `num` elements from the source.
	 */
	take (num: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
	tap (f: (t: T) => Promise<void> | void, options?: RedioOptions): RedioPipe<T>
	throttle (ms: number, options?: RedioOptions): RedioPipe<T>
	uniq (options?: RedioOptions): RedioPipe<T>
	uniqBy (f: (a: T, b: T) => boolean, options?: RedioOptions): RedioPipe<T>
	where (props: object, options?: RedioOptions): RedioPipe<T> // Filter on object properties

	// Higher order streams
	concat (ys: RedioPipe<T> | Array<T>, options?: RedioOptions): RedioPipe<T>
	flatFilter (f: (t: T) => RedioPipe<boolean>, options?: RedioOptions): RedioPipe<T>
	/**
	 *  Create a new stream of values by applying a function to each value, where
	 *  that function returns a (possibly empty) stream. Each of the result streams
	 *  are then emitted on a single output stream.
	 *  Functionally equivalent to `.map<RedioPipe<M>>(f).sequence()`.
	 *  @param f       Functions that maps values of type T to streams of type M.
	 *  @param options Optional configuration.
	 *  @typeparam M   Type of values contained in the output stream.
	 *  @returns       Sequence of values from streams crated by applying `f`.
	 */
	flatMap<M> (f: (t: T | RedioEnd) => RedioPipe<M>, options?: RedioOptions): RedioPipe<M>
	flatten<F> (options?: RedioOptions): RedioPipe<F> // where T === Liquid<F>
	fork (options?: RedioOptions): RedioPipe<T>
	merge<M> (options?: RedioOptions): RedioPipe<M>
	observe (options?: RedioOptions): RedioPipe<T>
	otherwise<O> (ys: RedioPipe<O> | (() => RedioPipe<O>), options?: RedioOptions): RedioPipe<T | O>
	parallel<P> (n: number, options?: RedioOptions): RedioPipe<P>
	sequence<S> (options?: RedioOptions): RedioPipe<S>
	series<S> (options?: RedioOptions): RedioPipe<S>
	zip<Z> (ys: RedioPipe<Z> | Array<Z>, options?: RedioOptions): RedioPipe<[T, Z]>

	// Consumption
	each (dotoall: (t: T) => void | Promise<void>, options?: RedioOptions): RedioStream<T>
	pipe (dest: WritableStream<T>, streamOptions: object, options?: RedioOptions): RedioStream<T>
	toArray (options?: RedioOptions): Promise<Array<T>>
	toCallback (f: (err: Error, value: T) => void): RedioStream<T> // Just one value
	toNodeStream (streamOptions: object, options?: RedioOptions): ReadableStream
	http (uri: string | URL, options?: HTTPOptions): RedioStream<T>

	// forceEnd (options?: RedioOptions): RedioPipe<T>
}

abstract class RedioFitting implements PipeFitting {
	private static counter: number = 0
	public readonly fittingId: number
	constructor () {
		this.fittingId = RedioFitting.counter++
	}
}

abstract class RedioProducer<T> extends RedioFitting implements RedioPipe<T> {
	protected _followers: Array<RedioProducer<any> | RedioSink<T>> = []
	protected _pullCheck: Set<number> = new Set<number>()
	protected _buffer: (T | RedioEnd)[] = []
	protected _running: boolean = true
	protected _bufferSizeMax: number = 10
	protected _drainFactor: number = 0.7
	protected _debug: boolean = false
	protected _oneToMany: boolean = false
	protected _rejectUnhandled: boolean = true
	protected _processError: boolean = false
	protected _paused: boolean = false // Pausing stop pushing until all followers pull

	constructor (options?: RedioOptions) {
		super()
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
			if (options && options.hasOwnProperty('rejectUnhandled')) {
				this._rejectUnhandled = options.rejectUnhandled as boolean
			}
			if (options && options.hasOwnProperty('processError')) {
				this._processError = options.processError as boolean
			}
		}
	}

	protected push (x: T | RedioEnd): void {
		this._buffer.push(x)
		if (this._debug) {
			console.log(`Push in fitting ${this.fittingId}: buffer now length=${this._buffer.length} value=${x}`)
		}
		if (this._buffer.length >= this._bufferSizeMax) this._running = false
		if (!this._paused) {
			this._followers.forEach(follower => follower.next())
		}
	}

	pull <U> (puller: PipeFitting): T | RedioEnd | null {
		let provideVal = !this._pullCheck.has(puller.fittingId)
		if (!provideVal) {
			if (this._debug) {
				console.log(`Pausing on pull in fitting ${this.fittingId} with ${this._followers.length}. Repeated pulls from ${puller.fittingId}.`)
			}
			this._paused = true
		}
		this._pullCheck.add(puller.fittingId)
		if (this._debug) {
			console.log(`Received pull at fitting source ${this.fittingId} to destination ${puller.fittingId} with count ${this._pullCheck.size} / ${this._followers.length}`)
		}
		let val: T | RedioEnd | undefined
		if (this._pullCheck.size === this._followers.length) {
			val = this._buffer.shift()
			this._pullCheck.clear()
			if (!this._running && this._buffer.length < this._drainFactor * this._bufferSizeMax) {
				this._running = true
				process.nextTick(() => this.next())
			}
			if (this._paused) {
				if (this._debug) {
					console.log(`Resuming in pull for fitting ${this.fittingId}.`)
				}
				this._paused = false
				this._followers.forEach(follower => follower.next())
			}
		} else {
			val = provideVal ? this._buffer[0] : undefined
		}
		return val !== undefined ? val : null
	}

	next (): Promise<void> { return Promise.resolve() }

	valve <S> (valve: Valve<T, S>, options?: RedioOptions): RedioPipe<S> {
		if (this._followers.length > 0) {
			throw new Error('Cannot consume a stream that already has a consumer. Use fork or observe.')
		}
		this._followers = [ new RedioMiddle<T, S>(this, valve, options) ]
		this._pullCheck.clear()
		return this._followers[0] as RedioPipe<S>
	}

	spout (spout: Spout<T>, options?: RedioOptions): RedioStream<T> {
		if (this._followers.length > 0) {
			throw new Error('Cannot consume a stream that already has a consumer. Use fork or observe.')
		}
		this._followers = [ new RedioSink<T>(this, spout, options) ]
		this._pullCheck.clear()
		return this._followers[0] as RedioStream<T>
	}

	append (v: Liquid<T>, options?: RedioOptions): RedioPipe<T> {
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (this._debug) { console.log(`Append at end ${isEnd(t)} value ${t}`) }
			if (isEnd(t)) {
				return v
			} else {
				return t
			}
		}, options)
	}

	batch (_n: Promise<number> | number, _options?: RedioOptions): RedioPipe<Array<T>> {
		throw new Error('Not implemented')
	}

	collect (_options?: RedioOptions): RedioPipe<Array<T>> {
		throw new Error('Not implemented')
	}

	compact (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	consume <M> (
		_f: (err: Error, x: T, push: (m: Liquid<M>) => void, next: () => void) => Promise<void> | void,
		_options?: RedioOptions): RedioPipe<M> {
		throw new Error('Not implemented')
	}

	debounce (_ms: Promise<number> | number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	doto (f: (t: T) => Promise<void> | void, _options?: RedioOptions): RedioPipe<T> {
		return this.valve((t: Liquid<T>): Liquid<T> => {
			if (!isEnd(t)) {
				f(t)
			}
			return t
		})
	}

	drop (num: number | Promise<number>, options?: RedioOptions): RedioPipe<T> {
		let count = 0
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (!isEnd(t)) {
				return count++ >= await num ? t : nil
			}
			return end
		}, options)
	}

	errors (
		f: (err: Error) => Promise<Liquid<T>> | Liquid<T>,
		options?: RedioOptions): RedioPipe<T> {
		if (options) {
			options.processError = true
		} else {
			options = { processError: true }
		}
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (isAnError(t)) {
				let result = await f(t)
				if (typeof result === 'undefined' ||
						(typeof result === 'object' && result === null)) {
					return nil
				} else {
					return result
				}
			} else {
				return t
			}
		}, options)
	}

	filter (filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T> {
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (!isEnd(t)) {
				return (await filter(t)) ? t : nil
			}
			return end
		}, options)
	}

	find (_filter: (t: T) => Promise<boolean> | boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	findWhere (_props: object, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	group (_f: string | ((t: T) => any), _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	head (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	intersperse<I> (_sep: Promise<I> | I, _options?: RedioOptions): RedioPipe<T | I> {
		throw new Error('Not implemented')
	}

	invoke<R> (_method: string, _args: Array<any>, _options?: RedioOptions): RedioPipe<R> {
		throw new Error('Not implemented')
	}

	last (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	latest (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	map<M> (mapper: (t: T) => M | Promise<M>, options?: RedioOptions): RedioPipe<M> {
		return this.valve(async (t: Liquid<T>): Promise<Liquid<M>> => {
			if (!isEnd(t)) return mapper(t)
			return end
		}, options)
	}

	pick (_properties: Array<string>, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	pickBy (_f: ((key: string, value: any) => boolean), _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	pluck (_prop: string, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	ratelimit (_num: number, _ms: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	reduce<R> (_iterator: ((a: R, b: T) => R), _init: R, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	reduce1<T> (_iterator: ((a: T, b: T) => T), _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	reject (_filter: (t: T) => Promise<boolean> | boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	scan<R> (_iterator: ((a: R, b: T) => R), _init: R, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	scan1 (_iterator: ((a: T, b: T) => T), _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	slice (_start: number, _end: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	sort (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	sortBy (_f: (a: T, b: T) => number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	split (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	splitBy (_sep: string | RegExp, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	stopOnError (_f: (err: Error) => void, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	take (num: number | Promise<number>, options?: RedioOptions): RedioPipe<T> {
		let count = 0
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (!isEnd(t)) {
				return count++ < await num ? t : nil
			}
			return end
		}, options)
	}

	tap (_f: (t: T) => Promise<void> | void, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	throttle (_ms: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	uniq (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	uniqBy (_f: (a: T, b: T) => boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	where (_props: object, _options?: RedioOptions): RedioPipe<T> { // Filter on object properties
		throw new Error('Not implemented')
	}

	// Higher order streams
	concat (_ys: RedioPipe<T> | Array<T>, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	flatFilter (_f: (t: T) => RedioPipe<boolean>, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	flatMap<M> (mapper: (t: Liquid<T>) => RedioPipe<M>, options?: RedioOptions): RedioPipe<M> {
		let localOptions = Object.assign(options, { oneToMany: true } as RedioOptions)
		return this.valve(async (t: Liquid<T>): Promise<LotsOfLiquid<M>> => {
			if (!isEnd(t)) {
				let values = await mapper(t).toArray()
				if (Array.length === 0) return nil
				return values
			}
			return end
		}, localOptions)
	}

	flatten<F> (_options?: RedioOptions): RedioPipe<F> { // where T === Liquid<F>
		throw new Error('Not implemented')
	}

	fork (options?: RedioOptions): RedioPipe<T> {
		let identity = new RedioMiddle<T, T>(this, i => i, options)
		this._followers.push(identity)
		return identity
	}

	merge<M> (_options?: RedioOptions): RedioPipe<M> {
		throw new Error('Not implemented')
	}

	observe (_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	otherwise<O> (_ys: RedioPipe<O> | (() => RedioPipe<O>), _options?: RedioOptions): RedioPipe<T | O> {
		throw new Error('Not implemented')
	}

	parallel<P> (_n: number, _options?: RedioOptions): RedioPipe<P> {
		throw new Error('Not implemented')
	}

	sequence<S> (_options?: RedioOptions): RedioPipe<S> {
		throw new Error('Not implemented')
	}

	series<S> (_options?: RedioOptions): RedioPipe<S> {
		throw new Error('Not implemented')
	}

	zip<Z> (_ys: RedioPipe<Z> | Array<Z>, _options?: RedioOptions): RedioPipe<[T, Z]> {
		throw new Error('Not implemented')
	}

	each (dotoall: (t: T) => Promise<void>, options?: RedioOptions): RedioStream<T> {
		return this.spout(async (tt: T | RedioEnd) => {
			if (isEnd(tt)) {
				if (options && options.debug) {
					console.log('Each: THE END')
				}
				return
			}
			await dotoall(tt)
		}, options)
	}

	pipe (_stream: WritableStream<T>, _options?: RedioOptions): RedioStream<T> {
		throw new Error('Not implemented')
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

	toCallback (_f: (err: Error, value: T) => void): RedioStream<T> { // Just one value
		throw new Error('Not implemented')
	}

	toNodeStream (_streamOptions: object, _options?: RedioOptions): ReadableStream {
		throw new Error('Not implemented')
	}

	http (_uri: string | URL, _options?: RedioOptions): RedioStream<T> {
		throw new Error('Not implemented')
	}

	get options (): RedioOptions {
		return literal<RedioOptions>({
			bufferSizeMax: this._bufferSizeMax,
			drainFactor: this._drainFactor,
			debug: this._debug,
			rejectUnhandled: this._rejectUnhandled,
			processError: this._processError
		})
	}
}

class RedioStart<T> extends RedioProducer<T> {
	private _maker: Funnel<T>

	constructor (maker: Funnel<T>, options?: RedioOptions) {
		super(options)
		this._maker = maker
		process.nextTick(() => this.next())
	}

	async next () {
		if (this._running) {
			try {
				let result = await this._maker()
				if (this._oneToMany && Array.isArray(result)) {
					result.forEach(x => this.push(x))
				} else if (isNil(result)) {
					// Don't push
				} else {
					this.push(result)
				}
				if (result !== end && !(Array.isArray(result) && result.some(isEnd))) {
					process.nextTick(() => this.next())
				}
			} catch (err) {
				this.push(err)
				process.nextTick(() => this.next())
			}
		}
	}
}

/**
 *  Tests of the given value is a promise, in any state.
 *  @param o Value to test.
 *  @typeparam T Optional type that the promise resolves to.
 *  @return Value is a promise?
 */
export function isAPromise<T> (o: any): o is Promise<T> {
	return isPromise(o)
}

class RedioMiddle<S, T> extends RedioProducer<T> {
	private _middler: Valve<S, T>
	private _ready: boolean = true
	private _prev: RedioProducer<S>

	constructor (prev: RedioProducer<S>, middler: Valve<S, T>, options?: RedioOptions) {
		super(Object.assign(prev.options, { processError: false }, options))
		this._middler = (s: S | RedioEnd) => new Promise<T | RedioEnd>((resolve, reject) => {
			this._ready = false
			let callIt = middler(s)
			if (isAnError(callIt)) {
				callIt = Promise.reject(callIt)
			}
			let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
			promisy.then((t: T | RedioEnd) => {
				this._ready = true
				resolve(t)
				if (this._debug) {
					console.log(`Fitting ${this._debug}: middler(${isEnd(s) ? 'THE END' : s}) = ${t}`)
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
			let v: S | RedioEnd | null = this._prev.pull(this)
			if (this._debug) {
				console.log('Just called pull in value. Fitting', this.fittingId, 'value', v)
			}
			if (isAnError(v) && !this._processError) {
				this.push(v)
				process.nextTick(() => this.next())
			} else if (v !== null) {
				try {
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
				} catch (err) {
					this.push(err)
				} finally {
					if (this._debug) {
						console.log('About to call next in', this.fittingId)
					}
					this.next()
					// process.nextTick(() => this.next())
				}
			}
		}
	}
}

/**
 *  The end of a pipeline of a reactive stream where the liquid flows out.
 *  Methods `done`, `catch` and `toPromise` decide what happens at the end
 *  of a stream by _registering_ a behaviour. Each can be combined but only
 *  one of each type can be called per stream.
 *  @typeparam T Type of liquid flowing out of the stream.
 */
export interface RedioStream<T> extends PipeFitting {
	done (thatsAllFolks: () => void): RedioStream<T>
	catch (errFn: (err: Error) => void): RedioStream<T>
	/**
	 *  Register a single promise that resolves when the stream has
	 *  ended, returning the last value in the stream, or [[nil]] for an empty
	 *  stream. Only call this once per stream. Use [[each]] to process each
	 *  element of the stream.
	 *  @returns Promise that resolves to the last value in the stream.
	 */
	toPromise (): Promise<Liquid<T>>
}

class RedioSink<T> extends RedioFitting implements RedioStream<T> {
	private _sinker: (t: T | RedioEnd) => Promise<void>
	private _prev: RedioProducer<T>
	private _ready: boolean = true
	private _debug: boolean
	private _rejectUnhandled: boolean = true
	private _thatsAllFolks: (() => void) | null = null
	private _errorFn: ((err: Error) => void) | null = null
	private _resolve: ((t: Liquid<T>) => void) | null = null
	private _reject: ((err: any) => void) | null = null
	private _last: Liquid<T> = nil

	constructor (prev: RedioProducer<T>, sinker: Spout<T>, options?: RedioOptions) {
		super()
		this._debug = options && options.hasOwnProperty('debug') ? options.debug as boolean : prev.options.debug as boolean
		this._rejectUnhandled = options && options.hasOwnProperty('rejectUnhandled') ? options.rejectUnhandled as boolean : prev.options.rejectUnhandled as boolean
		this._sinker = (t: T | RedioEnd) => new Promise<void>((resolve, reject) => {
			this._ready = false
			let callIt: void | Promise<void>
			if (isAnError(t)) {
				callIt = Promise.reject(t)
			} else {
				callIt = sinker(t)
			}
			let promisy: Promise<any> = isAPromise(callIt) ? callIt : Promise.resolve()
			promisy.then(async (_value: void): Promise<void> => {
				this._ready = true
				resolve()
				if (!isEnd(t)) {
					process.nextTick(() => this.next())
				} else {
					if (this._thatsAllFolks) {
						this._thatsAllFolks()
					}
					if (this._resolve) {
						this._resolve(this._last)
					}
				}
				this._last = t
				return Promise.resolve()
			}, (err?: any): void => {
				// this._ready = true
				reject(err as any | undefined)
			})
		})
		this._prev = prev
	}

	next () {
		if (this._ready) {
			let v: T | RedioEnd | null = this._prev.pull(this)
			if (this._debug) {
				console.log('Just called pull in spout. Fitting', this.fittingId, 'value', v)
			}
			if (v !== null) {
				this._sinker(v).catch(err => {
					let handled = false
					if (this._errorFn) {
						handled = true
						this._errorFn(err)
					}
					if (this._reject) {
						handled = true
						this._reject(err)
					}
					if (!handled) {
						if (this._debug || !this._rejectUnhandled) {
							console.log(`Error: Unhandled error at end of chain: ${err.message}`)
						}
						// Will be unhandled - thrown into asynchronous nowhere
						if (this._rejectUnhandled) {
							console.log('Here we go!!!', this._rejectUnhandled)
							throw err
						}
					}
				})
			}
		}
	}

	done (thatsAllFolks: () => void): RedioStream<T> {
		this._thatsAllFolks = thatsAllFolks
		return this
	}

	catch (errFn: (err: Error) => void): RedioStream<T> {
		this._errorFn = errFn
		return this
	}

	toPromise (): Promise<Liquid<T>> {
		return new Promise<Liquid<T>>((resolve, reject) => {
			this._resolve = resolve
			this._reject = reject
		})
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
/**
 *  Create a stream of values of type `T` using a lazy [[Generator]] function. A
 *  generator function receives callback functions `push` and `next` that it uses
 *  to create zero or more values to push onto the stream, possibly asynchronously.
 *  Next must be called to request that the function is called again.
 *  @param generator Generator function.
 *  @param options   Optional configuration.
 *  @return Stream of values _pushed_ by the generator.
 */
export default function<T> (generator: Generator<T>, options?: RedioOptions): RedioPipe<T>
// export default function<T> (stream: ReadableStream<T>): RedioPipe<T>
// export default function<T> (e: EventEmitter, eventName: string, options?: RedioOptions): RedioPipe<T>
/**
 *  Create a stream of values from the given array.
 *  @param data    Array of data to use to create a stream.
 *  @param options Optional configuration.
 *  @typeparam T   Type of values in the source array pushed onto the stream.
 *  @return Stream of values created from the array of data.
 */
export default function<T> (data: Array<T>, options?: RedioOptions): RedioPipe<T>
// export default function<T> (url: string, options?: RedioOptions): RedioPipe<T>
/**
 *  Create a stream of values of type `T` using a [[Funnel]] function, a _thunk_
 *  that is called every time the stream requires a new value. The _thunk_ maybe
 *  asynchronous and by returning a promise to produce a value. The value will be
 *  pushed onto the stream when the promise resolves and only then will the next
 *  value from the stream be requested.
 *  @param funnel  Funnel function, a thunk that synchronously or asynchronously
 *                 generates a value.
 *  @param options Optional configuration.
 *  @typeparam T   Type of values in the stream.
 *  @return Stream of values created by repeatedly calling the funnel function.
 */
export default function<T> (funnel: Funnel<T>, options?: RedioOptions): RedioPipe<T>
/** Implementation of the default stream generator function. Use an override. */
export default function<T> (
	args1: Funnel<T> | string | Array<T> | EventEmitter | ReadableStream<T> | Generator<T> | Iterable<T> | Iterator<T>,
	args2?: RedioOptions | string,
	_args3?: RedioOptions): RedioPipe<T> | null {

	if (typeof args1 === 'function') {
		if (args1.length === 0) { // Function is Funnel<T>
			return new RedioStart<T>(args1 as Funnel<T>, args2 as RedioOptions | undefined)
		}
		// Assume function is Generator<T>
		let funnelGenny: Funnel<T> = () => new Promise<LotsOfLiquid<T>>((resolve, reject) => {
			let values: Array<Liquid<T>> = []
			let push = (t: LotsOfLiquid<T>) => {
				if (Array.isArray(t)) {
					values.concat(t)
				} else {
					values.push(t)
				}
			}
			let next = () => {
				resolve(values)
			}
			try {
				args1(push, next)
			} catch (err) {
				reject(err)
			}
		})
		let options = args2 ? args2 as RedioOptions : {}
		options.oneToMany = true
		return new RedioStart<T>(funnelGenny, options)
	}
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
