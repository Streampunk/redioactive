"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 *  Redioactive is a reactive streams library for Node.js, designed to work
 *  with native promises and typescript types. The motivation for its development
 *  is for the processing of media streams at or faster than real time on non-real
 *  time computer systems.
 *  Designed for the _async/await with typescript generation_, this library is
 *  inspired by Highland.js and adds support for configurable buffers at each stage.
 */
const util_1 = require("util");
const { isPromise } = util_1.types;
/** Constant value indicating the [[RedioEnd|end]] of a stream. */
exports.end = {};
/**
 *  Test that a value is the end of a stream.
 *  @param t Value to test.
 *  @return True is the value is the end of a stream.
 */
function isEnd(t) {
    return t === exports.end;
}
exports.isEnd = isEnd;
/** Constant representing a [[RedioNil|nil]] value. */
exports.nil = {};
/**
 *  Test a value to see if it is an [[RedioNil|empty value]].
 *  @param t Value to test.
 *  @return True if the value is the _nil_ empty value.
 */
function isNil(t) {
    return t === exports.nil;
}
exports.isNil = isNil;
/**
 *  Test a value to see if it is an [[Error]].
 *  @param t Value to test.
 *  @return True if the value is an error.
 */
function isAnError(t) {
    return util_1.types.isNativeError(t);
}
exports.isAnError = isAnError;
/**
 *  Utility function to create literal values of stream items.
 *  @typeparam T Type of value to create.
 *  @param t Value describing the literal to create.
 *  @return Literal value.
 */
