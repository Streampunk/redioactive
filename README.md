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
	.map((x) => x.toUpperCase())
	.each(console.log)
// output: A
//         B
//         C
//         D
```

Asynchronous stream processing regulated by the speed that values are created by a _funnel_.

```typescript
import redio, { Funnel, end } from 'redioactive'

const wait = (t: number) => new Promise<number>((r) => setTimeout(() => r(t), t * 500))
function addWait(n: number): Funnel<number> {
	let count = 0
	return async () => (count < n ? await wait(++count) : end)
}
redio<number>(addWait(4))
	.doto((x) => console.log('doto', x))
	.toArray()
	.then(console.log)
// output: doto 1  (after 0.5 s, then wait 1.0s)
//         doto 2  (then wait 1.0s)
//         doto 3  (then wait 1.5s)
//         doto 4
//         [ 1, 2, 3, 4 ]
```

Asynchronous stream processing regulated by the speed of the consumer, known as a _spout_.

```typescript
import redio, { Spout, Liquid } from 'redioactive'

const wait = (t: number) => new Promise((r) => setTimeout(() => r(t), t * 500))
const addWait: Spout<number> = async (n: Liquid<number>) => {
	if (typeof n === 'number') console.log(await wait(n))
}

redio([1, 2, 3, 4])
	.doto((x) => console.log('doto', x))
	.spout(addWait)
// output: doto 1  (without delay)
//         doto 2
//         doto 3
//         doto 4
//         1  (after 0.5s)
//         2  (after 1.0s)
//         3  (after 1.5s)
//         4  (after 2.0s)
```

To see back pressure in action, replace the last line of the previous example with:

```typescript
redio([1, 2, 3, 4, 5, 6], { bufferSizeMax: 2 })
	.doto((x) => console.log('doto', x))
	.spout(addWait)
