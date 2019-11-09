"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const { isPromise } = util_1.types;
class RedioPipe {
    constructor(options) {
        this._follow = null;
        this._buffer = [];
        this._running = true;
        this._bufferSizeMax = 10;
        this._drainFactor = 0.7;
        if (options) {
            if (typeof options.bufferSizeMax === 'number' && options.bufferSizeMax > 0) {
                this._bufferSizeMax = options.bufferSizeMax;
            }
            if (typeof options.drainFactor === 'number' && options.drainFactor >= 0.0 && options.drainFactor <= 1.0) {
                this._drainFactor = options.drainFactor;
            }
        }
    }
    push(x) {
        this._buffer.push(x);
        console.log('Push', x, this._buffer.length);
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
    map(mapper) {
        let redm = new RedioMiddle(this, mapper);
        return redm;
    }
    sink(sinker) {
        this._follow = new RedioSink(this, sinker);
        return this._follow;
    }
    each(dotoall) {
        return this.sink(dotoall);
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
            this.next();
        }
    }
}
function isAPromise(o) {
    return isPromise(o);
}
class RedioMiddle extends RedioPipe {
    constructor(prev, middler) {
        super();
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
    constructor(prev, sinker) {
        this._ready = true;
        this._sinker = (t) => new Promise((resolve, reject) => {
            this._ready = false;
            let callIt = sinker(t);
            let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt);
            promisy.then(() => {
                this._ready = true;
                resolve();
                this.next();
            }, (err) => {
                this._ready = true;
                reject(err);
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
}
let counter = 0;
let test = new RedioStart(() => new Promise((resolve) => setTimeout(() => resolve(counter++), Math.random() * 1000)));
test.sink((t) => new Promise((resolve) => {
    console.log('Starting to process slow coach', t);
    setTimeout(() => {
        console.log('Ending the slow coach', t);
        resolve();
    }, 750);
}));
function default_1(funnel, options) {
    return new RedioStart(funnel, options);
}
exports.default = default_1;
//# sourceMappingURL=redio.js.map