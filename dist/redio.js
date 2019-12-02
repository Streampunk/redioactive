"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const { isPromise } = util_1.types;
exports.end = {};
function isEnd(t) {
    return t === exports.end;
}
exports.isEnd = isEnd;
function literal(o) {
    return o;
}
exports.literal = literal;
class RedioPipe {
    constructor(options) {
        this._follow = null;
        this._buffer = [];
        this._running = true;
        this._bufferSizeMax = 10;
        this._drainFactor = 0.7;
        this._debug = false;
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
        }
    }
    push(x) {
        this._buffer.push(x);
        if (this._debug) {
            console.log(`Push: new buffer length=${this._buffer.length} value=${x}`);
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
    append(v, options) {
        return new RedioMiddle(this, (t) => {
            if (this._debug) {
                console.log(`Append at end ${isEnd(t)} value ${t}`);
            }
            if (isEnd(t)) {
                return v;
            }
            return t;
        }, options);
    }
    map(mapper, _options) {
        let redm = new RedioMiddle(this, mapper);
        return redm;
    }
    filter(_filter, _options) {
        throw new Error('Not implemented');
    }
    flatMap(_mapper, _options) {
        throw new Error('Not implemented');
    }
    drop(_count, _options) {
        throw new Error('Not implemented');
    }
    take(_count, _options) {
        throw new Error('Not implemented');
    }
    observe(_options) {
        throw new Error('Not implemented');
    }
    split(_options) {
        throw new Error('Not implemented');
    }
    valve(valve) {
        this._follow = new RedioMiddle(this, valve);
        return this._follow;
    }
    spout(spout, options) {
        this._follow = new RedioSink(this, spout, options);
        return this._follow;
    }
    each(dotoall, options) {
        return this.spout((tt) => {
            if (isEnd(tt)) {
                if (this._debug) {
                    console.log('Each: THE END');
                }
                return;
            }
            dotoall(tt);
        }, options);
    }
    async toArray() {
        let result = [];
        let promisedArray = new Promise((resolve, _reject) => {
            this.spout((tt) => {
                if (isEnd(tt)) {
                    resolve(result);
                }
                else {
                    result.push(tt);
                }
            });
        });
        return promisedArray;
    }
    toPromise() { throw new Error('Not implemented'); }
    pipe(_stream) {
        throw new Error('Not implemented');
    }
    get options() {
        return literal({
            bufferSizeMax: this._bufferSizeMax,
            drainFactor: this._drainFactor,
            debug: this._debug
        });
    }
}
class RedioStart extends RedioPipe {
    constructor(maker, options) {
        super(options);
        this._maker = maker;
        this.next();
    }
    async next() {
        if (this._running) {
            let result = await this._maker();
            this.push(result);
            if (result !== exports.end)
                this.next();
        }
    }
}
function isAPromise(o) {
    return isPromise(o);
}
class RedioMiddle extends RedioPipe {
    constructor(prev, middler, options) {
        super(Object.assign(prev.options, options));
        this._ready = true;
        this._middler = (s) => new Promise((resolve, reject) => {
            this._ready = false;
            let callIt = middler(s);
            let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt);
            promisy.then((t) => {
                this._ready = true;
                resolve(t);
                this.next();
            }, err => {
                this._ready = true;
                reject(err);
                this.next();
            });
        });
        this._prev = prev;
    }
    async next() {
        if (this._running && this._ready) {
            let v = this._prev.pull();
            if (v !== null) {
                let result = await this._middler(v);
                this.push(result);
                this.next();
            }
        }
    }
}
class RedioSink {
    constructor(prev, sinker, options) {
        this._ready = true;
        this._thatsAllFolks = null;
        this._debug = options && typeof options.debug === 'boolean' ? options.debug : prev.options.debug;
        this._sinker = (t) => new Promise((resolve, reject) => {
            this._ready = false;
            let callIt = sinker(t);
            let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt);
            promisy.then(() => {
                this._ready = true;
                resolve();
                if (!isEnd(t)) {
                    this.next();
                }
                else if (this._thatsAllFolks) {
                    this._thatsAllFolks();
                }
            }, (err) => {
                this._ready = true;
                reject(err);
                if (!isEnd(t))
                    this.next();
            });
        });
        this._prev = prev;
    }
    next() {
        if (this._ready) {
            let v = this._prev.pull();
            if (v !== null) {
                this._sinker(v);
            }
        }
    }
    done(thatsAllFolks) {
        this._thatsAllFolks = thatsAllFolks;
        return this;
    }
}
// export default function<T> (url: string, options?: RedioOptions): RedioPipe<T>
// export default function<T> (funnel: Funnel<T>, options?: RedioOptions): RedioPipe<T>
function default_1(args1, args2, _args3) {
    // if (typeof args1 === 'function') {
    // 	return new RedioStart(args1 as Funnel<T>, args2 as RedioOptions | undefined)
    // }
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