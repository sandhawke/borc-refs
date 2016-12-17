'use strict'

const cbor = require('../')
const assert = require('assert')

let hex, out

hex =
    'd81c820102' +  // 28([1,2])   mark the first array as to be shared
    'd81c820202' +  // 28([2,2])   and the second
    //'d81c80' +  // 28([1,2])   mark the first array as to be shared
    //'d81c80' +  // 28([2,2])   and the second
    'd81d00' +  // 29(0)    refer to the first
    'd81d01' +  // 29(1)    and the second
    'd81d00'    // 29(0)    and the first again

out = cbor.decodeAll(Buffer.from(hex, 'hex'))
console.log('decoded', out)
assert(out[0] === out[2])
assert(out[0] === out[4])
assert(out[1] === out[3])
assert(out[0] !== out[1])

// 28([29(0), 29(0)])
hex =
  'd81c82d81d00d81d00'
out = cbor.decode(Buffer.from(hex, 'hex'))
console.log('decoded', out)
//console.log('=>>', out[0][1].ref[1])
{
  const a = out[0]
  assert(a === a[0])
  assert(a === a[1])
}


