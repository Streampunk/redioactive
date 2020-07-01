/* Code for receiving values over HTTP/S. */

import { HTTPOptions, Funnel, nil, Liquid } from "./redio";

// Ideally needs to be a funnel, so () => Promise<T>

export function httpTarget<T>(_options: HTTPOptions): Funnel<T> {
    return () => new Promise<Liquid<T>>((resolve, _reject) => {
        resolve(nil)
    })
}  