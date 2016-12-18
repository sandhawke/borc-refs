'use strict'

const cbor = require('../')
const Benchmark = require('benchmark')
const assert = require('assert')

const s = new Benchmark.Suite

function deepCopy (x) {
  if (Array.isArray(x)) {
    return x.map(deepCopy)
  }
  if (x !== null && typeof x === 'object') {
    const result = {}
    for (const key of Reflect.ownKeys(x)) {
      result[key] = x[key]
    }
    return result
  }
  return x
}

//let s1 = [1, 2, 3, 'hello', 'world', -2, null, undefined, 6, [], {}]
let s1 = [1, 2, 3]
let s2 = deepCopy([s1, s1, s1, s1])
let s3 = deepCopy([s2, s2, s2, s2])
let s4 = deepCopy([s3, s3, s3, s3])
let c1 = ['some longer values',
          'where the individual values take more of the time',
          'to procees, you know, streaming out bytes']
let c2 = deepCopy([c1, c1, c1, c1])
let c3 = deepCopy([c2, c2, c2, c2])
let c4 = deepCopy([c3, c3, c3, c3])

console.log('checking round-trips...')
for (const valueName of ['c4' /*, '1', 's1', 's2', 's3', 's4'*/]) {
  const value = eval(valueName)
  if (valueName.startsWith('s')) eval(valueName + ' = [ "deactivated" ]')
  console.log('== value', valueName)

  for (const sharing of [false, true]) {

    console.log('.. sharing', sharing)
    
    let bytes
    let out
    let bytes2
    bytes = cbor.encodeAll([value], { sharing: sharing, maxDepth: 5 })
    //console.log('   bytes:', bytes.toString('hex'))
    out = cbor.decodeAll(bytes)[0]
    assert.deepEqual(value, out)
    bytes2 = cbor.encodeAll([out], { sharing: sharing, maxDepth: 5 })
    assert(bytes.equals(bytes2))
    
    s.add('encode ' + valueName + ' sharing=' + sharing, () => {
      bytes = cbor.encodeAll([value], { sharing: sharing })
    })
  }
}

console.log('benchmarking...')
s.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  // console.log('Fastest is ' + this.filter('fastest').map('name'));
})
// run async 
.run({ 'async': true });
