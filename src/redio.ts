import { types } from 'util'
const { isPromise } = types

export interface Funnel<T> {
	(): Promise<T> | T
}

export interface Valve<S, T> {
	(s: S): Promise<T> | T
}

export interface Spout<T> {
	(t: T): Promise<void> | void
}

export interface RedioOptions {
	bufferSizeMax?: number
	drainFactor?: number
}

class RedioPipe<T> {
	private _follow: RedioPipe<T> | RedioSink<T> | null = null
	private _buffer: T[] = []
	protected _running: boolean = true
	private _bufferSizeMax: number = 10
	private _drainFactor: number = 0.7

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

	push (x: T): void {
		this._buffer.push(x)
		console.log('Push', x, this._buffer.length)
		if (this._buffer.length >= this._bufferSizeMax) this._running = false
		if (this._follow) this._follow.next()
	}

	pull (): T | null {
		let val = this._buffer.shift()
		if (!this._running && this._buffer.length < this._drainFactor * this._bufferSizeMax) {
			this._running = true
			this.next()
		}
		return val ? val : null
	}

	next (): Promise<void> { return Promise.resolve() }

	map<M> (mapper: Valve<T, M>): RedioMiddle<T, M> {
		let redm = new RedioMiddle(this, mapper)
		return redm
	}

	sink (sinker: Spout<T>) {
		this._follow = new RedioSink<T>(this, sinker)
		return this._follow
	}

	each (dotoall: (t: T) => void) {
		return this.sink(dotoall)
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
			this.next()
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
		this._middler = (s: S) => new Promise<T>((resolve, reject) => {
			this._ready = false
			let callIt = middler(s)
			let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
			promisy.then((t: T) => {
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
			let v: S | null = this._prev.pull()
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
		this._sinker = (t: T) => new Promise<void>((resolve, reject) => {
			this._ready = false
			let callIt = sinker(t)
			let promisy = isAPromise(callIt) ? callIt : Promise.resolve(callIt)
			promisy.then(() => {
				this._ready = true
				resolve()
				this.next()
			}, (err?: any) => {
				this._ready = true
				reject(err)
				this.next()
			})
		})
		this._prev = prev
	}

	next () {
		if (this._ready) {
			let v: T | null = this._prev.pull()
			if (v !== null) {
				this._sinker(v)
			}
		}
	}
}

let counter = 0
let test = new RedioStart<number>(() => new Promise((resolve) => setTimeout(() => resolve(counter++), Math.random() * 1000)))

test.sink((t: number) => new Promise((resolve) => {
	console.log('Starting to process slow coach', t)
	setTimeout(() => {
		console.log('Ending the slow coach', t)
		resolve()
	}, 750)
}))

export default function<T> (funnel: Funnel<T>, options?: RedioOptions): RedioPipe<T> {
	return new RedioStart(funnel, options)
}
