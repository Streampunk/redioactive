import { Spout, Liquid, HTTPOptions, literal, isNil, isEnd, RedioNil, RedioEnd } from './redio'
import { Server, createServer } from 'http'
import { Server as ServerS, createServer as createServerS} from 'https'
import { isError } from 'util'

/* Code for sending values over HTTP/S. */

const servers: { [port: number]: Server }= { }
const serversS: { [ port: number]: ServerS } = { }

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

interface PushInfo extends ConInfo {
    type: 'push'
}

export function httpSource<T>(uri: string, options: HTTPOptions): Spout<T> {
    const tChest: Array<T> = [] 
    let info: ConInfo 
    if (uri.toLowerCase().startsWith('http')) {
        info = literal<PushInfo>({
            type: 'push',
            protocol: uri.toLowerCase().startsWith('https') ? 'https' : 'http'
        })
    } else {
        let server: Server | undefined = undefined
        let serverS: ServerS | undefined = undefined
        if (options.httpPort) {
            server = servers[options.httpPort]
            if (!server) {
                server = createServer()
                servers[options.httpPort] = server
            }
        }
        if (options.httpsPort) {
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
            serverS,
        })
    } 

    console.log(info)
    
    return async (x: Liquid<T>): Promise<void> => {
        if (isEnd(x) || isNil(x) || isError(x)) {
            return
        }
        tChest.push(x)
    }
}