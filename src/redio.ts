/* eslint-disable @typescript-eslint/no-unused-vars */

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
import { httpSource } from './http-source'
import { Readable } from 'stream'
import { ReadStream } from 'fs'
import { ServerOptions } from 'https'
import { httpTarget } from './http-target'
import { RequestOptions } from 'https'
const { isPromise } = types

/** Type of a value sent down a stream to indicate that it has ended. No values
 *  should follow.
 */
export type RedioEnd = { end: true }
/** Constant value indicating the [[RedioEnd|end]] of a stream. */
export const end: RedioEnd = { end: true }
/**
 *  Test that a value is the end of a stream.
 *  @param t Value to test.
 *  @return True is the value is the end of a stream.
 */
export function isEnd(t: unknown): t is RedioEnd {
	return t === end
}

/** Empty value. Nil values are sent down streams to indicate no value in the
 *  stream at this time. Nil values will be dropped at the earliest opportunity
 *  and should never be received at the end of a stream.
 *
 *  Nil values can be used in processing stages that consume more values than they
 *  produce.
 */
export type RedioNil = { nil: true }
/** Constant representing a [[RedioNil|nil]] value. */
export const nil: RedioNil = { nil: true }
/**
 *  Test a value to see if it is an [[RedioNil|empty value]].
 *  @param t Value to test.
 *  @return True if the value is the _nil_ empty value.
 */
export function isNil(t: unknown): t is RedioNil {
	return t === nil
}

/**
 *  Test a value to see if it is an [[Error]].
 *  @param t Value to test.
 *  @return True if the value is an error.
 */
export function isAnError(t: unknown): t is Error {
	return types.isNativeError(t)
}

/** Types of values that can flow down a stream. Values are either of the given
 *  type, the [[end]] or [[nil]].
 */
export type Liquid<T> = T | RedioEnd | RedioNil | Error
/** A collection of values that can flow down a stream. This type is used
 *  when a processing stage produces more than it consumes, a _one-to-many_
 *  function, to represent a sequence of values to be flattened into the stream.
 */
export type LotsOfLiquid<T> = Liquid<T> | Array<Liquid<T | RedioEnd>>

/**
 * Test a value to see if it is an stream value, not `end`, `nil` or an error.
 * @param t Value to test
 * @return True is the value is stream value.
 */
export function isValue<T>(t: Liquid<T>): t is T {
	return t !== nil && t !== end && !types.isNativeError(t)
}

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
	 *  funciton can produce more than one value per input and the output will
	 *  be flattened.
	 *  @param s Single item to consume.
	 *  @return Promise to produce item(s) or the direct production of item(s).
	 */
	(s: S | RedioEnd): Promise<LotsOfLiquid<T>> | LotsOfLiquid<T>
}

/**
 *  A funciton that can be used to process an incoming stream of liquid or errors
 *  and create a possibly different kind of stream of liquid.
 *  This is an advanced feature. In normal use, allow redioactive to handle and
 *  propogate errors.
 *  @typeparam S Source type for the itemsconsumed.
 *  @typeparam T Target type for items produced.
 */
export interface ErrorValve<S, T> {
	/**
	 *  A function that consumes a single item or error from an incoming stream and produces
	 *  values for an outgoing stream. The function an return [[nil]] if the
	 *  input produces no output. Set the [[RedioOptions.oneToMany]] flag if the
	 *  funciton can produce more than one value per input and the output will
	 *  be flattened. Also set [[RedioOptions.processError]].
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
	(t: T | RedioEnd): Promise<void> | void
}

/**
 *  Function at the end of a pipe for handling the output and errors of a stream.
 *  This is an advanced feature. In normal use, allow redioactive to handle and
 *  propogate errors.
 *  @typeparam T Type of items at the end of the stream.
 */
export interface ErrorSpout<T> {
	/**
	 *  A function that consumes a single item or an error at the end of a stream,
	 *  executing a side effect or operation that acts on the value. Also set
	 *  [[RedioOptions.processError]].
	 *  This is an advanced feature. In normal use, allow redioactive to handle and
	 *  propogate errors.
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
 *  Note: Set `oneToMany` to true for arrays to be flattened to a stream of
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
export function literal<T>(o: T): T {
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
	 *  ([[LotsOfLiquid]]) that should be flattened.
	 */
	oneToMany?: boolean
	/** Set this flag to cause an [unhandled rejection](https://nodejs.org/api/process.html#process_event_unhandledrejection)
	 *  at the end of the pipe. The default value is `true`. May cause the process
	 *  to crash.
	 */
	rejectUnhandled?: boolean
	/** Set this flag to allow a valve to process an error. Defaults to `false` and
	 *  must be set for each stage that it applies to. Use in conjunction with
	 *  [[ErrorValve]] and [[ErrorSpout]].
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
 *
 *  HTTP streams consist of a RESTful resource at a given path, the _stream root path_.
 *  This stream has sub-resources that include an optoinal _stream manifest_ and a sequence of
 *  values, where each value in the sequence has an _sequence identifier_ and a reference
 *  to the _next_ value in the sequence, which may be computed from a _delta increment).
 *  Sequence identifiers can be names, timestamps, counters etc.. These options set - or
 *  reference the properties of a stream type `T` - to be used to configure the
 *  stream.
 *
 *  The size of any buffer used along the path is defined by the `RedioOptions.bufferSizeMax`
 *  property. This includes how many values are available to be pulled.
 */
export interface HTTPOptions extends RedioOptions {
	/** HTTP port to use for pull or push. Default is 8765. Set to `-1` to disable. */
	httpPort?: number
	/** HTTPS port to use for pull or push. Default is 8766. Set to `-1` to disable.  */
	httpsPort?: number
	/** Options required to create an HTTP/S server. For HTTPS, include the `key and `cert` properties. For
	 *  self-signed certificates used during testing, set `rejectUnauthorized` to `false`.
	 */
	serverOptions?: ServerOptions
	/** Additional options required to make HTTP/S requests, such as keys and certificates.
	 */
	requestOptions?: RequestOptions
	/** Append the first value of the named property of type `T` to complete the stream
	 *  root path, e.g. if the URI contains `/fred/ginger` and the property of `T` called
	 *  _extraStreamRoot_ has value `streamId` with value `audio/channel3`, the full stream
	 *  root is `/fred/ginger/audio/channel3/`. If undefined, then `/fred/ginger/`.
	 */
	extraStreamRoot?: string
	/** Use the named property of `T` as the identifier for each value flowing down the
	 *  stream, for example a timestamp or timestamp generator funciton. If omitted,
	 *  a numerical counter will be used.
	 */
	seqId?: string
	/** Either a number representing an amount to increment the sequence identifier of
	 *  the name of a property of `T` to use to provide the delta. Defaults to incrementing
	 *  a counter by 1. Note that the referenced property is itself of type `number | string`,
	 *  where:
	 *  * `number` - the value to add to the previous sequence indentifier
	 *  * `string` - the actual sequence identifier of the next item
	 */
	delta?: number | string
	/** Allow fuzzy matching of stream identifiers. Will allow either a close string match
	 *  or numerical window around the _current + delta_ value. The value must be between
	 * `0.0` and `0.9`, with `0.0` being an exact match is required, `0.1` is 10% either side
	 *  of the average gap and `0.9` is 90% either side of the average gap. Default is exact
	 * matching with `0.0`.
	 */
	// TODO range check
	fuzzy?: number
	/** Provide the optional manifest that is a description of the entire stream. The
	 *  manifest will be available from every received value. If set to a string, the
	 *  manifest is taken from the first value of property `T` of that name found
	 *  in the stream. The default is not to set a manifest.
	 */
	manifest?: string | Record<string, unknown>
	/** Set if a property of a value of `T` defines the binary payload of an HTTP stream.
	 *  If defined, any other properties of the value are carried in the HTTP header.
	 */
	blob?: string
	/** Content-Type header to use for blob payloads. This defaults to
	 *  `application/octet-stream` but can be set to any MIME type. For example, if you
	 *  are sending a sequence of JPEG images, use the opportunity to set `image/jpeg` to
	 *  help with debugging from a browser.
	 */
	contentType?: string
	/** Apply back pressure based on how much of the streams has been read. Back pressure
	 *  will be based on the the value with the highest sequence identifier being transferred
	 *  to a stream receiver. For pull streams, more than one receiver may exist. Wihout back
	 *  pressure, the oldest bufferred values may be dropped from the internal buffer without
	 *  being transforred. The default is `true` - apply back pressure.
	 */
	backPressure?: boolean
	/** How many parallel streams should be used to send the stream. This allows a number
	 *  of values to be in flight at one time, although the stream will always be
	 *  sent and received in order. When undefined, the default value is 1.
	 */
	parallel?: number
	/** How many chunks should the binary payload be split into. In combination with the
	 *  parallel setting, this may allows for low-latency parallel transport of large
	 *  binary values, such as video frames. When undefined, the default is 1.
	 */
	chunked?: number
	/** How often should the stream be checked for for new values. This allows pull clients
	 *  to back off their requests to match the natural rythmn of the stream. The value
	 *  is measured in miliseconds.
	 */
	cadence?: number
	/** Maximum time that any HTTP request or response should wait before timing out.
	 *  For example, when requesting the next value of a stream by pull, either the next
	 *  value is produced within the time interval or a 404/410 response is generated.
	 */
	timeout?: number
	/** Length of time an HTTP/S keep alive socket is kept open after a request. The default
	 *  is 5000ms - which is normally fine - but may cause a delay in a Node.js process
	 *  closing. Smaller values may be useful in testing.
	 */
	keepAliveTimeout?: number
}

/**
 * Options specific to processing
 * [Node.JS readable streams](https://nodejs.org/docs/latest-v12.x/api/stream.html#stream_readable_streams).
 */
interface StreamOptions extends RedioOptions {
	/** Number of bytes to requests on each read of the stream. Default depends on
	 *  platform and stream type.
	 */
	chunkSize?: number
	/** Encoding to set to convert buffers to strings. Leave unset for buffers. */
	encoding?: string
}

/**
 * Options sepcific to streams made from
 * [Node.JS event emitters](https://nodejs.org/docs/latest-v12.x/api/events.html).
 */
interface EventOptions extends RedioOptions {
	/** Name of an event emitted when an event emitter has ended, e.g. `finish`, `close` or
	 *  `end`. Defaults to `end` - which might result in a stream never ending!
	 */
	endEvent?: string
	/** Name of an event emitted when an error occurs, e.g. `error`. Errors are sent
	 *  on down the pipe. Defaults to `error`.
	 */
	errorEvent?: string
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
	valve<S>(valve: Valve<T, S> | ErrorValve<T, S>, options?: RedioOptions): RedioPipe<S>
	/**
	 *  Apply a [[Spout|spout]] function at the end of pipe.
	 *  @param spout  Spout function to apply to each element.
	 *  @returns A completed stream.
	 */
	spout(spout: Spout<T> | ErrorSpout<T>, options?: RedioOptions): RedioStream<T>

