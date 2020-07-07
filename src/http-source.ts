import { Spout, Liquid, HTTPOptions, literal, isNil, RedioEnd, isEnd } from './redio'
import { Server, createServer, IncomingMessage, ServerResponse } from 'http'
import { Server as ServerS, createServer as createServerS } from 'https'
import { isError } from 'util'
import { URL } from 'url'

/* Code for sending values over HTTP/S. */

const servers: { [port: number]: Server } = {}
const serversS: { [port: number]: ServerS } = {}
const streamIDs: { [sid: string]: { httpPort?: number; httpsPort?: number } } = {}

interface BagOf<T> {
	value: T | RedioEnd
	blob: Buffer | undefined
	counter: number
	id: number | string
	nextId: string | number
	nextFn: () => void
	errorFn: (reason?: any) => void
}

enum ProtocolType {
	http = 'http',
	https = 'https',
	both = 'both'
}

enum BodyType {
	primitive = 'primitive',
	json = 'json',
	blob = 'blob'
}

enum IdType {
	counter = 'counter',
	number = 'number',
	string = 'string'
}

enum DeltaType {
	one = 'one',
	fixed = 'fixed', // increment defined in options
	variable = 'variable', // variable increment defined in the stream
	string = 'string' // fixed name of next element
}

interface ConInfo {
	type: 'pull' | 'push'
	protocol: ProtocolType
	body: BodyType
	idType: IdType
	delta: DeltaType
	manifest: Record<string, unknown>
}

interface PullInfo extends ConInfo {
	type: 'pull'
	httpPort?: number
	httpsPort?: number
	server?: Server
	serverS?: ServerS
	root: string
}

function isPull(c: ConInfo): c is PullInfo {
	return c.type === 'pull'
}

interface PushInfo extends ConInfo {
	type: 'push'
}

function wait(t: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, t))
}

function noMatch(req: IncomingMessage, res: ServerResponse) {
	if (res.writableEnded) return
	const message: { status?: number; message?: string } = {}
	if (req.url && req.method && req.method === 'GET') {
		const url = new URL(req.url)
		if (!Object.keys(streamIDs).find((x) => url.pathname.startsWith(x))) {
			message.status = 404
			message.message = `No stream with available for pathname "${url.pathname}".`
		}
	} else {
		message.status = req.method ? 405 : 500
		message.message = req.method
			? `Method ${req.method} not allowed for resource`
			: `Cannot determine method type`
	}
	if (message.status) {
		res.statusCode = message.status
		const result = JSON.stringify(message, null, 2)
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', Buffer.byteLength(result, 'utf8'))
		res.end(result, 'utf8')
	}
}

