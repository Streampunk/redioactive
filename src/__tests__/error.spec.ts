import redio, { end, Funnel, nil } from '../redio'

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
					return nil
				})
				.toArray()
		).resolves.toEqual([])
		expect(errors).toHaveBeenCalledTimes(4)
	})
	test('Reject and extract errors', async () => {
		const errors = jest.fn()
		await expect(
			redio<number>(genny(true))
				.errors((e) => {
					errors(e)
					return nil
				})
				.toArray()
		).resolves.toEqual([])
		expect(errors).toHaveBeenCalledTimes(4)
	})
	test('No errors does not call errors', async () => {
		const errors = jest.fn()
		await expect(redio([1, 2, 3]).errors(errors).toArray()).resolves.toEqual([1, 2, 3])
	})
})
