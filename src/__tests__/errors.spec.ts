import redio, { end, Funnel } from '../redio'

describe('Testing the flow or errors', () => {
	function genny(reject: boolean): Funnel<number> {
		let counter = 0
		return async () => {
			if (counter++ < 4) {
				// console.log('Bang', counter)
				// return Promise.reject('Should go bang')
				if (reject) {
					return Promise.reject(`Bang reject ${counter}!`)
				}
				throw new Error(`Bang throw ${counter}!`)
			} else {
				return end
			}
		}
	}
	test('Throw and extract errors', async () => {
		const errors = jest.fn()
		await expect(
			redio<number>(genny(false))
				.errors((e) => {
					errors(e)
				})
				.toArray()
		).resolves.toEqual([])
		expect(errors).toHaveBeenCalledTimes(4)
		expect(errors).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ message: expect.stringContaining('Bang throw') })
		)
	})
	test('Reject and extract errors', async () => {
		const errors = jest.fn()
		await expect(
			redio<number>(genny(true))
				.errors((e) => {
					errors(e)
				})
				.toArray()
		).resolves.toEqual([])
		expect(errors).toHaveBeenCalledTimes(4)
		expect(errors).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ message: expect.stringContaining('Bang reject') })
		)
	})
	test('No errors does not call errors', async () => {
		const errors = jest.fn()
		await expect(redio([1, 2, 3]).errors(errors).toArray()).resolves.toEqual([1, 2, 3])
		expect(errors).not.toHaveBeenCalled()
	})
	test('Convert errors into values', async () => {
		const errors = (e: Error) => e.message
		await expect(redio(genny(false)).errors(errors).toArray()).resolves.toEqual([
			'Bang throw 1!',
			'Bang throw 2!',
			'Bang throw 3!',
			'Bang throw 4!'
		])
	})
	test('Transform error with throw', async () => {
		const errors = (e: Error) => new Error(`MORE ${e.message}`)
		await expect(redio(genny(false)).errors(errors).toArray()).rejects.toThrow(/MORE Bang throw/)
	})
	test('Transform error with reject', async () => {
		const errors = (e: Error) => new Error(`MORE ${e.message}`)
		await expect(redio(genny(true)).errors(errors).toArray()).rejects.toThrow(/MORE Bang reject/)
	})
	test.skip('Catch errors downstream', async () => {
		const eachFn = jest.fn()
		const catchFn = jest.fn()
		await expect(
			redio(genny(false)).errors(console.log).each(console.log).catch(catchFn).toPromise()
		).rejects.toBeTruthy()
		expect(eachFn).not.toHaveBeenCalled()
		expect(catchFn).toHaveBeenCalledTimes(4)
	})
})
