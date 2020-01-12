"use strict";
/**
 *  Redioactive is a reactive streams library for Node.js, designed to work
 *  with native promises and typescript types. The motivation for its development
 *  is for the processing of media streams at or faster than real time on non-real
 *  time computer systems.
 *  Designed for the _async/await with typescript generation_, this library is
 *  inspired by Highland.js and adds support for configurable buffers at each stage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
class RedioProducer {
    constructor(options) {
        this._follow = null;
        this._buffer = [];
        this._running = true;
        this._bufferSizeMax = 10;
        this._drainFactor = 0.7;
        this._debug = false;
        this._oneToMany = false;
        this._rejectUnhandled = true;
        this._processError = false;
        if (options) {
            if (typeof options.bufferSizeMax === 'number' && options.bufferSizeMax > 0) {
                this._bufferSizeMax = options.bufferSizeMax;
            }
            if (typeof options.drainFactor === 'number' && options.drainFactor >= 0.0 && options.drainFactor <= 1.0) {
                this._drainFactor = options.drainFactor;
            }
            if (typeof options.debug === 'boolean') {
                this._debug = options.debug;
            }
            if (options && options.hasOwnProperty('oneToMany')) {
                this._oneToMany = options.oneToMany;
            }
            if (options && options.hasOwnProperty('rejectUnhandled')) {
                this._rejectUnhandled = options.rejectUnhandled;
            }
            if (options && options.hasOwnProperty('processError')) {
                this._processError = options.processError;
            }
        }
    }
    push(x) {
        this._buffer.push(x);
        if (this._debug) {
            console.log(`Push: buffer now length=${this._buffer.length} value=${x}`);
        }
        if (this._buffer.length >= this._bufferSizeMax)
            this._running = false;
        if (this._follow)
            this._follow.next();
    }
    pull() {
        let val = this._buffer.shift();
        if (!this._running && this._buffer.length < this._drainFactor * this._bufferSizeMax) {
            this._running = true;
            this.next();
        }
        return val ? val : null;
    }
    next() { return Promise.resolve(); }
    valve(valve, options) {
        this._follow = new RedioMiddle(this, valve, options);
        return this._follow;
    }
    spout(spout, options) {
        this._follow = new RedioSink(this, spout, options);
        return this._follow;
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
    doto(_f, _options) {
        throw new Error('Not implemented');
    }
    drop(num, options) {
        let count = 0;
        return this.valve(async (t) => {
            if (!isEnd(t)) {
                return count++ >= await num ? t : exports.nil;
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
                let result = await f(t);
                if (typeof result === 'undefined' || typeof result === null) {
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
                return count++ < await num ? t : exports.nil;
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
        let localOptions = Object.assign(options, { oneToMany: true });
        return this.valve(async (t) => {
            if (!isEnd(t)) {
                let values = await mapper(t).toArray();
                if (Array.length === 0)
                    return exports.nil;
                return values;
            }
            return exports.end;
        }, localOptions);
    }
    flatten(_options) {
        throw new Error('Not implemented');
    }
    fork(_options) {
        throw new Error('Not implemented');
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
        return this.spout((tt) => {
            if (isEnd(tt)) {
                if (options && options.debug) {
                    console.log('Each: THE END');
                }
                return;
            }
            dotoall(tt);
        }, options);
    }
    pipe(_stream, _options) {
        throw new Error('Not implemented');
    }
    async toArray(options) {
        let result = [];
        let promisedArray = new Promise((resolve, _reject) => {
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
        this.next();
    }
    async next() {
        if (this._running) {
            try {
                let result = await this._maker();
                if (this._oneToMany && Array.isArray(result)) {
                    result.forEach(x => this.push(x));
                }
                else if (isNil(result)) {
                    // Don't push
                }
                else {
                    this.push(result);
                }
                if (result !== exports.end && !(Array.isArray(result) && result.some(isEnd))) {
                    this.next();
                }
            }
            catch (err) {
                this.push(err);
                this.next();
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
            let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt);
            promisy.then((t) => {
                this._ready = true;
                resolve(t);
                if (this._debug) {
                    console.log(`middler(${isEnd(s) ? 'THE END' : s}) = ${t}`);
                }
                // if (!isEnd(t)) {
                // 	this.next()
                // }
            }, err => {
                this._ready = true;
                reject(err);
                // this.next()
            });
        });
        this._prev = prev;
    }
    async next() {
        if (this._running && this._ready) {
            let v = this._prev.pull();
            if (isAnError(v) && !this._processError) {
                this.push(v);
                this.next();
            }
            else if (v !== null) {
                try {
                    let result = await this._middler(v);
                    if (this._oneToMany && Array.isArray(result)) {
                        result.forEach(x => this.push(x));
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
                    this.next();
                }
            }
        }
    }
}
class RedioSink {
    constructor(prev, sinker, options) {
        this._ready = true;
        this._rejectUnhandled = true;
        this._thatsAllFolks = null;
        this._errorFn = null;
        this._debug = options && options.hasOwnProperty('debug') ? options.debug : prev.options.debug;
        this._rejectUnhandled = options && options.hasOwnProperty('rejectUnhandled') ? options.rejectUnhandled : prev.options.rejectUnhandled;
        this._sinker = (t) => new Promise((resolve, reject) => {
            this._ready = false;
            let callIt;
            if (isAnError(t)) {
                callIt = Promise.reject(t);
            }
            else {
                callIt = sinker(t);
            }
            let promisy = isAPromise(callIt) ? callIt : Promise.resolve();
            promisy.then((_value) => {
                this._ready = true;
                resolve();
                if (!isEnd(t)) {
                    this.next();
                }
                else if (this._thatsAllFolks) {
                    this._thatsAllFolks();
                }
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
            let v = this._prev.pull();
            if (v !== null) {
                this._sinker(v).catch(err => {
                    if (this._errorFn) {
                        this._errorFn(err);
                    }
                    else {
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
}
function default_1(args1, args2, _args3) {
    if (typeof args1 === 'function') {
        if (args1.length === 0) { // Function is Funnel<T>
            return new RedioStart(args1, args2);
        }
        // Assume function is Generator<T>
        let funnelGenny = () => new Promise((resolve, reject) => {
            let values = [];
            let push = (t) => {
                if (Array.isArray(t)) {
                    values.concat(t);
                }
                else {
                    values.push(t);
                }
            };
            let next = () => {
                resolve(values);
            };
            try {
                args1(push, next);
            }
            catch (err) {
                reject(err);
            }
        });
        let options = args2 ? args2 : {};
        options.oneToMany = true;
        return new RedioStart(funnelGenny, options);
    }
    if (Array.isArray(args1)) {
        let index = 0;
        let options = args2;
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
//# sourceMappingURL=redio.js.map