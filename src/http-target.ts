/* eslint-disable @typescript-eslint/no-unused-vars */

/* Code for receiving values over HTTP/S. */

import { HTTPOptions, Funnel, nil, Liquid } from './redio'

// Ideally needs to be a funnel, so () => Promise<T>

export function httpTarget<T>(_options: HTTPOptions): Funnel<T> {
	return (): Promise<Liquid<T>> =>
		new Promise<Liquid<T>>((resolve, _reject) => {
			resolve(nil)
		})
}
