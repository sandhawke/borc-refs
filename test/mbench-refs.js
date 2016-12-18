'use strict'

const N = 1e3;

const cbor = require('../')
const benchmark = require('micro-benchmark')
const assert = require('assert')

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
let s1 = [1, 2, 3, 4]  // 1 branch, 4 leaves
let s2 = deepCopy([s1, s1, s1, s1]) // 5 branches, 16 leaves
let s3 = deepCopy([s2, s2, s2, s2]) // 17 branches, 64 leaves
let s4 = deepCopy([s3, s3, s3, s3]) // 65 branches, 256 leaves
let c1 = ['some longer values',
          'where the individual values take more of the time',
          'to procees, you know, streaming out bytes',
          'and I dont know what to say next, really....'
         ]
let c2 = deepCopy([c1, c1, c1, c1])
let c3 = deepCopy([c2, c2, c2, c2])
let c4 = deepCopy([c3, c3, c3, c3])

const specs = []

console.log('checking round-trips...')
for (const valueName of ['c4', '1', 's1', 's2', 's3', 's4']) {
  const value = eval(valueName)
  if (valueName.startsWith('s')) eval(valueName + ' = [ "deactivated" ]')
  console.log('== value', valueName)

  for (const options of [{note:'ignore share'},
                         {note:'sharing=true', sharing:true},
                         {note:'notice sharing', onShared: ()=>true},
                         {note:'notice cycles', onCycle: ()=>true}]) {

    console.log('.. options', options.note)
    
    let bytes
    let out
    let bytes2
    bytes = cbor.encodeAll([value], options)
    //console.log('   bytes:', bytes.toString('hex'))
    out = cbor.decodeAll(bytes)[0]
    assert.deepEqual(value, out)
    bytes2 = cbor.encodeAll([out], options)
    assert(bytes.equals(bytes2))

    specs.push({
      name: 'encode ' + valueName + ' options ' + options.note,
      fn: () => {
        for (var i = 0; i < N; ++i) {
          bytes = cbor.encodeAll([value], options)
        }
      }
    })
               
  }
}

console.log('benchmarking...')

var result = benchmark.suite({
  duration: 100, // optional 
  maxOperations: 1000, // optional 
  specs: specs
});
 
var report = benchmark.report(result, { chartWidth: 5 /* 30 is default */ });
console.log('(Times are per', N, 'operations)')
console.log(report);
 
/*
(Times are per 1000 operations)
Name                                Operations per second    Average time, ms
encode 1 options ignore share       930                      1                   =====>
encode 1 options notice sharing     760                      1                   ====>
encode 1 options notice cycles      700                      1                   ====>
encode s1 options ignore share      294                      3                   ==>
encode s1 options notice sharing    277                      4                   =>
encode s1 options notice cycles     260                      4                   =>
encode 1 options sharing=true       238                      4                   =>
encode s1 options sharing=true      158                      6                   =>
encode s2 options ignore share      86                       12                  >
encode s2 options notice sharing    83                       12                  >
encode s2 options notice cycles     77                       13                  >
encode s2 options sharing=true      60                       17                  >
encode s3 options ignore share      22                       46                  >
encode s3 options notice sharing    21                       47                  >
encode s3 options notice cycles     20                       51                  >
encode s3 options sharing=true      19                       54                  >
encode s4 options notice sharing    5                        184                 >
encode s4 options ignore share      5                        186                 >
encode s4 options notice cycles     5                        197                 >
encode s4 options sharing=true      5                        198                 >
encode c4 options notice sharing    4                        258                 >
encode c4 options ignore share      4                        279                 >
encode c4 options sharing=true      3                        286                 >
encode c4 options notice cycles     3                        289                 >

*/
