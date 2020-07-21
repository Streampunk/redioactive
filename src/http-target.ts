import { HTTPOptions, Funnel, Liquid, literal, end } from './redio'
import { ProtocolType, IdType, DeltaType, BodyType } from './http-common'
import http, { Server, createServer, IncomingMessage, ServerResponse } from 'http'
import https, { Server as ServerS, createServer as createServerS, AgentOptions } from 'https'
import { URL } from 'url'
import { promises as dns } from 'dns'

const servers: { [port: number]: Server } = {}
const serversS: { [port: number]: ServerS } = {}
const streamIDs: { [sid: string]: { httpPort?: number; httpsPort?: number } } = {}

interface ConInfo {
	type: 'push' | 'pull'
	protocol: ProtocolType
	root: string
	idType: IdType
	body: BodyType
	delta: DeltaType
	manifest: Record<string, unknown>
}

interface PushInfo extends ConInfo {
	type: 'push'
	httpPort?: number
	httpsPort?: number
	server?: Server
	serverS?: ServerS
}

function isPush(c: ConInfo): c is PushInfo {
	return c.type === 'push'
}

function noMatch(req: IncomingMessage, res: ServerResponse) {
	if (res.writableEnded) return
	const message: { status?: number; message?: string } = {}
	if (req.url && req.method && (req.method === 'GET' || req.method === 'POST')) {
		const url = new URL(req.url)
		if (!Object.keys(streamIDs).find((x) => url.pathname.startsWith(x))) {
			message.status = 404
			message.message = `Redioactive: HTTP/S target: No stream available for pathname "${url.pathname}".`
		}
	} else {
		message.status = req.method ? 405 : 500
		message.message = req.method
			? `Redioactive: HTTP/S target: Method ${req.method} not allowed for resource`
			: `Redioactive: HTTP/S target: Cannot determine method type`
	}
	if (message.status) {
		res.statusCode = message.status
		const result = JSON.stringify(message, null, 2)
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', Buffer.byteLength(result, 'utf8'))
		res.end(result, 'utf8')
	}
}

