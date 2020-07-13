import { HTTPOptions, Funnel, Liquid, literal, end } from './redio'
import { ProtocolType, IdType, DeltaType, BodyType } from './http-common'
import http from 'http'
import { URL } from 'url'

interface ConInfo {
	type: 'push' | 'pull'
	protocol: ProtocolType
	root: string
	idType: IdType
	body: BodyType
	delta: DeltaType
	manifest: Record<string, unknown>
}

export function httpTarget<T>(uri: string, options?: HTTPOptions): Funnel<T> {
	if (!options) throw new Error('HTTP options must be specified - for now.')
	// Assume pull for now
	const url = new URL(uri, `http://localhost:${options.httpPort || options.httpsPort}`)
	let info: ConInfo
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
	} else {
		info = literal<ConInfo>({
			type: 'push',
			protocol: ProtocolType.http,
			root: url.pathname,
			idType: IdType.counter,
			body: BodyType.primitive,
			delta: DeltaType.one,
			manifest: {}
		})
		throw new Error('Push not implemented yet.')
	}
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
	const startReq = http.request(
		{
			hostname: url.hostname,
			protocol: url.protocol,
			port: url.port,
			path: `${info.root}/start`,
			method: 'GET'
		},
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

	const maniReq = http.request(
		{
			hostname: url.hostname,
			protocol: url.protocol,
			port: url.port,
			path: `${info.root}/manifest.json`,
			method: 'GET'
		},
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
			// console.log('Getting manifest response', res.headers['content-length'])
			res.on('end', () => {
				info.manifest = JSON.parse(manifestStr)
				// console.log('Ending with a manifest', info.manifest, manifestStr)
				manifestly = true
				if (starter) {
					initDone()
				}
			})
		}
	)
	maniReq.on('error', initError)
	maniReq.end()

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
				// console.log('From the funnel', streamCounter, info.manifest, nextId)
				const valueReq = http.request(
					{
						hostname: url.hostname,
						protocol: url.protocol,
						port: url.port,
						path: `${info.root}/${nextId.toString()}`,
						method: 'GET'
					},
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
						const value =
							info.body === BodyType.blob ? Buffer.allocUnsafe(+res.headers['content-length']) : ''
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
							if (info.body === BodyType.blob) {
								bufferPos += (<Buffer>chunk).copy(<Buffer>value, bufferPos)
							} else {
								;(<string>value) += <string>chunk
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
}