	// Transforms
	/**
	 *  Append a value to the end of a stream.
	 *  ```typescript
	 *  redio([1, 2, 3]).append(4) // => 1, 2, 3, 4
	 *  ```
	 *  @param v       Value to append to end of stream.
	 *  @param options Optional configuration.
	 *  @returns Pipe containing stream with the additional element.
	 */
	append(v: T | RedioEnd | Promise<T>, options?: RedioOptions): RedioPipe<T>
	/**
	 * Takes a stream and batches incoming data into arrays of the given length.
	 * ```typescript
	 * redio([1, 2, 3, 4, 5]).batch(2) // => [1, 2], [3, 4], [5]
	 * ```
	 * @param n       Length of each batch.
	 * @param options Optional configuration.
	 * @returns Batches of values from the input stream.
	 */
	batch(n: Promise<number> | number, options?: RedioOptions): RedioPipe<Array<T>>
	/**
	 * Group all the values of the incoming stream into and single array. Works like
	 * [[toArray | `toArray()`]] but part way along the pipe as a valve.
	 * ```typescript
	 * redio(new Set([1, 2, 3])).collect().toArray() // [[1, 2, 3]] - single element
	 * ```
	 * @param options Optional parameters.
	 * @return Stream of collected values made by consuming the complete input stream.
	 */
	collect(options?: RedioOptions): RedioPipe<Array<T>>
	/**
	 * Removes all non-truthy values from a stream.
	 * ```typescript
	 * redio([1, null, 2, undefined, 0, '', 3]).toArray() // [1, 2, 3]
	 * ```
	 * @param options Optional configuration.
	 * @returns Stream containing only truthy values.
	 */
	compact(options?: RedioOptions): RedioPipe<T>
	/**
	 * Function that consumes values from the incoming stream and - using callbacks -
	 * produces zero, one or more values (or Errors) on an output stream. With this toolkit
	 * function, it is possible to contruct other higher-order [[Valve|valves]] using
	 * callbacks.
	 * Note that redioactive prefers the use of promises over callbacks. Conider using
	 * [[RedioPipe.valve]] instead.
	 * The function takes:
	 * * `err` An error if the next value in the stream is an error, or `null`.
	 * * `x` A value if the next value to flow down the stream is a value, the stream
	 *   [[RedioEnd|end]] or `null`.
	 * * `push` - Call this when it is time to produce a value, error or end.
	 * * `next` - Call this when ready to receive the next value.
	 *
	 * @param f Function that takes an error, a value, a push function and a next function.
	 * @param options Ooptional parameters.
	 * @returns Stream created with the function and its use of the callbacks.
	 */
	consume<M>(
		f: (
			err: Error | null,
			x: T | RedioEnd | null,
			push: (m: Liquid<M>) => void,
			next: () => void
		) => void,
		options?: RedioOptions
	): RedioPipe<M>
	/**
	 * Holds off pushing values down the pipe until there has been no more data for
	 * the specified number of milliseconds. Sends the most recently received value before the
	 * delay, discarding all other values. At the end of the source stream, the last value
	 * received value is sent onwards immediately.
	 * ```typescript
	 * let pusher: (v?: number | RedioEnd | PromiseLike<number | RedioEnd> | undefined) => void = () => {  }
	 * const funnel: Funnel<number> = () => new Promise<Liquid<number>>((resolve) => {
	 *     pusher = resolve
	 * })
	 * let wait = (t: number) => new Promise<void>((resolve) => { setTimeout(resolve, t) })
	 * async function run() {
	 *   const stream = redio(funnel).debounce(75).toArray()
	 *   pusher(1)
	 *   await wait(10)
	 *   pusher(2)
	 *   await wait(100)
	 *   pusher(3)
	 *   await wait(50)
	 *   pusher(end)
	 * }
	 * run() // [2, 3] after 260ms
	 * ```
	 * @param ms      Length of delay before emitting.
	 * @param options Optional parameters.
	 * @returns Stream containing debounced values.
	 */
	debounce(ms: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
	/**
	 * Execute a function on each value of the stream, emitting the value onto the output
	 * stream. This is useful to take side-effect action such as logging and can be used to
	 * make side-effect modifications to objects in the stream. Errors are not passed to the
	 * function.
	 * Note that although the function can return a promise, it does not wait for that promise
	 * to resolve or apply any back pressure.
	 * ```typescript
	 * redio([1, 2, 3]).doto(console.log).each(() => {})
	 * // 1
	 * // 2
	 * // 3
	 *
	 * // Mutating values by side-effect - use with caution!
	 * redio([[1], [2], [3]]).doto(x => x.push(1)).toArray() // [[1, 1], [2, 1], [3, 1]]
	 * ```
	 * @param f       Function to apply to each value of the stream.
	 * @param options Optional parameters.
	 * @returns Stream containing the same values as the input stream.
	 */
	doto(f: (t: T) => Promise<void> | void, options?: RedioOptions): RedioPipe<T>
	/**
	 * Ignores the first `num` values of the stream and emits the rest.
	 * ```typescript
	 * redio([1, 2, 3, 4]).drop(2) // 3, 4
	 * ```
	 * @param num     Number of values to drop from the source. Default is 1.
	 * @param options Optional configuration.
	 * @returns Pipe containing a stream of values with the first `num` values missing.
	 */
	drop(num?: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
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
	errors(f: (err: Error) => Promise<Liquid<T>> | Liquid<T>, options?: RedioOptions): RedioPipe<T>
	/**
	 *  Apply the given filter function to all the values in the stream, keeping
	 *  those that pass the test.
	 *  ```typescript
	 *
	 *  ```
	 *  @param filter  Function returning true for values to keep.
	 *  @param options Optional configuration.
	 *  @returns Stream of values that pass the test.
	 */
	filter(filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>
	find(filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>
	findWhere(props: Record<string, unknown>, options?: RedioOptions): RedioPipe<T>
	group(f: string | ((t: T) => unknown), options?: RedioOptions): RedioPipe<T>
	head(options?: RedioOptions): RedioPipe<T>
	intersperse<I>(sep: Promise<I> | I, options?: RedioOptions): RedioPipe<T | I>
	invoke<R>(method: string, args: Array<unknown>, options?: RedioOptions): RedioPipe<R>
	last(options?: RedioOptions): RedioPipe<T>
	latest(options?: RedioOptions): RedioPipe<T>
	/**
	 *  Transform a stream by applying the given `mapper` function to each element.
	 *  @typeparam M Type of the values in the output stream.
	 *  @param mapper  Function to transform each value.
	 *  @param options Optional configuration.
	 *  @returns Stream of transformed values.
	 */
	map<M>(
		mapper: (t: T) => M | Promise<M> | Array<M | RedioEnd> | Promise<Array<M | RedioEnd>>,
		options?: RedioOptions
	): RedioPipe<M>
	pick(properties: Array<string>, options?: RedioOptions): RedioPipe<T>
	pickBy(f: (key: string, value: unknown) => boolean, options?: RedioOptions): RedioPipe<T>
	pluck(prop: string, options?: RedioOptions): RedioPipe<T>
	ratelimit(num: number, ms: number, options?: RedioOptions): RedioPipe<T>
	reduce<R>(iterator: (a: R, b: T) => R, init: R, options?: RedioOptions): RedioPipe<T>
	reduce1<T>(iterator: (a: T, b: T) => T, options?: RedioOptions): RedioPipe<T>
	reject(filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>
	scan<R>(iterator: (a: R, b: T) => R, init: R, options?: RedioOptions): RedioPipe<T>
	scan1(iterator: (a: T, b: T) => T, options?: RedioOptions): RedioPipe<T>
	slice(start: number, end: number, options?: RedioOptions): RedioPipe<T>
	sort(options?: RedioOptions): RedioPipe<T>
	sortBy(f: (a: T, b: T) => number, options?: RedioOptions): RedioPipe<T>
	split(options?: RedioOptions): RedioPipe<T>
	splitBy(sep: string | RegExp, options?: RedioOptions): RedioPipe<T>
	stopOnError(f: (err: Error) => void, options?: RedioOptions): RedioPipe<T>
	/**
	 *  Take the first `num` elements from the stream, drop the rest.
	 *  @param num     Number of elements to include from the start of the stream.
	 *  @param options Optional configuration.
	 *  @returns Stream containing only the first `num` elements from the source.
	 */
	take(num?: Promise<number> | number, options?: RedioOptions): RedioPipe<T>
	tap(f: (t: T) => Promise<void> | void, options?: RedioOptions): RedioPipe<T>
	throttle(ms: number, options?: RedioOptions): RedioPipe<T>
	uniq(options?: RedioOptions): RedioPipe<T>
	uniqBy(f: (a: T, b: T) => boolean, options?: RedioOptions): RedioPipe<T>
	where(props: Record<string, unknown>, options?: RedioOptions): RedioPipe<T> // Filter on object properties

	// Higher order streams
	concat(ys: RedioPipe<T> | Array<T>, options?: RedioOptions): RedioPipe<T>
	flatFilter(f: (t: T) => RedioPipe<boolean>, options?: RedioOptions): RedioPipe<T>
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
	flatMap<M>(f: (t: T) => RedioPipe<M>, options?: RedioOptions): RedioPipe<M>
	flatten<F>(options?: RedioOptions): RedioPipe<F> // where T === Liquid<F>
	/**
	 *  Split the stream into two or more separate streams with shared backpressure.
	 *  It is the slowest conumer that regulates how fast the source stream produces
	 *  values. Other behaviour may be best achieved using [[observe]]. Call this
	 *  method twice or more on the source stream to create branches.
	 *  Note that the values passed along the stream are copied by reference. Be
	 *  aware that any side effects caused by subsequent pipeline stages on either
	 *  branch will modify the value.
	 *  @param options Optional configuration.
	 *  @returns A stream that is one forked branch of the source stream.
	 */
	fork(options?: RedioOptions): RedioPipe<T>
	merge<M>(options?: RedioOptions): RedioPipe<M>
	observe(options?: RedioOptions): RedioPipe<T>
	otherwise<O>(ys: RedioPipe<O> | (() => RedioPipe<O>), options?: RedioOptions): RedioPipe<T | O>
	parallel<P>(n: number, options?: RedioOptions): RedioPipe<P>
	/**
	 *  Reads a stream of streams and pushes each value on each streeam in sequence
	 *  in turn onto the output pipe, a kind of flatten.
	 *
	 *  @param options
	 */
	sequence<S>(options?: RedioOptions): RedioPipe<S>
	series<S>(options?: RedioOptions): RedioPipe<S>
	/**
	 * Takes two streams and returns a stream of corresponding pairs. If one stream is
	 * running faster than the other - it produces two values in the time that the other
	 * produces one - then a pair containing one undefined value may be produced.
	 * At stream end, the size of the resulting stream is determined by the smaller of
	 * the two source streams.
	 * @param ys The stream to combine values with
	 * @param options Optional configuration
	 */
	zip<Z>(ys: RedioPipe<Z>, options?: RedioOptions): RedioPipe<[T?, Z?]>
	/**
	 * Takes a stream and an array of N streams and returns a stream
	 * of the corresponding (N+1)-tuples.
	 * @param ys The array of streams to combine values with TODO: add support for a stream of streams
	 * @param options Optional configuration
	 */
	zipEach<Z>(ys: RedioPipe<Z>[], options?: RedioOptions): RedioPipe<[T, ...Z[]]>

	// Consumption
	/**
	 *  Consume the stream by executing a side-effect function on each value. For
	 *  example, writing each value of the stream to the console or to a stream.
	 *  @param dotoall Optional side-effect function to execute on each value. If
	 *                 no function is provided, `() => {}` is used, discarding all
	 *                 values. If the value returns a promise, it must resolve before
	 *                 the function is called again, applying backpressure to the
	 *                 stream.
	 *  @param options Optional configuration.
	 *  @returns The last fitting of a pipeline that consumes all the values.
	 */
	each(dotoall?: (t: T) => void | Promise<void>, options?: RedioOptions): RedioStream<T>
	pipe(
		dest: WritableStream<T>,
		streamOptions: Record<string, unknown>,
		options?: RedioOptions
	): RedioStream<T>
	/**
	 *  Consume the stream by writing each value into an array, then resolving
	 *  to that array when the stream ends. Any error in the pipeline will cause
	 *  the result to reject.
	 *  ```typescript
	 *  redio(new Set([1, 2, 3])).toArray() // [1, 2, 3]
	 *  ```
	 *  @param options Optional configuration.
	 *  @returns Promise to create an array containing the final values of the stream.
	 */
	toArray(options?: RedioOptions): Promise<Array<T>>
	toCallback(f: (err: Error, value: T) => void): RedioStream<T> // Just one value
	toNodeStream(streamOptions: Record<string, unknown>, options?: RedioOptions): ReadableStream
	/**
	 * Connect a stream to another processing node via HTTP/S. A matching funnel can receive
	 * the stream. HTTP/S streams must have a stream identifier root path, a unique identifier
	 * for each element in the sequence (i.e. a counter or timestamp) and a means to identify
	 * the next element (e.g. expected increment).The options provide a way to map the
	 * sequence of elements to HTTP headers and payloads.
	 * Note that not all kinds of payloads can be transported via HTTP, one of:
	 * * serializable to JSON object
	 * * a binary blob (Buffer or equivalent)
	 * * a simple JSON payload that can be serialized to HTTP headers and a nominated
	 *   binary blob property
	 * @param uri Depending on the kind of stream:
	 *            * for PUSH streams, a URL with protocol, hostname, port and stream
	 *              identifier root path
	 *            * for PULL streams, the stream identifier root path (protocol set in options)
	 * @param options Configuration with specific details of the HTTP connection.
	 * @returns The last fitting of a local pipeline that connects the pipe to a remote
	 *          stream processor.
	 */
	http(uri: string | URL, options?: HTTPOptions): RedioStream<T>

	// forceEnd (options?: RedioOptions): RedioPipe<T>
}

abstract class RedioFitting implements PipeFitting {
	private static counter = 0
	public readonly fittingId: number
	constructor() {
		this.fittingId = RedioFitting.counter++
	}
}

abstract class RedioProducer<T> extends RedioFitting implements RedioPipe<T> {
	protected _followers: Array<RedioProducer<unknown> | RedioSink<T>> = []
	protected _pullCheck: Set<number> = new Set<number>()
	protected _buffer: Liquid<T>[] = []
	protected _running = true
	protected _bufferSizeMax = 10
	protected _drainFactor = 0.7
	protected _debug = false
	protected _oneToMany = false
	protected _rejectUnhandled = true
	protected _processError = false
	protected _paused = false // Pausing stop pushing until all followers pull

	constructor(options?: RedioOptions) {
		super()
		if (options) {
			if (typeof options.bufferSizeMax === 'number' && options.bufferSizeMax > 0) {
				this._bufferSizeMax = options.bufferSizeMax
			}
			if (
				typeof options.drainFactor === 'number' &&
				options.drainFactor >= 0.0 &&
				options.drainFactor <= 1.0
			) {
				this._drainFactor = options.drainFactor
			}
			if (typeof options.debug === 'boolean') {
				this._debug = options.debug
			}
			if (options && Object.prototype.hasOwnProperty.call(options, 'oneToMany')) {
				this._oneToMany = options.oneToMany as boolean
			}
			if (options && Object.prototype.hasOwnProperty.call(options, 'rejectUnhandled')) {
				this._rejectUnhandled = options.rejectUnhandled as boolean
			}
			if (options && Object.prototype.hasOwnProperty.call(options, 'processError')) {
				this._processError = options.processError as boolean
			}
		}
	}

	protected push(x: Liquid<T>): void {
		this._buffer.push(x)
		if (this._debug) {
			console.log(
				`Push in fitting ${this.fittingId}: buffer now length=${this._buffer.length} value=${x}`
			)
		}
		if (this._buffer.length >= this._bufferSizeMax) this._running = false
		if (!this._paused) {
			this._followers.forEach((follower) => follower.next())
		}
	}

	pull(puller: PipeFitting): Liquid<T> {
		const provideVal = !this._pullCheck.has(puller.fittingId)
		if (!provideVal) {
			if (this._debug) {
				console.log(
					`Pausing on pull in fitting ${this.fittingId} with ${this._followers.length}. Repeated pulls from ${puller.fittingId}.`
				)
			}
			this._paused = true
		}
		this._pullCheck.add(puller.fittingId)
		if (this._debug) {
			console.log(
				`Received pull at fitting source ${this.fittingId} to destination ${puller.fittingId} with count ${this._pullCheck.size} / ${this._followers.length}`
			)
		}
		let val: Liquid<T> | undefined
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
				this._followers.forEach((follower) => follower.next())
			}
		} else {
			val = provideVal ? this._buffer[0] : undefined
		}
		return val !== undefined ? val : nil
	}

	next(): Promise<void> {
		return Promise.resolve()
	}

	valve<S>(valve: Valve<T, S> | ErrorValve<T, S>, options?: RedioOptions): RedioPipe<S> {
		if (this._followers.length > 0) {
			throw new Error('Cannot consume a stream that already has a consumer. Use fork or observe.')
		}
		this._followers = [
			new RedioMiddle<T, S>(this, valve as ErrorValve<T, S>, options) as RedioProducer<unknown>
		]
		this._pullCheck.clear()
		return this._followers[0] as RedioPipe<S>
	}

	spout(spout: Spout<T> | ErrorSpout<T>, options?: RedioOptions): RedioStream<T> {
		if (this._followers.length > 0) {
			throw new Error('Cannot consume a stream that already has a consumer. Use fork or observe.')
		}
		this._followers = [new RedioSink<T>(this, spout as ErrorSpout<T>, options)]
		this._pullCheck.clear()
		return this._followers[0] as RedioStream<T>
	}

	append(v: T | RedioEnd | Promise<T>, options?: RedioOptions): RedioPipe<T> {
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (this._debug) {
				console.log(`Append at end ${isEnd(t)} value ${t}`)
			}
			if (isEnd(t)) {
				return v
			} else {
				return t
			}
		}, options)
	}

	batch(n: Promise<number> | number, options?: RedioOptions): RedioPipe<Array<T>> {
		let batcher: Array<T> = []
		const num = isPromise(n) ? n : Promise.resolve(n)
		return this.valve<Array<T>>(async (t: T | RedioEnd) => {
			const maxLength = await num
			if (maxLength < 1) {
				throw new Error('Batch length must be greater than 0')
			}
			if (isEnd(t)) {
				return batcher.length === 0 ? end : batcher
			}
			batcher.push(t)
			if (batcher.length >= maxLength) {
				const singleBatch = batcher
				batcher = []
				return singleBatch
			} else {
				return nil
			}
		}, options)
	}

	collect(options?: RedioOptions): RedioPipe<Array<T>> {
		const result: Array<T> = []
		let ended = false
		const genny: Funnel<Array<T>> = () =>
			new Promise((resolve, reject) => {
				if (ended) resolve(end)
				this.spout((t: Liquid<T>) => {
					if (isEnd(t)) {
						resolve(result)
						ended = true
					} else if (isAnError(t)) {
						reject(t)
					} else {
						isValue(t) && result.push(t)
					}
				})
			})
		return redio(genny, options)
	}

	compact(options: RedioOptions): RedioPipe<T> {
		return this.valve((t: T | RedioEnd) => {
			if (isEnd(t)) {
				return end
			} else if (t) {
				return t
			} else {
				return nil
			}
		}, options)
	}

	consume<M>(
		f: (
			err: Error | null,
			x: T | RedioEnd | null,
			push: (m: Liquid<M>) => void,
			next: () => void
		) => Promise<void> | void,
		options?: RedioOptions
	): RedioPipe<M> {
		let genResolve:
			| ((v?: M | RedioEnd | RedioNil | PromiseLike<M> | undefined) => void)
			| null = null
		let genReject: ((reason?: any) => void) | null = null
		const pending: Array<Liquid<M>> = []
		const genny: Funnel<M> = () =>
			new Promise((resolve, reject) => {
				if (pending.length > 0) {
					const value = pending.shift()
					if (isAnError(value)) {
						reject(value)
					} else {
						resolve(value)
					}
					return
				}
				genResolve = (m?: M | RedioEnd | RedioNil | PromiseLike<M> | undefined) => {
					genResolve = null
					genReject = null
					resolve(m)
				}
				genReject = (reason?: any) => {
					genResolve = null
					genReject = null
					reject(reason)
				}
			})
		this.spout(
			(t: Liquid<T>) =>
				new Promise<void>((resolve, _reject) => {
					const push: (m: Liquid<M>) => void = (m: Liquid<M>) => {
						if (isAnError(m)) {
							if (genReject) {
								genReject(m)
							} else {
								pending.push(m)
							}
						} else {
							if (genResolve) {
								genResolve(m)
							} else {
								pending.push(m)
							}
						}
					}
					f((isAnError(t) && t) || null, ((isValue(t) || isEnd(t)) && t) || null, push, resolve)
				})
		)
		return redio(genny, options)
	}

	debounce(ms: Promise<number> | number, options?: RedioOptions): RedioPipe<T> {
		let timeout: NodeJS.Timeout | null
		let genResolve: (v?: Liquid<T> | PromiseLike<Liquid<T>> | undefined) => void
		let mostRecent: T | RedioNil = nil
		let ended = false
		function wait(t: number) {
			return new Promise((resolve) => {
				timeout = setTimeout(() => {
					resolve()
					timeout = null
				}, t)
			})
		}
		const num: Promise<number> = isAPromise(ms) ? ms : Promise.resolve(ms)
		const genny: Funnel<T> = () =>
			new Promise((resolve, _reject) => {
				if (ended) {
					resolve(end)
				} else {
					genResolve = resolve
				}
			})
		this.spout(async (t: T | RedioEnd) => {
			const w = await num
			if (isEnd(t)) {
				timeout && clearTimeout(timeout)
				genResolve(mostRecent)
				ended = true
				return
			}
			if (timeout) {
				clearTimeout(timeout)
			}
			wait(w).then(() => genResolve(t))
			mostRecent = t
		})
		return redio(genny, options)
	}

	doto(f: (t: T) => Promise<void> | void, _options?: RedioOptions): RedioPipe<T> {
		return this.valve(
			(t: Liquid<T>): Liquid<T> => {
				if (isValue(t)) {
					f(t)
				}
				return t
			}
		)
	}

	drop(num?: number | Promise<number>, options?: RedioOptions): RedioPipe<T> {
		if (typeof num === 'undefined') {
			num = 1
		}
		let count = 0
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (!isEnd(t) && num) {
				return count++ >= (await num) ? t : nil
			}
			return end
		}, options)
	}