export function httpTarget<T>(uri: string, options?: HTTPOptions): Funnel<T> {
	if (!options) throw new Error('HTTP options must be specified - for now.')
	// Assume pull for now
	const url = new URL(uri, `http://localhost:${options.httpPort || options.httpsPort}`)
	let info: ConInfo
	let nextExpectedId: string | number = -1
	let pushResolver: (v?: Liquid<T> | PromiseLike<Liquid<T>> | undefined) => void
	let pushPull: (v?: void | PromiseLike<void> | undefined) => void = () => {
		/* void */
	}
	let pushPullP: Promise<void> = Promise.resolve()
	url.pathname = url.pathname.replace(/\/+/g, '/')
	if (url.pathname.endsWith('/')) {
		url.pathname = url.pathname.slice(0, -1)
	}
	if (uri.toLowerCase().startsWith('http')) {
		info = literal<ConInfo>({
			type: 'pull',
			protocol: uri.toLowerCase().startsWith('https') ? ProtocolType.https : ProtocolType.http,
			root: url.pathname,
			idType: IdType.counter,
			body: BodyType.primitive,
			delta: DeltaType.one,
			manifest: {}
		})
		let currentId: string | number = 0
		let nextId: string | number = 0
		let initDone: (value?: void | PromiseLike<void> | undefined) => void = () => {
			/* void */
		}
		let initError: (reason?: any) => void = () => {
			/* void */
		}
		const initialized = new Promise<void>((resolve, reject) => {
			initDone = resolve
			initError = reject
		})
		let [starter, manifestly] = [false, false]
		const protocol = info.protocol === ProtocolType.http ? http : https
		const agent = new protocol.Agent(
			Object.assign(
				{ keepAlive: true, host: url.hostname },
				(options && options.requestOptions) || {}
			) as AgentOptions
		)
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
				const startReq = protocol.request(
					Object.assign((options && options.requestOptions) || {}, {
						hostname: url.hostname,
						protocol: url.protocol,
						port: url.port,
						path: `${info.root}/start`,
						method: 'GET',
						agent
					}),
					(res) => {
						const location = res.headers['location']
						if (res.statusCode !== 302 || location === undefined) {
							throw new Error(
								`Redioactive: HTTP/S target: Failed to retrieve stream start details for "${info.root}".`
							)
						}
						res.on('error', initError)
						currentId = location.slice(location.lastIndexOf('/') + 1)
						nextId = currentId
						let idType = res.headers['redioactive-idtype']
						if (Array.isArray(idType)) {
							idType = idType[0]
						}
						info.idType = <IdType>idType || IdType.counter
						let delta = res.headers['redioactive-deltatype']
						if (Array.isArray(delta)) {
							delta = delta[0]
						}
						info.delta = <DeltaType>delta || DeltaType.one
						let body = res.headers['redioactive-bodytype']
						if (Array.isArray(body)) {
							body = body[0]
						}
						info.body = <BodyType>body || BodyType.primitive

						starter = true
						if (manifestly) {
							initDone()
						}
					}
				)
				startReq.on('error', initError)
				startReq.end()

				const maniReq = protocol.request(
					Object.assign((options && options.requestOptions) || {}, {
						hostname: url.hostname,
						protocol: url.protocol,
						port: url.port,
						path: `${info.root}/manifest.json`,
						method: 'GET',
						agent
					}),
					(res) => {
						if (res.statusCode !== 200 || res.headers['content-type'] !== 'application/json') {
							throw new Error(
								`Redioactive: HTTP/S target: Failed to retrieve manifest for stream "${info.root}".`
							)
						}
						res.setEncoding('utf8')
						let manifestStr = ''
						res.on('data', (chunk: string) => {
							manifestStr += chunk
						})
						res.on('end', () => {
							info.manifest = JSON.parse(manifestStr)
							manifestly = true
							if (starter) {
								initDone()
							}
						})
					}
				)
				maniReq.on('error', initError)
				maniReq.end()
			})

		// 1. Do all the initialization and options checks
		// 2. Make the /start request and set up state
		// 2a. Get the manifest
		let streamCounter = 0
		return (): Promise<Liquid<T>> =>
			new Promise<Liquid<T>>((resolve, reject) => {
				streamCounter++
				// 3. Pull the value
				// 4. Create the object
				// 5. Get ready for the next pull or detect end
				// 6. resolve
				initialized.then(() => {
					const valueReq = protocol.request(
						Object.assign((options && options.requestOptions) || {}, {
							hostname: url.hostname,
							protocol: url.protocol,
							port: url.port,
							path: `${info.root}/${nextId.toString()}`,
							method: 'GET',
							agent
						}),
						(res) => {
							if (res.statusCode !== 200) {
								throw new Error(
									`Redioactive: HTTP/S target: Unexpected response code ${res.statusCode}.`
								)
							}
							currentId = nextId
							if (!res.headers['content-length']) {
								throw new Error('Redioactive: HTTP/S target: Content-Length header expected')
							}
							let value =
								info.body === BodyType.blob
									? Buffer.allocUnsafe(+res.headers['content-length'])
									: ''
							const streamSaysNextIs = res.headers['redioactive-nextid']
							nextId = Array.isArray(streamSaysNextIs)
								? +streamSaysNextIs[0]
								: streamSaysNextIs
								? +streamSaysNextIs
								: currentId
							if (info.body !== BodyType.blob) {
								res.setEncoding('utf8')
							}
							let bufferPos = 0
							res.on('data', (chunk: string | Buffer) => {
								if (!chunkIsString(value)) {
									bufferPos += (<Buffer>chunk).copy(value, bufferPos)
								} else {
									value += <string>chunk
								}
							})
							res.on('end', () => {
								let t: T
								if (info.body === BodyType.blob) {
									const s = <Record<string, unknown>>{}
									if (value.length > 0) {
										s[(options && options.blob) || 'blob'] = value
									}
									let details = res.headers['redioactive-details'] || '{}'
									if (Array.isArray(details)) {
										details = details[0]
									}
									t = <T>Object.assign(s, JSON.parse(details))
								} else {
									t = <T>JSON.parse(<string>value)
								}
								if (typeof t === 'object') {
									if (
										Object.keys(t).length === 1 &&
										Object.prototype.hasOwnProperty.call(t, 'end') &&
										(<Record<string, unknown>>t)['end'] === true
									) {
										resolve(end)
										return
									}
									if (options && typeof options.manifest === 'string') {
										;(<Record<string, unknown>>t)[options.manifest] = info.manifest
									}
									if (options && options.seqId) {
										;(<Record<string, unknown>>t)[options.seqId] = currentId
									}
									if (options && options.debug) {
										;(<Record<string, unknown>>t)['debug_streamCounter'] = streamCounter
										;(<Record<string, unknown>>t)['debug_status'] = res.statusCode
									}
									if (options && typeof options.delta === 'string') {
										switch (info.delta) {
											case DeltaType.one:
												;(<Record<string, unknown>>t)[options.delta] = 1
												break
											case DeltaType.variable:
											case DeltaType.fixed:
												;(<Record<string, unknown>>t)[options.delta] =
													<number>nextId - <number>currentId
												break
											default:
												break
										}
									}
								}
								resolve(t)
							})
							res.on('error', reject)
						}
					)
					valueReq.on('error', reject)
					valueReq.end()
				}, reject) // initialized promise complete
			})
	} else {
		// PUSH
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
				servers[options.httpPort] = server
				server.listen(options.httpPort, () => {
					console.log(
						`Redioactive: HTTP/S target: HTTP push server for stream ${root} listening on ${options.httpPort}`
					)
				})
			}
			server.on('request', pushRequest)
			server.on('error', (err) => {
				// TODO interrupt and push error?
				console.error(err)
			})
			if (options.httpsPort) {
				if (options && !options.extraStreamRoot) {
					streamIDs[root] = { httpPort: options.httpPort, httpsPort: options.httpsPort }
				}
				serverS = serversS[options.httpsPort]
				if (!serverS) {
					serverS = options.serverOptions ? createServerS(options.serverOptions) : createServerS()
					serversS[options.httpsPort] = serverS
					serverS.listen(options.httpsPort, () => {
						console.log(
							`Redioactive: HTTP/S source: HTTPS server push for stream ${root} listening on ${options.httpsPort}`
						)
					})
				}
				serverS.on('request', pushRequest)
				serverS.on('error', (err) => {
					// TODO interrupt and push error?
					console.error(err)
				})
			}
		}

		info = literal<PushInfo>({
			type: 'push',
			protocol: ProtocolType.http,
			root,
			idType: IdType.counter,
			body: BodyType.primitive,
			delta: DeltaType.one,
			manifest: {},
			server,
			serverS,
			httpPort: options.httpPort,
			httpsPort: options.httpsPort
		})

		return () =>
			new Promise<Liquid<T>>((resolve, _reject) => {
				// console.log('Calling pushPull()')
				pushPull()
				pushResolver = resolve
			})
	} // end PUSH

	function pushRequest(req: IncomingMessage, res: ServerResponse) {
		if (req.url && isPush(info)) {
			let path = req.url.replace(/\/+/g, '/')
			if (path.endsWith('/')) {
				path = path.slice(0, -1)
			}
			if (path.startsWith(info.root)) {
				const id = path.slice(info.root.length + 1)
				// console.log(
				// 	`Processing ${req.method} with url ${
				// 		req.url
				// 	} and ${typeof id} id ${id}, expected ${nextExpectedId}`
				// )
				if (req.method === 'POST') {
					if (id === 'end') {
						return endStream(req, res)
					}
					if (id === 'manifest.json') {
						let value = ''
						req.setEncoding('utf8')
						req.on('data', (chunk: string) => {
							value += chunk
						})
						let idType = req.headers['redioactive-idtype']
						if (Array.isArray(idType)) {
							idType = idType[0]
						}
						info.idType = <IdType>idType || IdType.counter
						let delta = req.headers['redioactive-deltatype']
						if (Array.isArray(delta)) {
							delta = delta[0]
						}
						info.delta = <DeltaType>delta || DeltaType.one
						let body = req.headers['redioactive-bodytype']
						if (Array.isArray(body)) {
							body = body[0]
						}
						info.body = <BodyType>body || BodyType.primitive

						let nextId = req.headers['redioactive-nextid']
						if (Array.isArray(nextId)) {
							nextId = nextId[0]
						}
						if (nextId) {
							nextExpectedId = info.idType === 'string' ? nextId : +nextId
						}

						req.on('end', () => {
							info.manifest = JSON.parse(value)
							res.statusCode = 201
							res.setHeader('Location', `${info.root}/manifest.json`)
							res.end()
						})
						return
					}
					if (id === nextExpectedId.toString()) {
						if (!req.headers['content-length']) {
							throw new Error('Redioactive: HTTP/S target: Content-Length header expected')
						}
						let value =
							info.body === BodyType.blob ? Buffer.allocUnsafe(+req.headers['content-length']) : ''
						const streamSaysNextIs = req.headers['redioactive-nextid']
						nextExpectedId = Array.isArray(streamSaysNextIs)
							? +streamSaysNextIs[0]
							: streamSaysNextIs
							? +streamSaysNextIs
							: id
						if (info.body !== BodyType.blob) {
							req.setEncoding('utf8')
						}
						let bufferPos = 0
						// console.log('About to wait on pushPull', req.url, pushPullP)
						pushPullP.then(() => {
							pushPullP = new Promise((resolve) => {
								pushPull = resolve
							})
							req.on('data', (chunk: string | Buffer) => {
								if (!chunkIsString(value)) {
									bufferPos += (<Buffer>chunk).copy(value, bufferPos)
								} else {
									value += <string>chunk
								}
							})
							req.on('end', () => {
								let t: T
								if (info.body === BodyType.blob) {
									const s = <Record<string, unknown>>{}
									if (value.length > 0) {
										s[(options && options.blob) || 'blob'] = value
									}
									let details = req.headers['redioactive-details'] || '{}'
									if (Array.isArray(details)) {
										details = details[0]
									}
									t = <T>Object.assign(s, JSON.parse(details))
								} else {
									t = <T>JSON.parse(<string>value)
								}
								if (typeof t === 'object') {
									if (
										Object.keys(t).length === 1 &&
										Object.prototype.hasOwnProperty.call(t, 'end') &&
										(<Record<string, unknown>>t)['end'] === true
									) {
										pushResolver(end)
										endStream(req)
										res.statusCode = 200
										res.end()
										return
									}
									if (options && typeof options.manifest === 'string') {
										;(<Record<string, unknown>>t)[options.manifest] = info.manifest
									}
									if (options && options.seqId) {
										;(<Record<string, unknown>>t)[options.seqId] = id
									}
									if (options && typeof options.delta === 'string') {
										switch (info.delta) {
											case DeltaType.one:
												;(<Record<string, unknown>>t)[options.delta] = 1
												break
											case DeltaType.variable:
											case DeltaType.fixed:
												;(<Record<string, unknown>>t)[options.delta] =
													<number>nextExpectedId - <number>+id
												break
											default:
												break
										}
									}
								}
								pushResolver(t)
								res.statusCode = 201
								res.setHeader('Location', `${info.root}/$id`)
								res.end()
							})
						}) // Read data only when ready
					}
					return
				}
				if (req.method === 'GET') {
					if (id === 'debug.json') {
						return debug(res)
					}
					if (id === 'end') {
						return endStream(req, res)
					}
					if (id === 'manifest.json') {
						return sendManifest(res)
					}
				}
			}
		}
		noMatch(req, res)
	}

	function debug(res: ServerResponse) {
		const keys: Array<string> = []
		// for (const key of tChest.keys()) {
		// 	keys.push(key)
		// }
		const debugInfo = {
			info,
			uri,
			url,
			streamIDs,
			options,
			// ended,
			// lowestOfTheLow,
			// lowWaterMark,
			// highWaterMark,
			// nextId,
			keys
		}

		const debugString = JSON.stringify(debugInfo, null, 2)
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', `${Buffer.byteLength(debugString, 'utf8')}`)
		res.end(debugString, 'utf8')
	}

	function sendManifest(res: ServerResponse) {
		const maniString = JSON.stringify(info.manifest)
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', `${Buffer.byteLength(maniString, 'utf8')}`)
		res.end(maniString, 'utf8')
	}

	function endStream(req: IncomingMessage, res?: ServerResponse) {
		const isSSL = Object.prototype.hasOwnProperty.call(req.socket, 'encrypted')
		const port = req.socket.localPort
		pushPull()
		pushPullP = Promise.resolve()
		if (isPush(info)) {
			try {
				info.server &&
					info.server.close(() => {
						isPush(info) && delete streamIDs[info.root]
						console.log(
							`Redioactive: HTTP/S target: ${isSSL ? 'HTTPS' : 'HTTP'} push server for stream ${
								(isPush(info) && info.root) || 'unknown'
							} on port ${port} closed.`
						)
					})
				info.serverS &&
					info.serverS.close(() => {
						isPush(info) && delete streamIDs[info.root]
						console.log(
							`Redioactive: HTTP/S target: ${isSSL ? 'HTTPS' : 'HTTP'} push server for stream ${
								(isPush(info) && info.root) || 'unknown'
							} on port ${port} closed.`
						)
					})
				if (res) {
					res.setHeader('Content-Type', 'application/json')
					res.setHeader('Content-Length', 2)
					res.end('OK', 'utf8')
				}
				delete streamIDs[info.root]
				if (
					!Object.values(streamIDs).some(
						(x) =>
							isPush(info) &&
							((x.httpPort && x.httpPort === info.httpPort) ||
								(x.httpsPort && x.httpsPort === info.httpsPort))
					)
				) {
					isPush(info) && info.httpPort && delete servers[info.httpPort]
					isPush(info) && info.httpsPort && delete serversS[info.httpsPort]
				}
			} catch (err) {
				console.error(
					`Redioactive: HTTP/S target: error closing ${info.protocol} ${info.type} stream: ${err.message}`
				)
			}
		}
	}

	function chunkIsString(_x: string | Buffer): _x is string {
		return info.body !== BodyType.blob
	}
}
