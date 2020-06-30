import redio from '../index'

redio(['a', 'b', 'c', 'd'])
    .map(x => x.toUpperCase())
    .each(console.log)
// output: A
//         B
//         C
//         D