	errors(f: (err: Error) => Promise<Liquid<T>> | Liquid<T>, options?: RedioOptions): RedioPipe<T> {
		if (options) {
			options.processError = true
		} else {
			options = { processError: true }
		}
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (isAnError(t)) {
				const result = await f(t)
				if (typeof result === 'undefined' || (typeof result === 'object' && result === null)) {
					return nil
				} else {
					return result
				}
			} else {
				return t
			}
		}, options)
	}

	filter(filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T> {
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (isValue(t)) {
				return (await filter(t)) ? t : nil
			}
			return end
		}, options)
	}

	find(_filter: (t: T) => Promise<boolean> | boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	findWhere(_props: Record<string, unknown>, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	group(_f: string | ((t: T) => unknown), _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	head(_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	intersperse<I>(_sep: Promise<I> | I, _options?: RedioOptions): RedioPipe<T | I> {
		throw new Error('Not implemented')
	}

	invoke<R>(_method: string, _args: Array<unknown>, _options?: RedioOptions): RedioPipe<R> {
		throw new Error('Not implemented')
	}

	last(_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	latest(_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	map<M>(
		mapper: (t: T) => M | Promise<M> | Array<M | RedioEnd> | Promise<Array<M | RedioEnd>>,
		options?: RedioOptions
	): RedioPipe<M> {
		return this.valve(async (t: Liquid<T>): Promise<LotsOfLiquid<M>> => {
			if (isValue(t)) {
				return mapper(t)
			}
			return end
		}, options)
	}

	pick(_properties: Array<string>, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	pickBy(_f: (key: string, value: unknown) => boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	pluck(_prop: string, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	ratelimit(_num: number, _ms: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	reduce<R>(_iterator: (a: R, b: T) => R, _init: R, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	reduce1<T>(_iterator: (a: T, b: T) => T, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	reject(_filter: (t: T) => Promise<boolean> | boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	scan<R>(_iterator: (a: R, b: T) => R, _init: R, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	scan1(_iterator: (a: T, b: T) => T, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	slice(_start: number, _end: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	sort(_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	sortBy(_f: (a: T, b: T) => number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	split(_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	splitBy(_sep: string | RegExp, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	stopOnError(_f: (err: Error) => void, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	take(num?: number | Promise<number>, options?: RedioOptions): RedioPipe<T> {
		let count = 0
		const tnum = num ? num : 1
		return this.valve(async (t: Liquid<T>): Promise<Liquid<T>> => {
			if (!isEnd(t)) {
				return count++ < (await tnum) ? t : nil
			}
			return end
		}, options)
	}

	tap(_f: (t: T) => Promise<void> | void, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	throttle(_ms: number, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	uniq(_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	uniqBy(_f: (a: T, b: T) => boolean, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	where(_props: Record<string, unknown>, _options?: RedioOptions): RedioPipe<T> {
		// Filter on object properties
		throw new Error('Not implemented')
	}

	// Higher order streams
	concat(_ys: RedioPipe<T> | Array<T>, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	flatFilter(_f: (t: T) => RedioPipe<boolean>, _options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	flatMap<M>(mapper: (t: T) => RedioPipe<M>, options?: RedioOptions): RedioPipe<M> {
		const localOptions = Object.assign(options || {}, { oneToMany: true } as RedioOptions)
		return this.valve(async (t: T | RedioEnd): Promise<LotsOfLiquid<M>> => {
			if (!isEnd(t)) {
				const values = await mapper(t).toArray()
				if (Array.length === 0) return nil
				return values
			}
			return end
		}, localOptions)
	}

	flatten<F>(_options?: RedioOptions): RedioPipe<F> {
		// where T === Liquid<F>
		throw new Error('Not implemented')
	}

	fork(options?: RedioOptions): RedioPipe<T> {
		const identity = new RedioMiddle<T, T>(this, (i: Liquid<T>) => i, options)
		this._followers.push(identity as RedioProducer<unknown>)
		return identity
	}

	merge<M>(_options?: RedioOptions): RedioPipe<M> {
		throw new Error('Not implemented')
	}

	observe(_options?: RedioOptions): RedioPipe<T> {
		throw new Error('Not implemented')
	}

	otherwise<O>(
		_ys: RedioPipe<O> | (() => RedioPipe<O>),
		_options?: RedioOptions
	): RedioPipe<T | O> {
		throw new Error('Not implemented')
	}

	parallel<P>(_n: number, _options?: RedioOptions): RedioPipe<P> {
		throw new Error('Not implemented')
	}

	sequence<S>(_options?: RedioOptions): RedioPipe<S> {
		throw new Error('Not implemented')
	}
	// sequence<S, T extends RedioPipe<S>>(_options?: RedioOptions): RedioPipe<S> {
	// 	let f: Funnel<S> = () => new Promise<LotsOfLiquid<S>>((resolve, reject) => {})
	// 	return redio(f)
	// }

	series<S>(_options?: RedioOptions): RedioPipe<S> {
		throw new Error('Not implemented')
	}

	zip<Z>(zs: RedioPipe<Z>, options?: RedioOptions): RedioPipe<[T?, Z?]> {
		let pendingT: T | RedioEnd | null = null
		let pendingZ: Z | RedioEnd | null = null
		let tResolver: (tz: Liquid<[T?, Z?]> | PromiseLike<Liquid<[T, Z]>> | undefined) => void
		let zResolver: (v: void | PromiseLike<void> | undefined) => void
		zs.spout((z: Z | RedioEnd) => {
			if (pendingZ === null) {
				pendingZ = z
			} else {
				if (isEnd(z) && isEnd(pendingZ)) {
					zResolver()
				} else {
					tResolver([undefined, <Z>pendingZ])
					pendingZ = z
					zResolver()
				}
			}
			return new Promise<void>((resolve) => {
				zResolver = resolve
				if (pendingT) {
					if (isEnd(pendingT) || isEnd(pendingZ)) {
						tResolver(end)
					} else {
						tResolver([pendingT as T, pendingZ as Z])
					}
					pendingT = null
					pendingZ = null
					zResolver()
				}
			})
		})

		return this.valve<[T?, Z?]>((t: T | RedioEnd): Promise<Liquid<[T?, Z?]>> => {
			return new Promise<Liquid<[T?, Z?]>>((resolve) => {
				tResolver = resolve
				if (pendingT === null) {
					pendingT = t
				} else {
					console.log('Here I am!')
					if (isEnd(t) && isEnd(pendingT)) {
						tResolver(nil)
					} else {
						tResolver([<T>pendingT, undefined])
						pendingT = t
					}
				}
				if (pendingZ) {
					if (isEnd(pendingT) || isEnd(pendingZ)) {
						tResolver(end)
					} else {
						tResolver([pendingT as T, pendingZ as Z])
					}
					pendingT = null
					pendingZ = null
					zResolver()
				}
			})
		}, options)
	}

	zipEach<Z>(_ys: RedioPipe<Z>[], _options?: RedioOptions): RedioPipe<[T, ...Z[]]> {
		throw new Error('Not implemented')
	}

	each(dotoall?: (t: T) => void | Promise<void>, options?: RedioOptions): RedioStream<T> {
		if (typeof dotoall === 'undefined') {
			dotoall = (/*t: T*/): void => {
				/* void */
			}
		}
		return this.spout(async (tt: Liquid<T>) => {
			if (isEnd(tt)) {
				if (options && options.debug) {
					console.log('Each: THE END')
				}
				return
			}
			if (isValue(tt) && dotoall) {
				await dotoall(tt)
			}
		}, options)
	}

	pipe(_stream: WritableStream<T>, _options?: RedioOptions): RedioStream<T> {
		throw new Error('Not implemented')
	}

	async toArray(options?: RedioOptions): Promise<Array<T>> {
		const result: Array<T> = []
		const promisedArray: Promise<Array<T>> = new Promise((resolve, reject) => {
			const sp = this.spout((tt: Liquid<T>) => {
				if (isEnd(tt)) {
					resolve(result)
				} else {
					isValue(tt) && result.push(tt)
				}
			}, options)
			sp.catch(reject)
			return sp
		})
		return promisedArray
	}

	toCallback(_f: (err: Error, value: T) => void): RedioStream<T> {
		// Just one value
		throw new Error('Not implemented')
	}

	toNodeStream(_streamOptions: Record<string, unknown>, _options?: RedioOptions): ReadableStream {
		throw new Error('Not implemented')
	}

	http(uri: string | URL, options?: RedioOptions): RedioStream<T> {
		if (typeof uri !== 'string') {
			uri = uri.toString()
		}
		return this.spout(httpSource<T>(uri, options))
	}

	get options(): RedioOptions {
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

	constructor(maker: Funnel<T>, options?: RedioOptions) {
		super(options)
		this._maker = maker
		process.nextTick(() => this.next())
	}

	async next(): Promise<void> {
		if (this._running) {
			try {
				const result = await this._maker()
				if (Array.isArray(result)) {
					if (this._oneToMany) {
						result.forEach((x) => isValue(x) && this.push(x))
					} else {
						// Odd situation where T is an Array<X>
						this.push((result as unknown) as T)
					}
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
export function isAPromise<T>(o: unknown): o is Promise<T> {
	return isPromise(o)
}

class RedioMiddle<S, T> extends RedioProducer<T> {
	private _middler: ErrorValve<S, T>
	private _ready = true
	private _prev: RedioProducer<S>

	constructor(prev: RedioProducer<S>, middler: ErrorValve<S, T>, options?: RedioOptions) {
		super(Object.assign(prev.options, { processError: false }, options))
		this._middler = (s: Liquid<S>): Promise<Liquid<T> | LotsOfLiquid<T>> =>
			new Promise<LotsOfLiquid<T>>((resolve, reject) => {
				this._ready = false
				let callIt = middler(s)
				if (isAnError(callIt)) {
					callIt = Promise.reject(callIt)
				}
				const promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
				promisy.then(
					(t: LotsOfLiquid<T>) => {
						this._ready = true
						resolve(t)
						if (this._debug) {
							console.log(`Fitting ${this._debug}: middler(${isEnd(s) ? 'THE END' : s}) = ${t}`)
						}
						// if (!isEnd(t)) {
						// 	this.next()
						// }
					},
					(err) => {
						this._ready = true
						reject(err)
						// this.next()
					}
				)
			})
		this._prev = prev
		process.nextTick(() => this.next())
	}

	async next(): Promise<void> {
		if (this._running && this._ready) {
			const v: Liquid<S> = this._prev.pull(this)
			if (this._debug) {
				console.log('Just called pull in valve. Fitting', this.fittingId, 'value', v)
			}
			if (isAnError(v) && !this._processError) {
				this.push(v)
				process.nextTick(() => this.next())
			} else if (!isNil(v)) {
				try {
					const result = await this._middler(v)
					if (Array.isArray(result)) {
						if (this._oneToMany) {
							result.forEach((x) => isValue(x) && this.push(x))
							if (result.some(isEnd)) {
								this.push(end)
							}
						} else {
							// Odd situation where T is an Array<X>
							this.push((result as unknown) as T)
						}
						if (isEnd(v) && result.length > 0 && !isEnd(result[result.length - 1])) {
							this.push(end)
						}
						// if (!isEnd(v) && result.length > 0 && isEnd(result[result.length - 1])) {
						// 	this.push(end)
						// }
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
	/**
	 *  Provide a callback function that is run when the stream has ended. The
	 *  function may be used to close any resources no longer reauired.
	 *  If more than one done function is provided, the latest one is called.
	 *  @param thatsAllFolks Function called at the end of the stream.
	 *  @returns This stream so that other end-stream behaviour can be specified.
	 */
	done(thatsAllFolks: () => void): RedioStream<T>
	/**
	 *  Function that is called with any unhandled errors that have caysed the
	 *  stream to end. If more than one catch function is provided, the latest one
	 *  is called.
	 *  @param errFn Funciion called with any unhandled error that has reached the
	 *               end of the stream.
	 *  @returns This stream so that other end-stream behaviour can be specified.
	 */
	catch(errFn: (err: Error) => void): RedioStream<T>
	/**
	 *  Register a single promise that resolves when the stream has
	 *  ended, returning the last value in the stream, or [[nil]] for an empty
	 *  stream. Only call this once per stream. Use [[each]] to process each
	 *  element of the stream.
	 *  @returns Promise that resolves to the last value in the stream.
	 */
	toPromise(): Promise<Liquid<T>>
}

class RedioSink<T> extends RedioFitting implements RedioStream<T> {
	private _sinker: ErrorSpout<T>
	private _prev: RedioProducer<T>
	private _ready = true
	private _debug: boolean
	private _rejectUnhandled = true
	private _thatsAllFolks: (() => void) | null = null
	private _errorFn: ((err: Error) => void) | null = null
	private _resolve: ((t: Liquid<T>) => void) | null = null
	private _reject: ((err: unknown) => void) | null = null
	private _last: Liquid<T> = nil

	constructor(prev: RedioProducer<T>, sinker: ErrorSpout<T>, options?: RedioOptions) {
		super()
		this._debug =
			options && Object.prototype.hasOwnProperty.call(options, 'debug')
				? (options.debug as boolean)
				: (prev.options.debug as boolean)
		this._rejectUnhandled =
			options && Object.prototype.hasOwnProperty.call(options, 'rejectUnhandled')
				? (options.rejectUnhandled as boolean)
				: (prev.options.rejectUnhandled as boolean)
		this._sinker = (t: Liquid<T>): Promise<void> =>
			new Promise<void>((resolve, reject) => {
				this._ready = false
				let callIt: void | Promise<void>
				if (isAnError(t)) {
					callIt = Promise.reject(t)
				} else {
					callIt = sinker(t)
				}
				const promisy: Promise<void> = isAPromise(callIt) ? callIt : Promise.resolve()
				promisy.then(
					async (_value: void): Promise<void> => {
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
					},
					(err?: unknown): void => {
						// this._ready = true
						reject(err as unknown | undefined)
					}
				)
			})
		this._prev = prev
		process.nextTick(() => this.next())
	}

	async next(): Promise<void> {
		if (this._ready) {
			const v: Liquid<T> = this._prev.pull(this)
			if (this._debug) {
				console.log('Just called pull in spout. Fitting', this.fittingId, 'value', v)
			}
			if (!isNil(v)) {
				try {
					await this._sinker(v)
				} catch (err) {
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
				}
			}
		}
	}

	done(thatsAllFolks: () => void): RedioStream<T> {
		this._thatsAllFolks = thatsAllFolks
		return this
	}

	catch(errFn: (err: Error) => void): RedioStream<T> {
		this._errorFn = errFn
		return this
	}

	toPromise(): Promise<Liquid<T>> {
		return new Promise<Liquid<T>>((resolve, reject) => {
			this._resolve = resolve
			this._reject = reject
		})
	}
}

function isReadableStream(x: any): x is Readable {
	return (
		x !== null &&
		typeof x === 'object' &&
		typeof x.pipe === 'function' &&
		x.readable !== false &&
		typeof x._read === 'function' &&
		typeof x._readableState === 'object'
	)
}

/**
 * Create a stream of values from an object that supports the [Javascript _Iterable
 * protocol_](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterable_protocol).
 * This includes the standard built-in types [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
 * and [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set).
 *
 * Note that as it is not possible to know reflectively whether a particular object implements
 * the [_Iterator protocol_](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterator_protocol),
 * create an Iterable object with an iterator function.
 * @param iterable Iterable object containing the values for the stream.
 * @param options  Optional configuration.
 * @returns Stream of values from the iterable provided.
 */
export default function redio<T>(iterable: Iterable<T>, options?: RedioOptions): RedioPipe<T>
/**
 *  Create a stream of values of type `T` using a lazy [[Generator]] function. A
 *  generator function receives callback functions `push` and `next` that it uses
 *  to create zero or more values to push onto the stream, possibly asynchronously.
 *  Next must be called to request that the function is called again.
 *  @param generator Generator function.
 *  @param options   Optional configuration.
 *  @return Stream of values _pushed_ by the generator.
 */
export default function redio<T>(generator: Generator<T>, options?: RedioOptions): RedioPipe<T>
/**
 * Create a stream from a [Node.js Readable stream](https://nodejs.org/docs/latest-v12.x/api/stream.html#stream_readable_streams).
 * Back pressure will be applied as required, slowing stream reading down to the acceptable
 * rate. Use the `chunkSize` options to requests a specific size of chunk and `encoding` to
 * specify a string encoding.
 * @param stream  Node.JS readable stream to turn into a redioactive stream.
 * @param options Optional configuration, including [[StreamOptions|stream details]].
 * @typeparam T   Normally a `Buffer` or a `string`, but could be `any` in object mode.
 * @return Stream of values created by consuming a Node.JS stream.
 */
export default function redio<T>(
	stream: Readable | ReadStream,
	options?: StreamOptions
): RedioPipe<T>
/**
 * Create a stream from a [Node.js event emitter](https://nodejs.org/docs/latest-v12.x/api/events.html)
 * for a specific event name. So that the stream can eventually end, either the event emitter stops
 * emitting events of the named type after an `end` event or that given by options `endEvent`.
 * @param emitter   Event emitter to use to create a stream from.
 * @param eventName Name of the events to listen for and push onto the stream.
 * @param options   Optional configuration, including [[EventOptions|event details]].
 * @typeparam T     Type of values emitted by the first emitted argument.
 * @return Stream of values created as events of the given name are omitted.
 */
export default function redio<T>(
	emitter: EventEmitter,
	eventName: string,
	options?: EventOptions
): RedioPipe<T>
/**
 *  Create a stream of values from the given array.
 *  @param data    Array of data to use to create a stream.
 *  @param options Optional configuration.
 *  @typeparam T   Type of values in the source array pushed onto the stream.
 *  @return Stream of values created from the array of data.
 */
export default function redio<T>(data: Array<T | RedioNil>, options?: RedioOptions): RedioPipe<T>
/**
 * Receive a stream of values of type `T` from another processing node over HTTP/S. This
 * is the partner to the [[RedioPipe.http]] method that creates such a stream. Back pressure
 * will be applied across the stream.
 * @param url     Depending on the kind of stream:
 *                * for PULL streams, a URL with protocol, hostname, port and stream
 *                  identifier root path
 *                * for PULL streams, the stream identifier root path (protocol set in options)
 * @param options Configuration with specific details of the HTTP connection.
 * @typeparam T   Type of values in the stream.
 * @return Stream of values received-as-pulled from the remote stream processor.
 */
export default function redio<T>(url: string, options?: HTTPOptions): RedioPipe<T>
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
export default function redio<T>(funnel: Funnel<T>, options?: RedioOptions): RedioPipe<T>
/** Implementation of the default stream generator function. Use an override. */
export default function redio<T>(
	args1: Funnel<T> | string | Array<T> | EventEmitter | Readable | Generator<T> | Iterable<T>,
	args2?: RedioOptions | StreamOptions | HTTPOptions | string,
	args3?: EventOptions
): RedioPipe<T> | null {
	if (typeof args1 === 'string') {
		// HTTP funnel
		return new RedioStart(
			httpTarget<T>(args1, args2 as HTTPOptions | undefined),
			args2 as RedioOptions
		)
	}
	if (typeof args1 === 'function') {
		if (args1.length === 0) {
			// Function is Funnel<T>
			return new RedioStart<T>(args1 as Funnel<T>, args2 as RedioOptions | undefined)
		}
		// Assume function is Generator<T>
		const funnelGenny: Funnel<T> = () =>
			new Promise<LotsOfLiquid<T>>((resolve, reject) => {
				const values: Array<Liquid<T>> = []
				const push = (t: LotsOfLiquid<T>): void => {
					if (Array.isArray(t)) {
						values.concat(t)
					} else {
						values.push(t)
					}
				}
				const next = (): void => {
					if (values.indexOf(end) >= 0) {
						resolve(end)
					} else {
						resolve(values)
					}
				}
				try {
					args1(push, next)
				} catch (err) {
					reject(err)
				}
			})
		const options = args2 ? (args2 as RedioOptions) : {}
		options.oneToMany = true
		return new RedioStart<T>(funnelGenny, options)
	}
	if (Array.isArray(args1)) {
		let index = 0
		const options: RedioOptions | undefined = args2 as RedioOptions | undefined
		return new RedioStart<T>(() => {
			if (options && options.debug) {
				console.log(
					`Generating index=${index} value=${index < args1.length ? args1[index] : 'THE END'}`
				)
			}
			if (index >= args1.length) {
				return end
			}
			return args1[index++]
		}, options)
	}
	if (typeof args1 === 'object' && typeof (args1 as any)[Symbol.iterator] === 'function') {
		const it: Iterator<T> = (args1 as any)[Symbol.iterator]()
		const options: RedioOptions | undefined = args2 as RedioOptions | undefined
		const itGenny: Funnel<T> = () =>
			new Promise<Liquid<T>>((resolve, reject) => {
				try {
					const nextThing = it.next()
					if (nextThing.done) {
						resolve(end)
					} else {
						resolve(nextThing.value ? nextThing.value : nil)
					}
				} catch (err) {
					reject(err)
				}
			})
		return new RedioStart<T>(itGenny, options)
	}
	if (isReadableStream(args1)) {
		const options: StreamOptions | undefined = args2 as StreamOptions | undefined
		let rejector: (reason?: any) => void = (err) => {
			console.error('Redioactive: unexpected stream error: ', err)
		}
		let ended = false
		args1.on('error', (err) => {
			rejector(err)
		})
		args1.on('end', () => {
			ended = true
		})
		args1.on('close', () => {
			ended = true
		})
		if (options && options.encoding) {
			args1.setEncoding(options.encoding)
		}
		const strGenny: Funnel<T> = () => {
			return new Promise<Liquid<T>>((resolve, reject) => {
				rejector = (err) => {
					reject(err)
				}
				const chunk = args1.read(options && options.chunkSize)
				if (chunk !== null) {
					resolve(chunk)
				} else {
					if (ended) {
						resolve(end)
						return
					}
					args1.once('readable', () => {
						const chunk = args1.read(options && options.chunkSize)
						if (chunk !== null) {
							resolve(chunk)
						} else {
							resolve(end)
						}
					})
				}
			})
		}
		return new RedioStart<T>(strGenny, options)
	}
	if (args1 instanceof EventEmitter) {
		const options: EventOptions | undefined = args3 as EventOptions | undefined
		const eventName = <string>args2
		const endName = (options && options.endEvent) || 'end'
		const errorName = (options && options.errorEvent) || 'error'
		let ended = false
		args1.on(endName, () => {
			ended = true
		})
		const funnel: Funnel<T> = () =>
			new Promise<T | RedioEnd>((resolve, reject) => {
				if (ended) {
					resolve(end)
					return
				}
				const resolver = (x: any) => {
					args1.removeListener(errorName, rejector)
					args1.removeListener(endName, ender)
					resolve(x)
				}
				const rejector = (err: any) => {
					args1.removeListener(eventName, resolver)
					args1.removeListener(endName, ender)
					reject(err)
				}
				const ender = () => {
					args1.removeListener(errorName, rejector)
					args1.removeListener(eventName, resolver)
					resolve(end)
				}
				args1.prependOnceListener(eventName, resolver)
				args1.once(errorName, rejector)
				args1.once(endName, ender)
			})
		return new RedioStart(funnel, options)
	}
	return null
}
