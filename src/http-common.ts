export enum ProtocolType {
	http = 'http',
	https = 'https',
	both = 'both'
}
export enum BodyType {
	primitive = 'primitive',
	json = 'json',
	blob = 'blob'
}
export enum IdType {
	counter = 'counter',
	number = 'number',
	string = 'string'
}
export enum DeltaType {
	one = 'one',
	fixed = 'fixed',
	variable = 'variable',
	string = 'string' // fixed name of next element
}