```

### Concepts

#### Streams

_Streams_ have a beginning, a middle and an end. _Values_ are _produced_ at a stream input, get transformed along the way and are _consumed_ at the end.

Redioactive streams are typed and consist of a _liquid_ of a given type `T` (`Liquid<T>`). Values of `T` flow down a stream in order, so if no processing is added in the middle, the same elements that flow into the stream flow out of the the other end.

Processing placed along a stream may transforms a stream by consuming values of type `T` and producing values on a stream of type `S`. The flow rate along the stream may vary:

- processing may produce exactly one value of type `S` for every value of type `T`, eg. accumulating an average string length, producing a stream of `Liquid<number>` for every input value of type `Liquid<string>`
- processing may produce more values of type `S` than it consumes from values of type `T` - a _one-to-many_ relationship, eg. a stream of paragraphs of type `Liquid<string>` converted to a stream of the length of each word, output stream type `(LotsOf)Liquid<number>`.
- processing may produce less values of type `S` than it consumes of type `T` - a _many-to-one_ relationship, eg. a stream of counts of the number of input strings (`Liquid<string>`) that match a regular expression, incrementing on every match to produce a stream of `Liquid<number>`

The purpose of readioactive is to ensure that the flow rate is balanced between the producers and the consumers:

- limiting the speed of a busy producer to meet the flow rate at the consumer using [_back pressure_](https://www.reactivemanifesto.org/glossary#Back-Pressure) ...
- while using buffers to ensure that a consumer is not left waiting for values to flow along the entire stream when it is next hungry for more

#### Pipes and fittings

Streams flow along _pipes_ (a `RedioPipe`) and a stream (`RedioStream`) should only be accessed (consumed) at its end. Pipes are constructed in sections with a _fitting_ at both ends. Different kinds of fittings are used at different points along a pipe:

- _funnels_ at the start of pipes, receiving values from sources such as Node streams, arrays, generator functions, event emitters etc.
- _valves_ connect two pipe sections together, with options to split or join pipes, store values in reservoirs and change flow rate and/or stream type
- _spouts_ are the end of the stream, where it leaves redioative and enters another realm, such as resolving promises, writing to Node streams, emitting events etc..

Fittiings are the building blocks for creating streams with redioactive and are expressed as functions that return a promise to produce zero, one or more values of type `T`. Specifically:

- A `Funnel<T>` fitting is a [_thunk_](https://en.wikipedia.org/wiki/Thunk) function that generates a new value for the stream every time it is called. It is important that this is a function that will create a new value or promise every time it is called. If a promise, the time taken to resolve will regulate the speed that the stream is produced and the thunk is called again. Built-in funnels are functions exported by redioactive as `default`.
- A `Valve<S, T>` fitting receives a value of type `S` from the stream and tranforms it into a stream of the same or a different type `T`, with the ability to regulate the stream by returning a promise. Many-to-one valve functions may be created within a [closure](<https://en.wikipedia.org/wiki/Closure_(computer_programming)>) to allow a side-effect reservior of state to be built up.
- A `Spout<T>` receives values at the end of the stream and takes some side effect action. If that action is asynchronous, the spout returns a promise and the time taken to resolve regulates the flow upstream.

#### Create with types

Be creative with types! All of the [basic](https://www.typescriptlang.org/docs/handbook/basic-types.html) and [advanced](https://www.typescriptlang.org/docs/handbook/advanced-types.html) type structures of Typescript are available to construct the values of a stream of type `T`. This includes:

- all the primitive types
- `object`, `Object`, `{}` and `any`
- arrays, functions
- classes and interfaces with inheritence (eg. `interface Square extends Shape { }`)
- intersection and union types (eg. `Apple | Pear | Orange`)
- generics (e.g. `Bucket<Things>`)
- type aliases (e.g. `type Fruit = Apple | Tomato`)
- Node.js `Buffer`

Redioactive brings the benefits of Typescript's strong typing to reactive streams programming with Javascript. All kinds of values can flow down a stream and designing the type system will be the key to developing stream-based applications.

### Features

#### Promises just work

Expressing asynchronous work as promises is becoming the defacto approach for Javascript and Typescript developers, replacing callbacks. Express asynchronous processing for each stream element as a promise, delaying resolution where it is necessary to regulate the flow.

#### Fork and zip

Streams can be split into two or more branches using `fork` and `observe` fittings. Forked streams share back pressure between each branch so that the slowest stream regulates the flow. For observed streams, one mainline branch is used to regulate flow and the observers must either keep up or the pipe will leak values!

Streams can be joined together using the `zip` and `zipEach` fittings. In this case, any upstream back pressure regulates the flow of all incoming streams.

#### HTTP/S stream clustering

Streams can be distributed for processing on more than one computer using HTTP or HTTPS (HTTP/S). One of the benefits of distributed reactive stream processing is that both back pressure and network delay regulate the overall flow of the stream. This is inherent to the network protocols and does not require the use of, for example, shared clocks between systems, thus enabling local stream work to be moved remotely. The processing will self-optimize to suit the environment, minimising end-to-end latency while adapting to bandwidth conditions.

There are some limitations for this implemention though:

- Values must be one of:
  - An object that can be serialized to JSON (ie. no circular references)
  - A single `Buffer` or buffer-like object
  - A flat JSON object (properties become HTTP headers) describing a single `Buffer` property
- It should be possible to uniquely identify both the stream and each value of the stream and its _next_ value.
- Some knowledge of the cadence of the stream - the duration in time between the production of each value - may help to manage the performance.

If the stream is suitable for transport over HTTP/S, create an HTTP spout with the RedioPipe `http` method. Receive the HTTP/S stream with an _HTTP funnel_.

HTTP/S streams have a number of configurations:

- PUSH or PULL: A stream can be pushed from the source to destination using HTTP/S POST requests or PULLed from a source to a target via HTTP/S GET requests
- Sequential or parallel: Maintaining stream order, multiple parrallel connections allow a stream to be pushed or pulled on one or more sequential connections
- Whole or chunked: Binary payloads can be split into separate pieces, transported and then re-asembled - in combination with paralle this may lower latency

See the documentation on `HTTPOptions` for more information.

### Higher-order functions

### Usage

This is a self-documenting API. Fire up your IDE and hover over the method descriptions to find out more. This section provides some general pointers.

#### Creating a stream

The default exported function of redioactive can be used to create streams from common kinds of stream source in Node.js, including Iterables, Streams and Event Emitters.

```typescript
```

#### Ending a stream

#### One-to-many

#### Many-to-one and nil

#### Error handling

#### Debugging

### License

[MIT](/LICENSE)
