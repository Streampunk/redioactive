import { Spout, Liquid, HTTPOptions, literal, isNil, RedioEnd, isEnd } from './redio'
import http, { Server, createServer, IncomingMessage, ServerResponse, STATUS_CODES } from 'http'
import https, { Server as ServerS, createServer as createServerS, AgentOptions } from 'https'
import { isError } from 'util'
import { URL } from 'url'
import { ProtocolType, BodyType, IdType, DeltaType } from './http-common'
import { promises as dns } from 'dns'

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
	prevId: string | number
	nextFn: () => void
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	errorFn: (reason?: any) => void
}

interface ConInfo {
	type: 'pull' | 'push'
	protocol: ProtocolType
	body: BodyType
	idType: IdType
	delta: DeltaType
	manifest: Record<string, unknown>
	root: string
}

interface PullInfo extends ConInfo {
	type: 'pull'
	httpPort?: number
	httpsPort?: number
	server?: Server
	serverS?: ServerS
}

function isPull(c: ConInfo): c is PullInfo {
	return c.type === 'pull'
}

interface PushInfo extends ConInfo {
	type: 'push'
}

function isPush(c: ConInfo): c is PushInfo {
	return c.type === 'push'
}

// function wait(t: number): Promise<void> {
// 	return new Promise((resolve) => setTimeout(resolve, t))
// }

