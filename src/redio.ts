export interface PromiseMaker<T> {
	(): Promise<T>
}

export interface PromiseMiddler<S, T> {
	(s: S): Promise<T>
}

export interface PromiseSinker<T> {
	(t: T): Promise<void>
}

let bufferSizeMax = 10

export class RedioStream<T> {
	private _follow: RedioEnd<T> | RedioSink<T> | null = null
	private _buffer: T[] = []
	protected _running: boolean = true

	push (x: T) {
		this._buffer.push(x)
		console.log('Push', x, this._buffer.length)
		if (this._buffer.length >= bufferSizeMax) this._running = false
		if (this._follow) this._follow.next()
	}

	pull (): T | null {
		let val = this._buffer.shift()
		if (!this._running && this._buffer.length < 0.7 * bufferSizeMax) {
			this._running = true
			this.next()
		}
		return val ? val : null
	}

	next (): Promise<void> { return Promise.resolve() }

	map<M> (mapper: PromiseMiddler<T, M>): RedioMiddle<T, M> {
		let redm = new RedioMiddle(this, mapper)
		return redm
	}

	sink (sinker: PromiseSinker<T>) {
		this._follow = new RedioSink<T>(this, sinker)
		return this._follow
	}

	each (dotoall: (x: T) => void) {
		this._follow = new RedioEnd<T>(this, dotoall)
		return this._follow
	}
}

export class RedioStart<T> extends RedioStream<T> {
	private _maker: PromiseMaker<T>

	constructor (maker: PromiseMaker<T>) {
		super()
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

export class RedioMiddle<S, T> extends RedioStream<T> {
	private _middler: PromiseMiddler<S, T>
	private _ready: boolean = true
	private _prev: RedioStream<S>

	constructor (prev: RedioStream<S>, middler: PromiseMiddler<S, T>) {
		super()
		this._middler = (s: S) => new Promise<T>((resolve, reject) => {
			this._ready = false
			middler(s).then((t: T) => {
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

export class RedioEnd<T> {
	private _dotoall: (x: T) => any
	private _prev: RedioStream<T>

	constructor (prev: RedioStream<T>, dotoall: (x: T) => void) {
		this._dotoall = dotoall
		this._prev = prev
		this.next()
	}

	next () {
		let v: T | null = this._prev.pull()
		// console.log('End next', v)
		if (v) {
			this._dotoall(v)
		}
	}
}

export class RedioSink<T> {
	private _sinker: (x: T) => Promise<T>
	private _prev: RedioStream<T>
	private _ready: boolean = true

	constructor (prev: RedioStream<T>, sinker: PromiseSinker<T>) {
		this._sinker = (t: T) => new Promise<T>((resolve, reject) => {
			this._ready = false
			sinker(t).then(() => {
				this._ready = true
				resolve()
				this.next()
			}, err => {
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
