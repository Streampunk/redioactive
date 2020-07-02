import { Spout, Liquid, HTTPOptions, literal, isNil, RedioEnd, isEnd } from './redio'
import { Server, createServer, IncomingMessage, ServerResponse } from 'http'
import { Server as ServerS, createServer as createServerS } from 'https'
import { isError } from 'util'

/* Code for sending values over HTTP/S. */

const servers: { [port: number]: Server } = {}
const serversS: { [port: number]: ServerS } = {}
const streamIDs: { [sid: string]: { httpPort?: number; httpsPort?: number } } = {}

interface ConInfo {
	type: 'pull' | 'push'
	protocol: 'http' | 'https' | 'both'
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
	const tChest: Array<T | RedioEnd> = []
	let info: ConInfo
	const url = new URL(uri)
	if (uri.toLowerCase().startsWith('http')) {
		info = literal<PushInfo>({
			type: 'push',
			protocol: uri.toLowerCase().startsWith('https') ? 'https' : 'http'
		})
	} else {
		let server: Server | undefined = undefined
		let serverS: ServerS | undefined = undefined
		if (options.httpPort) {
			streamIDs[url.pathname] = { httpPort: options.httpPort, httpsPort: options.httpsPort }
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
				console.log(err)
			})
		}
		if (options.httpsPort) {
			streamIDs[url.pathname] = { httpPort: options.httpPort, httpsPort: options.httpsPort }
			serverS = serversS[options.httpsPort]
			if (!serverS) {
				serverS = createServerS()
				serversS[options.httpsPort] = serverS
			}
		}

		info = literal<PullInfo>({
			type: 'pull',
			protocol: server && serverS ? 'both' : serverS ? 'https' : 'http',
			httpPort: options.httpPort,
			httpsPort: options.httpsPort,
			server,
			serverS
		})
	}

	console.log(info)

	function pullRequest(req: IncomingMessage, res: ServerResponse) {
		if (res.writableEnded) return
		console.log(req)
		console.log(res)
		noMatch(req, res)
	}

	return async (x: Liquid<T>): Promise<void> => {
		if (isNil(x) || isError(x)) {
			return
		}
		tChest.push(x)
		if (isEnd(x) && isPull(info)) {
			setTimeout(() => {
				isPull(info) && info.server && info.server.close()
			}, 10000)
		}
		return wait(1000)
	}
}