function noMatch(req: IncomingMessage, res: ServerResponse) {
	if (res.writableEnded) return
	const message: { status?: number; message?: string } = {}
	if (req.url && req.method && req.method === 'GET') {
		const url = new URL(req.url)
		if (!Object.keys(streamIDs).find((x) => url.pathname.startsWith(x))) {
			message.status = 404
			message.message = `Redioactive: HTTP/S source: No stream available for pathname "${url.pathname}".`
		}
	} else {
		message.status = req.method ? 405 : 500
		message.message = req.method
			? `Redioactive: HTTP/S source: Method ${req.method} not allowed for resource`
			: `Redioactive: HTTP/S source: Cannot determine method type`
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
	let protocol: typeof http | typeof https
	let agent: http.Agent
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
			manifest: {},
			root: url.pathname
		})
		protocol = info.protocol === ProtocolType.http ? http : https
		agent = new protocol.Agent(
			Object.assign(
				{ keepAlive: true, host: url.hostname },
				(options && options.requestOptions) || {}
			) as AgentOptions
		)
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
				server = options.serverOptions ? createServer(options.serverOptions) : createServer()
				server.keepAliveTimeout = (options && options.keepAliveTimeout) || 5000
				servers[options.httpPort] = server
				server.listen(options.httpPort, () => {
					console.log(
						`Redioactive: HTTP/S source: HTTP pull server for stream ${root} listening on ${options.httpPort}`
					)
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
				serverS = options.serverOptions ? createServerS(options.serverOptions) : createServerS()
				serverS.keepAliveTimeout = (options && options.keepAliveTimeout) || 5000
				serversS[options.httpsPort] = serverS
				serverS.listen(options.httpsPort, () => {
					console.log(
						`Redioactive: HTTP/S source: HTTPS server for stream ${root} listening on ${options.httpsPort}`
					)
				})
			}
			serverS.on('request', pullRequest)
			serverS.on('error', (err) => {
				// TODO interrupt and push error?
				console.error(err)
			})
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
			const key = fuzzyIDMatch(id, tChest.keys())
			return key ? tChest.get(key) : undefined
		}
	}

	function fuzzyIDMatch(id: string, keys: IterableIterator<string>): string | undefined {
		if (info.idType !== IdType.string) {
			const gap = fuzzyGap * fuzzFactor
			const idn = +id
			const [min, max] = [idn - gap, idn + gap]
			for (const key of keys) {
				const keyn = +key
				if (keyn >= min && keyn <= max) {
					return key
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
					return key
				}
			}
			return undefined
		}
	}

	const blobContentType = (options && options.contentType) || 'application/octet-stream'
	const pendings: Array<(value?: void | PromiseLike<void> | undefined) => void> = []
	let nextId: number | string
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
					return endStream(req, res)
				}
				if (id.match(/start|latest/)) {
					res.statusCode = 302
					const isSSL = Object.prototype.hasOwnProperty.call(req.socket, 'encrypted')
					res.setHeader(
						'Location',
						`${isSSL ? 'https' : 'http'}://${req.headers['host']}${info.root}/${
							id === 'start' ? lowWaterMark : highWaterMark
						}`
					)
					res.setHeader('Redioactive-BodyType', info.body)
					res.setHeader('Redioactive-IdType', info.idType)
					res.setHeader('Redioactive-DeltaType', info.delta)
					res.setHeader('Redioactive-BufferSize', `${bufferSize}`)
					if (options && options.cadence) {
						res.setHeader('Redioactive-Cadence', `${options.cadence}`)
					}
					res.end()
					return
				}

				const value = fuzzyMatch(id)
				if (value) {
					res.setHeader('Redioactive-Id', value.id)
					res.setHeader('Redioactive-NextId', value.nextId)
					res.setHeader('Redioactive-PrevId', value.prevId)
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

					//res.on('finish', () => { - commented out to go parrallel - might work?
					// Relying on undocument features of promises that you can safely resolve twice
					setImmediate(value.nextFn)
					//})
					return
				} else {
					// for (const k of [nextId.toString()][Symbol.iterator]()) {
					// 	console.log('**** About to fuzzy match with nextId', k)
					// }
					if (fuzzyIDMatch(id, [nextId.toString()][Symbol.iterator]())) {
						// console.log('*** Fuzzy match with next', id)
						const pending = new Promise<void>((resolve) => {
							const clearer = setTimeout(resolve, (options && options.timeout) || 5000)
							pendings.push(() => {
								clearTimeout(clearer)
								resolve()
							})
						})
						pending.then(() => {
							pullRequest(req, res)
						})
						tChest.get(highWaterMark.toString())?.nextFn()
						return
					}
					let [status, message] = [404, '']
					switch (info.idType) {
						case IdType.counter:
						case IdType.number:
							if (+id < lowWaterMark) {
								if (+id < lowestOfTheLow) {
									status = 405
									message = `Request for a value with a sequence identifier "${id}" that is before the start of a stream "${lowestOfTheLow}".`
								} else {
									status = 410 // Gone
									message = `Request for value with sequence identifier "${id}" that is before the current low water mark of "${lowWaterMark}".`
								}
							} else if (+id > highWaterMark) {
								if (!ended) {
									message = `Request for value with sequence identifier "${id}" that is beyond the current high water mark of "${highWaterMark}".`
								} else {
									status = 405 // METHOD NOT ALLOWED - I understand your request, but never for this resource pal!
									message = `Request for a value with a sequence identifier "${id}" that is beyond the end of a finished stream.`
								}
							} else {
								message = `Unmatched in-range request for a value with a sequence identifier "${id}".`
							}
							break
						case IdType.string:
							message = `Unmatched string sequence identifier "${id}".`
							break
					}
					const json = JSON.stringify(
						{
							status,
							statusMessage: STATUS_CODES[status],
							message
						},
						null,
						2
					)
					res.setHeader('Content-Type', 'application/json')
					res.setHeader('Content-Length', `${Buffer.byteLength(json, 'utf8')}`)
					res.statusCode = status
					res.end(json, 'utf8')
					return
				}
			}
		}
		noMatch(req, res)
	}

	function debug(res: ServerResponse) {
		const keys: Array<string> = []
		for (const key of tChest.keys()) {
			keys.push(key)
		}
		const debugInfo = {
			info,
			tChestSize: tChest.size,
			bufferSize,
			fuzzFactor,
			fuzzyGap,
			uri,
			url,
			streamIDs,
			options,
			ended,
			lowestOfTheLow,
			lowWaterMark,
			highWaterMark,
			nextId,
			keys
		}

		const debugString = JSON.stringify(debugInfo, null, 2)
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', `${Buffer.byteLength(debugString, 'utf8')}`)
		res.end(debugString, 'utf8')
	}

	function endStream(req: IncomingMessage, res: ServerResponse) {
		const isSSL = Object.prototype.hasOwnProperty.call(req.socket, 'encrypted')
		const port = req.socket.localPort
		if (isPull(info)) {
			try {
				info.server &&
					info.server.close(() => {
						isPull(info) && delete streamIDs[info.root]
						console.log(
							`Redioactive: HTTP/S source: ${isSSL ? 'HTTPS' : 'HTTP'} server for stream ${
								(isPull(info) && info.root) || 'unknown'
							} on port ${port} closed.`
						)
					})
				info.serverS &&
					info.serverS.close(() => {
						isPull(info) && delete streamIDs[info.root]
						console.log(
							`Redioactive: HTTP/S source: ${isSSL ? 'HTTPS' : 'HTTP'} server for stream ${
								(isPull(info) && info.root) || 'unknown'
							} on port ${port} closed.`
						)
					})
				res.setHeader('Content-Type', 'application/json')
				res.setHeader('Content-Length', 2)
				res.end('OK', 'utf8')
				delete streamIDs[info.root]
				if (
					!Object.values(streamIDs).some(
						(x) =>
							isPull(info) &&
							((x.httpPort && x.httpPort === info.httpPort) ||
								(x.httpsPort && x.httpsPort === info.httpsPort))
					)
				) {
					isPull(info) && info.httpPort && delete servers[info.httpPort]
					isPull(info) && info.httpsPort && delete serversS[info.httpsPort]
				}
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
	async function push(currentId: string | number): Promise<void> {
		// console.log(
		// 	`Pushing ${currentId} with counter ${idCounter} compared to lowest ${lowestOfTheLow}`
		// )
		const manifestSender = new Promise<void>((resolve, reject) => {
			if (idCounter !== lowestOfTheLow) {
				resolve()
				return
			}
			// First time out, send manifest
			dns
				.lookup(url.hostname)
				.then(
					(host) => {
						url.hostname = host.address
					},
					() => {
						/* Does not matter - fall back on given hostname and default DNS behaviour */
					}
				)
				.then(() => {
					const req = protocol.request(
						Object.assign((options && options.requestOptions) || {}, {
							hostname: url.hostname,
							protocol: url.protocol,
							port: url.port,
							path: `${info.root}/manifest.json`,
							method: 'POST',
							headers: {
								'Redioactive-BodyType': info.body,
								'Redioactive-IdType': info.idType,
								'Redioactive-DeltaType': info.delta,
								'Redioactive-BufferSize': `${bufferSize}`,
								'Redioactive-NextId': currentId // Defines the start
							},
							agent
						}),
						(res) => {
							if (res.statusCode === 200 || res.statusCode === 201) {
								resolve()
							} else {
								reject(
									new Error(`After posting manifest, unexptected response code "${res.statusCode}"`)
								)
							}
							res.on('error', reject)
							res.on('error', console.error)
						}
					)
					if (options && options.cadence) {
						req.setHeader('Redioactive-Cadence', `${options.cadence}`)
					}
					req.on('error', reject)
					const maniJSON = JSON.stringify(info.manifest)
					req.setHeader('Content-Length', `${Buffer.byteLength(maniJSON, 'utf8')}`)
					req.setHeader('Content-Type', 'application/json')
					req.end(maniJSON, 'utf8')
				})
		})
		return manifestSender
			.then(() => {
				return new Promise<void>((resolve, reject) => {
					const sendBag = tChest.get(currentId.toString())
					if (!sendBag) {
						throw new Error('Redioactive: HTTP/S source: Could not find element to push.')
					}
					const req = protocol.request(
						Object.assign((options && options.requestOptions) || {}, {
							hostname: url.hostname,
							protocol: url.protocol,
							port: url.port,
							path: `${info.root}/${currentId}`,
							method: 'POST',
							headers: {
								'Redioactive-Id': sendBag.id,
								'Redioactive-NextId': sendBag.nextId,
								'Redioactive-PrevId': sendBag.prevId
							},
							agent
						}),
						(res) => {
							// Received when all data is consumed
							if (res.statusCode === 200 || res.statusCode === 201) {
								setImmediate(sendBag.nextFn)
								resolve()
								return
							}
							reject(
								new Error(
									`Redioactive: HTTP/S source: Received unexpected response of POST request for "${currentId}": ${res.statusCode}`
								)
							)
						}
					)
					req.on('error', reject)
					let valueStr = ''
					switch (info.body) {
						case BodyType.primitive:
						case BodyType.json:
							valueStr = JSON.stringify(sendBag.value)
							req.setHeader('Content-Type', 'application/json')
							req.setHeader('Content-Length', `${Buffer.byteLength(valueStr, 'utf8')}`)
							req.end(valueStr, 'utf8')
							break
						case BodyType.blob:
							req.setHeader('Content-Type', blobContentType)
							req.setHeader('Content-Length', (sendBag.blob && sendBag.blob.length) || 0)
							req.setHeader('Redioactive-Details', JSON.stringify(sendBag.value))
							req.end(sendBag.blob || Buffer.alloc(0))
							break
					}
				})
			})
			.catch((err) => {
				const sendBag = tChest.get(currentId.toString())
				if (sendBag) {
					setImmediate(() => {
						sendBag.errorFn(err)
					})
				} else {
					throw new Error(
						`Redioactive: HTTP/S source: Unable to forward error for Id "${currentId}": ${err.message}`
					)
				}
			})
	}

	let ended = false
	const bufferSize = (options && options.bufferSizeMax) || 10
	let highWaterMark: string | number = 0
	let lowWaterMark: string | number = 0
	let lowestOfTheLow: string | number = 0
	let pushChain = Promise.resolve()
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
			if (idCounter === 1) {
				lowWaterMark = currentId
				highWaterMark = currentId
				lowestOfTheLow = currentId
			}
			while (pendings.length > 0) {
				const resolvePending = pendings.pop()
				resolvePending && setImmediate(resolvePending)
			}
			if (!isEnd(t)) {
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
			} else {
				nextId = currentId
				ended = true
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
					prevId: highWaterMark,
					nextFn: resolve,
					errorFn: reject
				})
			)
			highWaterMark = currentId
			if (tChest.size > bufferSize) {
				const keys = tChest.keys()
				const toRemove = tChest.size - bufferSize
				for (let x = 0; x < toRemove; x++) {
					tChest.delete(keys.next().value)
				}
				lowWaterMark = keys.next().value
			}
			if (
				tChest.size < bufferSize || // build the initial buffer
				(options && options.backPressure === false)
			) {
				const timeout = (options && options.cadence) || 0
				if (timeout) {
					setTimeout(resolve, timeout)
				} else {
					setImmediate(resolve)
				}
			}
			if (isPush(info)) {
				pushChain = pushChain.then(() => push(currentId))
			}
		})
}
