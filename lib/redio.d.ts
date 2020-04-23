/// <reference types="node" />
import { URL } from 'url';
/** Type of a value sent down a stream to indicate that it has ended. No values
 *  should follow.
 */
export declare type RedioEnd = {};
/** Constant value indicating the [[RedioEnd|end]] of a stream. */
export declare const end: RedioEnd;
/**
 *  Test that a value is the end of a stream.
 *  @param t Value to test.
 *  @return True is the value is the end of a stream.
 */
export declare function isEnd(t: any): t is RedioEnd;
/** Empty value. Nil values are sent down streams to indicate no value in the
 *  stream at this time. Nil values will be dropped at the earliest opportunity
 *  and should never be received at the end of a stream.
 *
 *  Nil values can be used in processing stages that consume more values than they
 *  produce.
 */
export declare type RedioNil = {};
/** Constant representing a [[RedioNil|nil]] value. */
export declare const nil: RedioNil;
/**
 *  Test a value to see if it is an [[RedioNil|empty value]].
 *  @param t Value to test.
 *  @return True if the value is the _nil_ empty value.
 */
export declare function isNil(t: any): t is RedioNil;
/**
 *  Test a value to see if it is an [[Error]].
 *  @param t Value to test.
 *  @return True if the value is an error.
 */
export declare function isAnError(t: any): t is Error;
/** Types of values that can flow down a stream. Values are either of the given
 *  type, the [[end]] or [[nil]].
 */
export declare type Liquid<T> = T | RedioEnd | RedioNil | Error;
/** A collection of values that can flow down a stream. This type is used
 *  when a processing stage produces more than it consumes, a _one-to-many_
 *  function, to represent a sequence of values to be flattenned into the stream.
 */
export declare type LotsOfLiquid<T> = Liquid<T> | Array<Liquid<T>>;
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
    (): Promise<LotsOfLiquid<T>> | LotsOfLiquid<T>;
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
    (s: Liquid<S>): Promise<LotsOfLiquid<T>> | LotsOfLiquid<T>;
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
    (t: Liquid<T>): Promise<void> | void;
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
    (push: (t: LotsOfLiquid<T>) => void, next: () => void): void;
}
/**
 *  Utility function to create literal values of stream items.
 *  @typeparam T Type of value to create.
 *  @param t Value describing the literal to create.
 *  @return Literal value.
 */
export declare function literal<T>(o: T): T;
/**
 *  Options that can be used to configure each stage of processing. The options
 *  implicitly pass onto the next processing stage unless explicitly overidden.
 *  For example, setting the `debug` flag to true on the first element will cause
 *  all subsequent stages of processing to generate debug unless subsequently
 *  set to false.
 */