export function httpSource<T>(uri: string, options?: HTTPOptions): Spout<T> {
	if (!options) throw new Error('HTTP options must be specified - for now.')
	const tChest: Map<string, BagOf<T>> = new Map()
	let info: ConInfo
	const url = new URL(uri, `http://localhost:${options.httpPort || options.httpsPort}`)
	url.pathname = url.pathname.replace(/\/+/g, '/')
	if (url.pathname.endsWith('/')) {
		url.pathname = url.pathname.slice(0, -1)
	}
	if (uri.toLowerCase().startsWith('http')) {
		info = literal<PushInfo>({
			type: 'push',
			protocol: uri.toLowerCase().startsWith('https') ? ProtocolType.https : ProtocolType.http,
			body: BodyType.primitive,
			idType: IdType.counter,
			delta: DeltaType.one,
			manifest: {}
		})
	} else {
		let server: Server | undefined = undefined
		let serverS: ServerS | undefined = undefined
		const root = url.pathname
		if (options.httpPort) {
			if (options && !options.extraStreamRoot) {
				// Set with first element
				streamIDs[root] = { httpPort: options.httpPort, httpsPort: options.httpsPort }
			}
			server = servers[options.httpPort]
			if (!server) {
				server = createServer()
				servers[options.httpPort] = server
				server.listen(options.httpPort, () => {
					console.log(`Server for uri listening on ${options.httpPort}`)
				})
			}
			server.on('request', pullRequest)
			server.on('error', (err) => {
				// TODO interrupt and push error?
				console.error(err)
			})
		}
		if (options.httpsPort) {
			if (options && !options.extraStreamRoot) {
				streamIDs[root] = { httpPort: options.httpPort, httpsPort: options.httpsPort }
			}
			serverS = serversS[options.httpsPort]
			if (!serverS) {
				serverS = createServerS()
				serversS[options.httpsPort] = serverS
			}
		}

		info = literal<PullInfo>({
			type: 'pull',
			protocol:
				server && serverS ? ProtocolType.both : serverS ? ProtocolType.https : ProtocolType.http,
			body: BodyType.primitive,
			idType: IdType.counter,
			delta: DeltaType.one,
			manifest: {},
			httpPort: options.httpPort,
			httpsPort: options.httpsPort,
			server,
			serverS,
			root
		})
	}

	let fuzzyGap: number = (options && options.fuzzy) || 0.0
	const fuzzFactor: number = (options && options.fuzzy) || 0.0
	function fuzzyMatch(id: string): BagOf<unknown> | undefined {
		if (tChest.size === 0) {
			return undefined
		}
		const exact = tChest.get(id)
		if (exact || fuzzFactor === 0.0) {
			return exact
		} else {
			const keys = tChest.keys()
			if (info.idType !== IdType.string) {
				const gap = fuzzyGap * fuzzFactor
				const idn = +id
				const [min, max] = [idn - gap, idn + gap]
				for (const key of keys) {
					const keyn = +key
					if (keyn > min && keyn < max) {
						return tChest.get(key)
					}
				}
				return undefined
			} else {
				// IdType === string
				for (const key of keys) {
					let score = id.length > key.length ? id.length - key.length : key.length - id.length
					for (let x = id.length - 1; x >= 0 && score / id.length <= fuzzFactor; x--) {
						if (x < key.length) {
							score += key[x] === id[x] ? 0 : 1
						}
					}
					if (score / id.length <= fuzzFactor) {
						return tChest.get(key)
					}
				}
				return undefined
			}
		}
	}

	const blobContentType = (options && options.contentType) || 'application/octet-stream'
	function pullRequest(req: IncomingMessage, res: ServerResponse) {
		if (res.writableEnded) return
		if (req.url && isPull(info) && req.method === 'GET') {
			let path = req.url.replace(/\/+/g, '/')
			if (path.endsWith('/')) {
				path = path.slice(0, -1)
			}
			if (path.startsWith(info.root)) {
				const id = path.slice(info.root.length + 1)
				if (id === 'debug.json') {
					return debug(res)
				}
				if (id === 'manifest.json') {
					const maniStr = JSON.stringify(info.manifest)
					res.setHeader('Content-Type', 'application/json')
					res.setHeader('Content-Length', `${Buffer.byteLength(maniStr, 'utf8')}`)
					res.end(maniStr, 'utf8')
					return
				}
				if (id === 'end') {
					return endStream(res)
				}
				if (id.startsWith('start')) {
					// initialize stream and redirect
					return
				}
				const value = fuzzyMatch(id)
				if (value) {
					res.setHeader('Redioactive-Id', value.id)
					res.setHeader('Redioactive-NextId', value.nextId)
					// TODO parts and parallel
					if (info.body !== BodyType.blob) {
						const json = JSON.stringify(value.value)
						res.setHeader('Content-Type', 'application/json')
						res.setHeader('Content-Length', `${Buffer.byteLength(json, 'utf8')}`)
						res.end(json, 'utf8')
					} else {
						res.setHeader('Content-Type', blobContentType)
						res.setHeader('Content-Length', `${(value.blob && value.blob.length) || 0}`)
						// Assuming that receiver us happy with UTF-8 in headers
						res.setHeader('Redioactive-Details', JSON.stringify(value.value))
						res.end(value.blob || Buffer.alloc(0))
					}

					res.on('finish', () => {
						value.nextFn()
					})
					return
				} else {
					// 404 or miss
				}
			}
		}
		noMatch(req, res)
	}

	function debug(res: ServerResponse) {
		const debugInfo = {
			info,
			tChestSize: tChest.size,
			bufferSize,
			fuzzFactor,
			fuzzyGap,
			uri,
			url,
			streamIDs,
			options
		}
		const debugString = JSON.stringify(debugInfo, null, 2)
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', `${Buffer.byteLength(debugString, 'utf8')}`)
		res.end(debugString, 'utf8')
	}

	function endStream(res: ServerResponse) {
		if (isPull(info)) {
			try {
				info.server &&
					info.server.close(() => {
						isPull(info) && delete streamIDs[info.root]
						console.log(`Server on port closed.`)
					})
				res.setHeader('Content-Type', 'application/json')
				res.setHeader('Content-Length', 2)
				res.end('OK', 'utf8')
			} catch (err) {
				console.error(
					`Redioactive: HTTP source: error closing ${info.protocol} ${info.type} stream: ${err.message}`
				)
			}
		}
	}

	function checkObject(t: T) {
		if (!options) return
		if (options.seqId || options.extraStreamRoot || options.delta || options.blob) {
			if (typeof t !== 'object' || Array.isArray(t)) {
				throw new Error(
					'HTTP stream properties from values (seqId, extraStreamRoot, delta, blob) requested but first stream value is not an object.'
				)
			}
		}
		const tr: Record<string, unknown> = t as Record<string, unknown>
		if (
			options.seqId &&
			typeof tr[options.seqId] !== 'string' &&
			typeof tr[options.seqId] !== 'number'
		) {
			throw new Error(
				'Sequence identifer property expected but not present - or not a string or number - in first value in the stream.'
			)
		}
		if (options.extraStreamRoot && typeof [options.extraStreamRoot] !== 'string') {
			throw new Error(
				'Extra stream root expected but no string property is present in the first stream value.'
			)
		}
		if (
			options.delta &&
			typeof tr[options.delta] !== 'string' &&
			typeof tr[options.delta] !== 'number'
		) {
			throw new Error(
				'Delta value expected but no string or number delta property is present on the first stream value.'
			)
		}
		if (options.blob && !Buffer.isBuffer(tr[options.blob])) {
			throw new Error(
				'Data blob expected but no Buffer is present in the first value of the stream.'
			)
		}
		if (typeof options.manifest === 'string' && typeof tr[options.manifest] !== 'object') {
			throw new Error(
				'Manifest object expected but it is not present in the first value of the stream.'
			)
		}
	}

	function initFromObject(t: T) {
		if (typeof t !== 'object') {
			info.body = BodyType.primitive
		} else if (options && options.blob) {
			info.body = BodyType.blob
		} else {
			info.body = BodyType.json
		}
		const tr: Record<string, unknown> = t as Record<string, unknown>

		info.idType = IdType.counter
		if (options && options.seqId) {
			info.idType = typeof tr[options.seqId] === 'number' ? IdType.number : IdType.string
		}

		if (options && options.extraStreamRoot) {
			if (isPull(info)) {
				info.root = `${info.root}/${tr[options.extraStreamRoot]}`
				streamIDs[info.root] = { httpPort: options.httpPort, httpsPort: options.httpsPort }
			}
			// TODO do something for push
		}

		info.delta = DeltaType.one
		if (options && options.delta) {
			if (typeof info.delta === 'number') {
				info.delta = DeltaType.fixed
			} else {
				info.delta = typeof tr[options.delta] === 'number' ? DeltaType.variable : DeltaType.string
			}
		}

		if (options && options.manifest) {
			if (typeof options.manifest === 'string') {
				info.manifest =
					typeof tr[options.manifest] === 'object'
						? <Record<string, unknown>>tr[options.manifest]
						: {}
			} else {
				info.manifest = options.manifest
			}
		}
	}

	let idCounter = 0
	let ended = false
	const bufferSize = (options && options.bufferSizeMax) || 10
	return async (t: Liquid<T>): Promise<void> =>
		new Promise((resolve, reject) => {
			if (isNil(t) || isError(t)) {
				return
			}
			if (idCounter++ === 0 && !isEnd(t)) {
				// Do some first time out checks
				checkObject(t)
				initFromObject(t)
			}
			if (info.idType !== IdType.string && tChest.size > 1 && idCounter <= bufferSize) {
				const keys = tChest.keys()
				let prev: string = keys.next().value
				let sum = 0
				for (const key of keys) {
					sum += +key - +prev
					prev = key
				}
				fuzzyGap = sum / (tChest.size - 1)
			}
			const tr: Record<string, unknown> = t as Record<string, unknown>
			const currentId =
				info.idType === IdType.counter ? idCounter : <number | string>tr[<string>options.seqId]
			let nextId: string | number
			switch (info.delta) {
				case DeltaType.one:
					nextId = <number>currentId + 1
					break
				case DeltaType.fixed:
					nextId = <number>currentId + <number>options.delta
					break
				case DeltaType.variable:
					nextId = <number>currentId + <number>tr[<string>options.delta]
					break
				case DeltaType.string:
					nextId = <string>tr[<string>options.delta]
					break
			}
			const value = info.body === BodyType.primitive ? t : Object.assign({}, t)
			if (typeof value === 'object') {
				options && options.seqId && delete (value as Record<string, unknown>)[options.seqId]
				options &&
					options.extraStreamRoot &&
					delete (value as Record<string, unknown>)[options.extraStreamRoot]
				options && options.blob && delete (value as Record<string, unknown>)[options.blob]
				options &&
					typeof options.delta === 'string' &&
					delete (value as Record<string, unknown>)[options.delta]
				options &&
					typeof options.manifest === 'string' &&
					delete (value as Record<string, unknown>)[options.manifest]
			}
			const blob =
				(options &&
					options.blob &&
					Buffer.isBuffer(tr[options.blob]) &&
					(tr[options.blob] as Buffer)) ||
				undefined
			tChest.set(
				currentId.toString(),
				literal<BagOf<T>>({
					value,
					blob,
					counter: idCounter,
					id: currentId,
					nextId: nextId,
					nextFn: resolve,
					errorFn: reject
				})
			)
			if (tChest.size > bufferSize) {
				const keys = tChest.keys()
				const toRemove = tChest.size - bufferSize
				for (let x = 0; x < toRemove; x++) {
					tChest.delete(keys.next().value)
				}
			}
			if (isEnd(t)) {
				ended = true
			}
			if (ended && isPull(info)) {
				setTimeout(() => {
					isPull(info) && info.server && info.server.close()
				}, 10000)
			}
			return wait(1000)
		})
}