function literal(o) {
    return o;
}
exports.literal = literal;
class RedioFitting {
    constructor() {
        this.fittingId = RedioFitting.counter++;
    }
}
RedioFitting.counter = 0;
class RedioProducer extends RedioFitting {
    constructor(options) {
        super();
        this._followers = [];
        this._pullCheck = new Set();
        this._buffer = [];
        this._running = true;
        this._bufferSizeMax = 10;
        this._drainFactor = 0.7;
        this._debug = false;
        this._oneToMany = false;
        this._rejectUnhandled = true;
        this._processError = false;
        this._paused = false; // Pausing stop pushing until all followers pull
        if (options) {
            if (typeof options.bufferSizeMax === 'number' && options.bufferSizeMax > 0) {
                this._bufferSizeMax = options.bufferSizeMax;
            }
            if (typeof options.drainFactor === 'number' &&
                options.drainFactor >= 0.0 &&
                options.drainFactor <= 1.0) {
                this._drainFactor = options.drainFactor;
            }
            if (typeof options.debug === 'boolean') {
                this._debug = options.debug;
            }
            if (options && Object.prototype.hasOwnProperty.call(options, 'oneToMany')) {
                this._oneToMany = options.oneToMany;
            }
            if (options && Object.prototype.hasOwnProperty.call(options, 'rejectUnhandled')) {
                this._rejectUnhandled = options.rejectUnhandled;
            }
            if (options && Object.prototype.hasOwnProperty.call(options, 'processError')) {
                this._processError = options.processError;
            }
        }
    }
    push(x) {
        this._buffer.push(x);
        if (this._debug) {
            console.log(`Push in fitting ${this.fittingId}: buffer now length=${this._buffer.length} value=${x}`);
        }
        if (this._buffer.length >= this._bufferSizeMax)
            this._running = false;
        if (!this._paused) {
            this._followers.forEach((follower) => follower.next());
        }
    }
    pull(puller) {
        const provideVal = !this._pullCheck.has(puller.fittingId);
        if (!provideVal) {
            if (this._debug) {
                console.log(`Pausing on pull in fitting ${this.fittingId} with ${this._followers.length}. Repeated pulls from ${puller.fittingId}.`);
            }
            this._paused = true;
        }
        this._pullCheck.add(puller.fittingId);
        if (this._debug) {
            console.log(`Received pull at fitting source ${this.fittingId} to destination ${puller.fittingId} with count ${this._pullCheck.size} / ${this._followers.length}`);
        }
        let val;
        if (this._pullCheck.size === this._followers.length) {
            val = this._buffer.shift();
            this._pullCheck.clear();
            if (!this._running && this._buffer.length < this._drainFactor * this._bufferSizeMax) {
                this._running = true;
                process.nextTick(() => this.next());
            }
            if (this._paused) {
                if (this._debug) {
                    console.log(`Resuming in pull for fitting ${this.fittingId}.`);
                }
                this._paused = false;
                this._followers.forEach((follower) => follower.next());
            }
        }
        else {
            val = provideVal ? this._buffer[0] : undefined;
        }
        return val !== undefined ? val : null;
    }
    next() {
        return Promise.resolve();
    }
    valve(valve, options) {
        if (this._followers.length > 0) {
            throw new Error('Cannot consume a stream that already has a consumer. Use fork or observe.');
        }
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this._followers = [new RedioMiddle(this, valve, options)];
        this._pullCheck.clear();
        return this._followers[0];
    }
    spout(spout, options) {
        if (this._followers.length > 0) {
            throw new Error('Cannot consume a stream that already has a consumer. Use fork or observe.');
        }
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this._followers = [new RedioSink(this, spout, options)];
        this._pullCheck.clear();
        return this._followers[0];
    }
    append(v, options) {
        return this.valve(async (t) => {
            if (this._debug) {
                console.log(`Append at end ${isEnd(t)} value ${t}`);
            }
            if (isEnd(t)) {
                return v;
            }
            else {
                return t;
            }
        }, options);
    }
    batch(_n, _options) {
        throw new Error('Not implemented');
    }
    collect(_options) {
        throw new Error('Not implemented');
    }
    compact(_options) {
        throw new Error('Not implemented');
    }
    consume(_f, _options) {
        throw new Error('Not implemented');
    }
    debounce(_ms, _options) {
        throw new Error('Not implemented');
    }
    doto(f, _options) {
        return this.valve((t) => {
            if (!isEnd(t)) {
                f(t);
            }
            return t;
        });
    }
    drop(num, options) {
        let count = 0;
        return this.valve(async (t) => {
            if (!isEnd(t)) {
                return count++ >= (await num) ? t : exports.nil;
            }
            return exports.end;
        }, options);
    }
    errors(f, options) {
        if (options) {
            options.processError = true;
        }
        else {
            options = { processError: true };
        }
        return this.valve(async (t) => {
            if (isAnError(t)) {
                const result = await f(t);
                if (typeof result === 'undefined' || (typeof result === 'object' && result === null)) {
                    return exports.nil;
                }
                else {
                    return result;
                }
            }
            else {
                return t;
            }
        }, options);
    }
    filter(filter, options) {
        return this.valve(async (t) => {
            if (!isEnd(t)) {
                return (await filter(t)) ? t : exports.nil;
            }
            return exports.end;
        }, options);
    }
    find(_filter, _options) {
        throw new Error('Not implemented');
    }
    findWhere(_props, _options) {
        throw new Error('Not implemented');
    }
    group(_f, _options) {
        throw new Error('Not implemented');
    }
    head(_options) {
        throw new Error('Not implemented');
    }
    intersperse(_sep, _options) {
        throw new Error('Not implemented');
    }
    invoke(_method, _args, _options) {
        throw new Error('Not implemented');
    }
    last(_options) {
        throw new Error('Not implemented');
    }
    latest(_options) {
        throw new Error('Not implemented');
    }
    map(mapper, options) {
        return this.valve(async (t) => {
            if (!isEnd(t))
                return mapper(t);
            return exports.end;
        }, options);
    }
    pick(_properties, _options) {
        throw new Error('Not implemented');
    }
    pickBy(_f, _options) {
        throw new Error('Not implemented');
    }
    pluck(_prop, _options) {
        throw new Error('Not implemented');
    }
    ratelimit(_num, _ms, _options) {
        throw new Error('Not implemented');
    }
    reduce(_iterator, _init, _options) {
        throw new Error('Not implemented');
    }
    reduce1(_iterator, _options) {
        throw new Error('Not implemented');
    }
    reject(_filter, _options) {
        throw new Error('Not implemented');
    }
    scan(_iterator, _init, _options) {
        throw new Error('Not implemented');
    }
    scan1(_iterator, _options) {
        throw new Error('Not implemented');
    }
    slice(_start, _end, _options) {
        throw new Error('Not implemented');
    }
    sort(_options) {
        throw new Error('Not implemented');
    }
    sortBy(_f, _options) {
        throw new Error('Not implemented');
    }
    split(_options) {
        throw new Error('Not implemented');
    }
    splitBy(_sep, _options) {
        throw new Error('Not implemented');
    }
    stopOnError(_f, _options) {
        throw new Error('Not implemented');
    }
    take(num, options) {
        let count = 0;
        return this.valve(async (t) => {
            if (!isEnd(t)) {
                return count++ < (await num) ? t : exports.nil;
            }
            return exports.end;
        }, options);
    }
    tap(_f, _options) {
        throw new Error('Not implemented');
    }
    throttle(_ms, _options) {
        throw new Error('Not implemented');
    }
    uniq(_options) {
        throw new Error('Not implemented');
    }
    uniqBy(_f, _options) {
        throw new Error('Not implemented');
    }
    where(_props, _options) {
        // Filter on object properties
        throw new Error('Not implemented');
    }
    // Higher order streams
    concat(_ys, _options) {
        throw new Error('Not implemented');
    }
    flatFilter(_f, _options) {
        throw new Error('Not implemented');
    }
    flatMap(mapper, options) {
        const localOptions = Object.assign(options, { oneToMany: true });
        return this.valve(async (t) => {
            if (!isEnd(t)) {
                const values = await mapper(t).toArray();
                if (Array.length === 0)
                    return exports.nil;
                return values;
            }
            return exports.end;
        }, localOptions);
    }
    flatten(_options) {
        // where T === Liquid<F>
        throw new Error('Not implemented');
    }
    fork(options) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const identity = new RedioMiddle(this, (i) => i, options);
        this._followers.push(identity);
        return identity;
    }
    merge(_options) {
        throw new Error('Not implemented');
    }
    observe(_options) {
        throw new Error('Not implemented');
    }
    otherwise(_ys, _options) {
        throw new Error('Not implemented');
    }
    parallel(_n, _options) {
        throw new Error('Not implemented');
    }
    sequence(_options) {
        throw new Error('Not implemented');
    }
    series(_options) {
        throw new Error('Not implemented');
    }
    zip(_ys, _options) {
        throw new Error('Not implemented');
    }
    each(dotoall, options) {
        if (dotoall === undefined) {
            dotoall = ( /*t: T*/) => {
                /* void */
            };
        }
        return this.spout(async (tt) => {
            if (isEnd(tt)) {
                if (options && options.debug) {
                    console.log('Each: THE END');
                }
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await dotoall(tt);
        }, options);
    }
    pipe(_stream, _options) {
        throw new Error('Not implemented');
    }
    async toArray(options) {
        const result = [];
        const promisedArray = new Promise((resolve, _reject) => {
            this.spout((tt) => {
                if (isEnd(tt)) {
                    resolve(result);
                }
                else {
                    result.push(tt);
                }
            }, options);
        });
        return promisedArray;
    }
    toCallback(_f) {
        // Just one value
        throw new Error('Not implemented');
    }
    toNodeStream(_streamOptions, _options) {
        throw new Error('Not implemented');
    }
    http(_uri, _options) {
        throw new Error('Not implemented');
    }
    get options() {
        return literal({
            bufferSizeMax: this._bufferSizeMax,
            drainFactor: this._drainFactor,
            debug: this._debug,
            rejectUnhandled: this._rejectUnhandled,
            processError: this._processError
        });
    }
}
class RedioStart extends RedioProducer {
    constructor(maker, options) {
        super(options);
        this._maker = maker;
        process.nextTick(() => this.next());
    }
    async next() {
        if (this._running) {
            try {
                const result = await this._maker();
                if (this._oneToMany && Array.isArray(result)) {
                    result.forEach((x) => this.push(x));
                }
                else if (isNil(result)) {
                    // Don't push
                }
                else {
                    this.push(result);
                }
                if (result !== exports.end && !(Array.isArray(result) && result.some(isEnd))) {
                    process.nextTick(() => this.next());
                }
            }
            catch (err) {
                this.push(err);
                process.nextTick(() => this.next());
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
function isAPromise(o) {
    return isPromise(o);
}
exports.isAPromise = isAPromise;
class RedioMiddle extends RedioProducer {
    constructor(prev, middler, options) {
        super(Object.assign(prev.options, { processError: false }, options));
        this._ready = true;
        this._middler = (s) => new Promise((resolve, reject) => {
            this._ready = false;
            let callIt = middler(s);
            if (isAnError(callIt)) {
                callIt = Promise.reject(callIt);
            }
            const promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt);
            promisy.then((t) => {
                this._ready = true;
                resolve(t);
                if (this._debug) {
                    console.log(`Fitting ${this._debug}: middler(${isEnd(s) ? 'THE END' : s}) = ${t}`);
                }
                // if (!isEnd(t)) {
                // 	this.next()
                // }
            }, (err) => {
                this._ready = true;
                reject(err);
                // this.next()
            });
        });
        this._prev = prev;
    }
    async next() {
        if (this._running && this._ready) {
            const v = this._prev.pull(this);
            if (this._debug) {
                console.log('Just called pull in value. Fitting', this.fittingId, 'value', v);
            }
            if (isAnError(v) && !this._processError) {
                this.push(v);
                process.nextTick(() => this.next());
            }
            else if (v !== null) {
                try {
                    const result = await this._middler(v);
                    if (this._oneToMany && Array.isArray(result)) {
                        result.forEach((x) => this.push(x));
                        if (isEnd(v) && result.length > 0 && !isEnd(result[result.length - 1])) {
                            this.push(exports.end);
                        }
                    }
                    else if (isNil(result)) {
                        // Don't push
                        if (isEnd(v)) {
                            this.push(exports.end);
                        }
                    }
                    else {
                        this.push(result);
                        if (isEnd(v) && !isEnd(result)) {
                            this.push(exports.end);
                        }
                    }
                }
                catch (err) {
                    this.push(err);
                }
                finally {
                    if (this._debug) {
                        console.log('About to call next in', this.fittingId);
                    }
                    this.next();
                    // process.nextTick(() => this.next())
                }
            }
        }
    }
}
class RedioSink extends RedioFitting {
    constructor(prev, sinker, options) {
        super();
        this._ready = true;
        this._rejectUnhandled = true;
        this._thatsAllFolks = null;
        this._errorFn = null;
        this._resolve = null;
        this._reject = null;
        this._last = exports.nil;
        this._debug =
            options && Object.prototype.hasOwnProperty.call(options, 'debug')
                ? options.debug
                : prev.options.debug;
        this._rejectUnhandled =
            options && Object.prototype.hasOwnProperty.call(options, 'rejectUnhandled')
                ? options.rejectUnhandled
                : prev.options.rejectUnhandled;
        this._sinker = (t) => new Promise((resolve, reject) => {
            this._ready = false;
            let callIt;
            if (isAnError(t)) {
                callIt = Promise.reject(t);
            }
            else {
                callIt = sinker(t);
            }
            const promisy = isAPromise(callIt) ? callIt : Promise.resolve();
            promisy.then(async (_value) => {
                this._ready = true;
                resolve();
                if (!isEnd(t)) {
                    process.nextTick(() => this.next());
                }
                else {
                    if (this._thatsAllFolks) {
                        this._thatsAllFolks();
                    }
                    if (this._resolve) {
                        this._resolve(this._last);
                    }
                }
                this._last = t;
                return Promise.resolve();
            }, (err) => {
                // this._ready = true
                reject(err);
            });
        });
        this._prev = prev;
    }
    next() {
        if (this._ready) {
            const v = this._prev.pull(this);
            if (this._debug) {
                console.log('Just called pull in spout. Fitting', this.fittingId, 'value', v);
            }
            if (v !== null) {
                this._sinker(v).catch((err) => {
                    let handled = false;
                    if (this._errorFn) {
                        handled = true;
                        this._errorFn(err);
                    }
                    if (this._reject) {
                        handled = true;
                        this._reject(err);
                    }
                    if (!handled) {
                        if (this._debug || !this._rejectUnhandled) {
                            console.log(`Error: Unhandled error at end of chain: ${err.message}`);
                        }
                        // Will be unhandled - thrown into asynchronous nowhere
                        if (this._rejectUnhandled) {
                            console.log('Here we go!!!', this._rejectUnhandled);
                            throw err;
                        }
                    }
                });
            }
        }
    }
    done(thatsAllFolks) {
        this._thatsAllFolks = thatsAllFolks;
        return this;
    }
    catch(errFn) {
        this._errorFn = errFn;
        return this;
    }
    toPromise() {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
}
/** Implementation of the default stream generator function. Use an override. */
function default_1(args1, args2, _args3) {
    if (typeof args1 === 'function') {
        if (args1.length === 0) {
            // Function is Funnel<T>
            return new RedioStart(args1, args2);
        }
        // Assume function is Generator<T>
        const funnelGenny = () => new Promise((resolve, reject) => {
            const values = [];
            const push = (t) => {
                if (Array.isArray(t)) {
                    values.concat(t);
                }
                else {
                    values.push(t);
                }
            };
            const next = () => {
                resolve(values);
            };
            try {
                args1(push, next);
            }
            catch (err) {
                reject(err);
            }
        });
        const options = args2 ? args2 : {};
        options.oneToMany = true;
        return new RedioStart(funnelGenny, options);
    }
    if (Array.isArray(args1)) {
        let index = 0;
        const options = args2;
        return new RedioStart(() => {
            if (options && options.debug) {
                console.log(`Generating index=${index} value=${index < args1.length ? args1[index] : 'THE END'}`);
            }
            if (index >= args1.length) {
                return exports.end;
            }
            return args1[index++];
        }, options);
    }
    return null;
}
exports.default = default_1;
