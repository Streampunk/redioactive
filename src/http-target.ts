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
			console.log('Getting manifest response')
			res.on('end', () => {
				info.manifest = JSON.parse(manifestStr)
				console.log('Ending with a manifest', info.manifest, manifestStr)
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
				console.log('From the funnel', streamCounter, info.manifest, nextId)
				const valueReq = http.request(
					{
						hostname: url.hostname,
						protocol: url.protocol,
						port: url.port,
						path: `${info.root}/${currentId.toString()}`,
						method: 'GET'
					},
					(res) => {
						// TODO check status
						let valueStr = ''
						const streamSaysNextIs = res.headers['redioactive-nextid']
						currentId = Array.isArray(streamSaysNextIs)
							? +streamSaysNextIs[0]
							: streamSaysNextIs
							? +streamSaysNextIs
							: currentId
						res.setEncoding('utf8')
						res.on('data', (chunk: string) => {
							valueStr += chunk
						})
						res.on('end', () => {
							const value = JSON.parse(valueStr)
							if (
								typeof value === 'object' &&
								Object.keys(value).length === 1 &&
								value.end === true
							) {
								resolve(end)
							} else {
								resolve(value)
							}
						})
					}
				)
				valueReq.on('error', reject)
				valueReq.end()
			}, reject) // initialized promise complete
		})
}