export interface RedioOptions {
    /** Maximum number of stream items to buffer before pausing the producer. */
    bufferSizeMax?: number;
    /** Factor applied to `maxBufferSize` to apply to determine
     *  how many elements have to drain before the stream is
     *  restarted after pausing. For example, `drainFactor` is `0.7`, `bufferSizeMax`
     *  is `10`, processing is restarted when the buffer size has drained to a
     *  size of `7`.
     */
    drainFactor?: number;
    /** Set this flag to enerate debugging information for this. */
    debug?: boolean;
    /** Set this flag if the stage can produce arrays of output values
     *  ([[LotsOfLiquid]]) that should be flattenned.
     */
    oneToMany?: boolean;
    /** Set this flag to cause an [unhandled rejection](https://nodejs.org/api/process.html#process_event_unhandledrejection)
     *  at the end of the pipe. The default value is `true`. May cause the process
     *  to crash.
     */
    rejectUnhandled?: boolean;
    /** Set this flag to allow a valve to process an error. Defaults to `false` and
     *  must be set for each stage that it applies to.
     */
    processError?: boolean;
}
/** Generic properties of any stage in a pipeline. */
interface PipeFitting {
    /** Unique identifier within this Node instance for a stage in the pipeline. */
    readonly fittingId: number;
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
    valve<S>(valve: Valve<T, S>, options?: RedioOptions): RedioPipe<S>;
    /**
     *  Apply a [[Spout|spout]] function at the end of pipe.
     *  @param spout  Spout function to apply to each element.
     *  @returns A completed stream.
     */
    spout(spout: Spout<T>, options?: RedioOptions): RedioStream<T>;
    /**
     *  Append a value to the end of a stream.
     *      redio([1, 2, 3]).append(4) // => 1, 2, 3, 4
     *  @param v       Value to append to end of stream.
     *  @param options Optional configuration.
     *  @returns Pipe containing stream with the additional element.
     */
    append(v: Liquid<T>, options?: RedioOptions): RedioPipe<T>;
    batch(n: Promise<number> | number, options?: RedioOptions): RedioPipe<Array<T>>;
    collect(options?: RedioOptions): RedioPipe<Array<T>>;
    compact(options?: RedioOptions): RedioPipe<T>;
    consume<M>(f: (err: Error, x: T, push: (m: Liquid<M>) => void, next: () => void) => Promise<void> | void, options?: RedioOptions): RedioPipe<M>;
    debounce(ms: Promise<number> | number, options?: RedioOptions): RedioPipe<T>;
    doto(f: (t: T) => Promise<void> | void, options?: RedioOptions): RedioPipe<T>;
    /**
     *  Ignores the first `num` values of the stream and emits the rest.
     *  @param num     Number of values to drop from the source.
     *  @param options Optional configuration.
     *  @returns Pipe containing a stream of values with the first `num` values missing.
     */
    drop(num: Promise<number> | number, options?: RedioOptions): RedioPipe<T>;
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
    errors(f: (err: Error) => Promise<Liquid<T>> | Liquid<T>, options?: RedioOptions): RedioPipe<T>;
    /**
     *  Apply the given filter function to all the values in the stream, keeping
     *  those that pass the test.
     *  @param filter  Function returning true for values to keep.
     *  @param options Optional configuration.
     *  @returns Stream of values that pass the test.
     */
    filter(filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>;
    find(filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>;
    findWhere(props: object, options?: RedioOptions): RedioPipe<T>;
    group(f: string | ((t: T) => any), options?: RedioOptions): RedioPipe<T>;
    head(options?: RedioOptions): RedioPipe<T>;
    intersperse<I>(sep: Promise<I> | I, options?: RedioOptions): RedioPipe<T | I>;
    invoke<R>(method: string, args: Array<any>, options?: RedioOptions): RedioPipe<R>;
    last(options?: RedioOptions): RedioPipe<T>;
    latest(options?: RedioOptions): RedioPipe<T>;
    /**
     *  Transform a stream by applying the given `mapper` function to each element.
     *  @typeparam M Type of the values in the output stream.
     *  @param mapper  Function to transform each value.
     *  @param options Optional configuration.
     *  @returns Stream of transformed values.
     */
    map<M>(mapper: (t: T) => M | Promise<M>, options?: RedioOptions): RedioPipe<M>;
    pick(properties: Array<string>, options?: RedioOptions): RedioPipe<T>;
    pickBy(f: (key: string, value: any) => boolean, options?: RedioOptions): RedioPipe<T>;
    pluck(prop: string, options?: RedioOptions): RedioPipe<T>;
    ratelimit(num: number, ms: number, options?: RedioOptions): RedioPipe<T>;
    reduce<R>(iterator: (a: R, b: T) => R, init: R, options?: RedioOptions): RedioPipe<T>;
    reduce1<T>(iterator: (a: T, b: T) => T, options?: RedioOptions): RedioPipe<T>;
    reject(filter: (t: T) => Promise<boolean> | boolean, options?: RedioOptions): RedioPipe<T>;
    scan<R>(iterator: (a: R, b: T) => R, init: R, options?: RedioOptions): RedioPipe<T>;
    scan1(iterator: (a: T, b: T) => T, options?: RedioOptions): RedioPipe<T>;
    slice(start: number, end: number, options?: RedioOptions): RedioPipe<T>;
    sort(options?: RedioOptions): RedioPipe<T>;
    sortBy(f: (a: T, b: T) => number, options?: RedioOptions): RedioPipe<T>;
    split(options?: RedioOptions): RedioPipe<T>;
    splitBy(sep: string | RegExp, options?: RedioOptions): RedioPipe<T>;
    stopOnError(f: (err: Error) => void, options?: RedioOptions): RedioPipe<T>;
    /**
     *  Take the first `num` elements from the stream, drop the rest.
     *  @param num     Number of elements to include from the start of the stream.
     *  @param options Optional configuration.
     *  @returns Stream containing only the first `num` elements from the source.
     */
    take(num: Promise<number> | number, options?: RedioOptions): RedioPipe<T>;
    tap(f: (t: T) => Promise<void> | void, options?: RedioOptions): RedioPipe<T>;
    throttle(ms: number, options?: RedioOptions): RedioPipe<T>;
    uniq(options?: RedioOptions): RedioPipe<T>;
    uniqBy(f: (a: T, b: T) => boolean, options?: RedioOptions): RedioPipe<T>;
    where(props: object, options?: RedioOptions): RedioPipe<T>;
    concat(ys: RedioPipe<T> | Array<T>, options?: RedioOptions): RedioPipe<T>;
    flatFilter(f: (t: T) => RedioPipe<boolean>, options?: RedioOptions): RedioPipe<T>;
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
    flatMap<M>(f: (t: T | RedioEnd) => RedioPipe<M>, options?: RedioOptions): RedioPipe<M>;
    flatten<F>(options?: RedioOptions): RedioPipe<F>;
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
    fork(options?: RedioOptions): RedioPipe<T>;
    merge<M>(options?: RedioOptions): RedioPipe<M>;
    observe(options?: RedioOptions): RedioPipe<T>;
    otherwise<O>(ys: RedioPipe<O> | (() => RedioPipe<O>), options?: RedioOptions): RedioPipe<T | O>;
    parallel<P>(n: number, options?: RedioOptions): RedioPipe<P>;
    sequence<S>(options?: RedioOptions): RedioPipe<S>;
    series<S>(options?: RedioOptions): RedioPipe<S>;
    zip<Z>(ys: RedioPipe<Z> | Array<Z>, options?: RedioOptions): RedioPipe<[T, Z]>;
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
    each(dotoall?: (t: T) => void | Promise<void>, options?: RedioOptions): RedioStream<T>;
    pipe(dest: WritableStream<T>, streamOptions: object, options?: RedioOptions): RedioStream<T>;
    /**
     *  Consume the stream by writing each value into an array, the resolving
     *  to that array.
     *  @param options Optional configuration.
     *  @returns Promise to create an array containing the final values of the stream.
     */
    toArray(options?: RedioOptions): Promise<Array<T>>;
    toCallback(f: (err: Error, value: T) => void): RedioStream<T>;
    toNodeStream(streamOptions: object, options?: RedioOptions): ReadableStream;
    http(uri: string | URL, options?: HTTPOptions): RedioStream<T>;
}
/**
 *  Tests of the given value is a promise, in any state.
 *  @param o Value to test.
 *  @typeparam T Optional type that the promise resolves to.
 *  @return Value is a promise?
 */
export declare function isAPromise<T>(o: any): o is Promise<T>;
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
    done(thatsAllFolks: () => void): RedioStream<T>;
    /**
     *  Function that is called with any unhandled errors that have caysed the
     *  stream to end. If more than one catch function is provided, the latest one
     *  is called.
     *  @param errFn Funciion called with any unhandled error that has reached the
     *               end of the stream.
     *  @returns This stream so that other end-stream behaviour can be specified.
     */
    catch(errFn: (err: Error) => void): RedioStream<T>;
    /**
     *  Register a single promise that resolves when the stream has
     *  ended, returning the last value in the stream, or [[nil]] for an empty
     *  stream. Only call this once per stream. Use [[each]] to process each
     *  element of the stream.
     *  @returns Promise that resolves to the last value in the stream.
     */
    toPromise(): Promise<Liquid<T>>;
}
/**
 *  Create a stream of values of type `T` using a lazy [[Generator]] function. A
 *  generator function receives callback functions `push` and `next` that it uses
 *  to create zero or more values to push onto the stream, possibly asynchronously.
 *  Next must be called to request that the function is called again.
 *  @param generator Generator function.
 *  @param options   Optional configuration.
 *  @return Stream of values _pushed_ by the generator.
 */
export default function <T>(generator: Generator<T>, options?: RedioOptions): RedioPipe<T>;
/**
 *  Create a stream of values from the given array.
 *  @param data    Array of data to use to create a stream.
 *  @param options Optional configuration.
 *  @typeparam T   Type of values in the source array pushed onto the stream.
 *  @return Stream of values created from the array of data.
 */
export default function <T>(data: Array<T>, options?: RedioOptions): RedioPipe<T>;
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
export default function <T>(funnel: Funnel<T>, options?: RedioOptions): RedioPipe<T>;
export {};
