'use strict'
import redio, { nil } from '../redio'

describe('Test the each processing of values', () => {
	test('Each is called the expected number of times', async () => {
		const mockEach = jest.fn()
		await redio([1, 2, 3, 4]).each(mockEach).toPromise()
		expect(mockEach).toHaveBeenCalledTimes(4)
		expect(mockEach.mock.calls).toEqual([[1], [2], [3], [4]])
	})
	test('Empty stream, no calls', async () => {
		const mockEach = jest.fn()
		await redio([]).each(mockEach).toPromise()
		expect(mockEach).not.toHaveBeenCalled()
	})
	test('Done is called at the end', async () => {
		const mockEach = jest.fn()
		const mockDone = jest.fn()
		await redio([1, 2]).each(mockEach).done(mockDone).toPromise()
		expect(mockEach).toHaveBeenCalledTimes(2)
		expect(mockDone).toHaveBeenCalledTimes(1)
	})
	test('Done is called for empty streams', async () => {
		const mockEach = jest.fn()
		const mockDone = jest.fn()
		await redio([]).each(mockEach).done(mockDone).toPromise()
		expect(mockEach).not.toHaveBeenCalled()
		expect(mockDone).toHaveBeenCalledTimes(1)
	})
	test('Each and async work', async () => {
		const wait = jest.fn((t: number): Promise<void> => {
			return new Promise((resolve) => setTimeout(resolve, t))
		})
		await redio([100, 200, 300, 400]).each(wait, { debug: false }).toPromise()
		expect(wait).toHaveBeenCalledTimes(4)
		expect(wait).toHaveBeenLastCalledWith(400)
	})
	test('End with a promise', async () => {
		await expect(
			redio([301, 401, 501, 601])
				.each(() => {
					/* void */
				})
				.toPromise()
		).resolves.toEqual(601)
	})
	test('Empty strean end with promise', async () => {
		await expect(
			redio([])
				.each(() => {
					/* void */
				})
				.toPromise()
		).resolves.toEqual(nil)
	})
})
