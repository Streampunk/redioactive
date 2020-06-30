# Redioactive
Redioactive is a [reactive streams](https://www.reactive-streams.org/) library for [Node.js](https://nodejs.org/en/), designed to work with [Javascript's built-in promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) and [typescript types](https://www.typescriptlang.org/docs/handbook/basic-types.html). The motivation for its development is for the processing of media streams at or faster than real time on non-real time computer systems. Redioactive can enable the processing of streams across computer systems.

Designed for the _async/await with typescript generation_, this library is inspired by [Highland.js](https://caolan.github.io/highland/) and adds support for configurable value buffers at each stage.

### Up and running

#### Installation

Use your favorite package manager to install redioactive for you application. This is a runtime library.

    npm install redioactive

    yarn add redioactive

#### Examples

Enirely synchronous processing of values as streams.

```typescript
import redio from 'redioactive'

redio(['a', 'b', 'c', 'd'])
    .map(x => x.toUpperCase())
    .each(console.log) 
// output: A
//         B
//         C
//         D
```

Asynchronous stream processing regulated by the speed that values are created by a _funnel_.

```typescript
import redio, { Funnel, end } from 'redioactive'

const wait = (t: number) => new Promise(r => setTimeout(() => r(t), t * 500))
function addWait (n: number): Funnel<number> { 
    let count = 0 // Closure used here to limit stream length
    return async () => (count < n) ? await wait(++count) : end 
} 
redio<number>(addWait(4)).doto(console.log).toArray().then(console.log)
// output: doto 1  (after 0.5 s, then wait 1.0s)
//         doto 2  (after 1.0s)
//         doto 3  (after 1.5s)
//         doto 4 
//         [ 1, 2, 3, 4 ]
```

Asynchronous stream processing regulated by the speed of the consumer, known as a _spout_.

```typescript
import redio, { Spout, Liquid } from 'redioactive'

const wait = (t: number) => new Promise(r => setTimeout(() => r(t), t * 500))
const addWait: Spout<number> = async (n: Liquid<number>) => { 
    if (typeof n === 'number') console.log(await wait(n)) }

redio([1, 2, 3, 4]).doto(x => console.log('doto', x)).spout(addWait)
// outut: doto 1  (without delay)
//        doto 2  (without delay)
//        doto 3  (without delay)
//        doto 4  (without delay)
//        1  (after 0.5s)
//        2  (after 1.0s)
//        3  (after 1.5s)
//        4  (after 2.0s)
```

To see back pressure in action, replace the last line of the previous example with:

```typescript
redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 }).doto(x => console.log('doto', x)).spout(addWait)
```

### Concepts

#### Streams

_Streams_ have a beginning, a middle and an end. _Values_ are _produced_ at a stream input, get transformed along the way and are _consumed_ at the end.

Redioactive streams are typed and consist of a _liquid_ of a given type `T` (`Liquid<T>`). Values of `T` flow down a stream in order, so if no processing is added in the middle, the same elements that flow into the stream flow out of the the other end.

Processing placed along a stream may transforms a stream by consuming values of type `T` into and producing values on a stream of type `S`. The flow rate along the stream may vary:

* processing may produce exactly one value of type `S` for every value of type `T`, eg. accumulating an average string length, producing a stream of `Liquid<number>` for every value input value `Liquid<string>`
* processing may produce more values of type `S` than it consumes from value of type `T` - a _one-to-many_ relationship, eg. a stream of paragraphs of type `Liquid<string>` converted to a stream of the length of each word, output stream type `(LotsOf)Liquid<number>`. 
* processing may produce less values of type `S` than it consumes of type `T` - a _many-to-one_ relationship, eg. a stream of counts of the number of input strings (`Liquid<string>`) that match a regular expression, creating a stream of `Liquid<number>`

The purpose of readioactive is to ensure that the flow rate is balanced between the producers and the consumers:

* limiting the speed of a busy producer to meet the flow rate at the consumer using _back pressure_ ...
* while ensuring a consumer is not left waiting for values to flow along the entire stream when it is next hungry for more

#### Pipes and fittings

Streams flow along _pipes_ (a `RedioPipe`) and a stream (`RedioStream`) can only be accessed (consumed) at its end. Pipes are constructed in sections with a _fitting_ at each end. Different kinds of fittings are used at different points along a pipe:

* _funnels_ at the start of pipes, receiving values from sources such as Node streams, arrays, generator functions, event emitters etc.
* _valves_ connect two pipe sections together, with options to split or join pipes, store values in reservoirs and change flow rate and/or stream type
* _spouts_ are the end of the stream, where it leaves redioative and enters another realm, such as resolving promises, writing to Node streams, omitting events etc..

Fittiings are the building blocks for creating streams with redioactive and are expressed as functions that return a promise to produce zero, one or more values of type `T`. Specifically:

* A `Funnel<T>` fitting is a [_thunk_](https://en.wikipedia.org/wiki/Thunk) function that generates a new value for the stream every time it is called. It is **vital** that this is a function that will create a new value or promise every time it is called. If a promise, the time taken to resolve will regulate the speed that the stream is produced and the thunk is called again.
* A `Valve<S, T>` fitting receives a value of type `S` from the stream and tranforms it into a stream of the same or a different type `T`, with the ability to regulate the stream by returning a promise. Many-to-one valve functions may be created within a [closure](https://en.wikipedia.org/wiki/Closure_(computer_programming)) to allow a side-effect reservior of state to be built up.
* A `Spout<T>` receives values at the end of the stream and takes some side effect action. If that action is asynchronous, the spout returns a promise and the time taken to resolve regulates the flow upstream.

#### Create with types

Be creative with types! All of the basic and advanced type structures of Typescript are available to construct the values of a stream of type `T`. This includes:

* all the primitive types
* object, Object, {} and any
* arrays, functions, classes with inheritence
* intersection and union types
* interfaces and index types
* type aliases

The intention is to bring the benefits of Typescript strong typing to reactive streams programming with Javascript


### Features

### Observe and join

### HTTP/S clustering


### Usage

This is a self-documenting API. Fire up your IDE and hover over the method descriptions to find out more.

### License

[MIT](/LICENSE)

