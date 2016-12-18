'use strict'

const cbor = require('../')
const test = require('ava')

function roundtrip (t, obj) {
  //console.log('roundtrip', obj)
  const bytes = cbor.encodeAll(obj, {sharing: true, canonical: true})
  //console.log('encoded as', bytes.toString('hex'))
  const out = cbor.decodeAllSync(bytes)
  t.deepEqual(out, obj)
  //console.log('decoded', out)
  t.is(cbor.encodeAll(out, {sharing: true, canonical: true}).toString('hex'),
       bytes.toString('hex'))
}


test('keep', t => {
  const a = []
  const b = []

  const bytes = cbor.encodeAll([a, b, a, b, a], {pleaseKeep: [a, b]})

  t.is(bytes.toString('hex'),
       'd81c80' +  // 28([])   mark the first array as to be shared
       'd81c80' +  // 28([])   and the second
       'd81d00' +  // 29(0)    refer to the first
       'd81d01' +  // 29(1)    and the second
       'd81d00'    // 29(0)    and the first again
      )

  roundtrip(t, [a,b,a,b,a])
})

test('unkeep', t => {
  let out = cbor.decodeAllSync(Buffer.from(
    'd81c01' + // 28(1) mark the int 1 for sharing
    'd81d00' + // 29(0) refer to it again
    'd81d00'   // 29(0) and again
    , 'hex'))
  t.deepEqual(out, [1,1,1])

  out = cbor.decodeAllSync(Buffer.from(
    'd81c80' +  // 28([])   mark the first array as to be shared
    'd81c80' +  // 28([])   and the second
    'd81d00' +  // 29(0)    refer to the first
    'd81d01' +  // 29(1)    and the second
    'd81d00'    // 29(0)    and the first again
    , 'hex'))
  t.deepEqual(out, [[], [], [], [], []])
  t.is(out[0], out[2])
  t.is(out[0], out[4])
  t.is(out[1], out[3])
  t.not(out[0], out[1])
})

test('detect cycle', t => {
  t.plan(1)
  const a = []
  a.push(a)

  const bytes = cbor.encode(a, { onCycle: (x) => {
    t.is(a,x)
  }})
})

test('detect shared', t => {
  t.plan(1)
  const b = []
  const a = [b,b]

  const bytes = cbor.encode(a, {
    onCycle: (x) => {
      t.fail()
    },
    onShared: (x) => {
      t.is(x, b)
    }
  })
})
     
test('cycle a=[a]', t => {
  const a = []
  a.push(a)

  const bytes = cbor.encodeAll([a], {cycles: true})
  t.not(bytes, null)
  t.is(bytes.toString('hex'),
       'd81c81d81d00' // 28([29(0)])
      )

  const out = cbor.decodeAllSync(bytes)
  
  roundtrip(t, [a])
})

test('cycle a=[[[a]]]', t => {
  const a = []
  a.push([[[a]]])

  const bytes = cbor.encodeAll([a], {cycles: true})
  t.is(bytes.toString('hex'),
       'd81c81818181d81d00' // 28([[[[29(0)]]]])
      )
  roundtrip(t, [a])
})

test('a=[a,a]', t => {
  const a = []
  a.push(a, a)

  const bytes = cbor.encodeAll([a], {cycles: true})
  t.is(bytes.toString('hex'),
       'd81c82d81d00d81d00' // 28([29(0), 29(0)])
      )

  roundtrip(t, [a])
})

test('two cycles', t => {
  const a = {}
  const b = {}
  a.a = a
  b.b = b
  const c = [a, b]

  const bytes = cbor.encodeAll([c], {cycles: true})
  t.is(bytes.toString('hex'),
       '82d81ca16161d81d00d81ca16162d81d01'// [28({"a": 29(0)}), 28({"b": 29(1)})]
      )
  roundtrip(t, [c])
})

/* 
test.skip('resolve simple', t => {
  let objs, keep, result

  objs = [1,2,[3,[4,new cbor.Tagged(29, 2)]]]
  keep = ['a', 'b', 'c', 'd']
  result = cbor.resolveReferences(objs, keep)
  t.deepEqual(objs, [1,2,[3,[4, 'c']]])
  t.is(result, 0)
})

test.skip('resolve with remaining', t => {
  let objs, keep, result

  let x
  objs = [1,2,[3,[4, x = new cbor.Tagged(29, 2)]]]
  keep = ['a', 'b', undefined, 'd']
  result = cbor.resolveReferences(objs, keep)
  t.deepEqual(objs, [1,2,[3,[4, x]]])
  t.is(result, 1)
})

test.skip('resolve with nested', t => {
  let objs, keep, result

  let x = new cbor.Tagged(29, 2)
  let y = new cbor.Tagged(29, 1)
  objs = [1,2,x]
  keep = ['a', 'b', y, 'd']
  result = cbor.resolveReferences(objs, keep)
  t.deepEqual(objs, [1,2,'b'])
  t.is(result, 0)
})

test.skip('resolve with evil nested', t => {
  let objs, keep, result

  let x = new cbor.Tagged(29, 2)
  objs = [1,2,x]
  keep = ['a', 'b', x, 'd']
  cbor.resolveReferences(objs, keep),
  t.is(objs[2], x)  // not really resolved.  Oh well.
})

*/ 

test('tangle 2a', t => {
  const a = []
  a.push(a)
  const b = [a]
  a.push(b)
  b.push(b)

  /*
  const b = {}
  a.push(b)
  b.a = a
  b.b = b
  */

  const bytes = cbor.encodeAll([a], {sharing:true})

  t.is(bytes.toString('hex'),
       'd81c82d81d00d81c82d81d00d81d01' // 28([29(0), 28([29(0), 29(1)])])
      )

  roundtrip(t, [a])
})

test('tangle 2b', t => {
  const a = {}
  const b = {}
  a.a = b
  b.b = b

  const bytes = cbor.encodeAll([a], {cycles:true, pleaseKeep:[a]})

  t.is(bytes.toString('hex'),
       'a16161d81ca16162d81d00' // {"a": 28({"b": 29(0)})}
      )

  roundtrip(t, [a])
})


test('tangle 2c', t => {
  const a = []
  const b = {}
  a.push(b)
  b.a = a
  // WORKS b.b = a
  b.b = b

  t.is(a[0].a, a)
  t.is(a[0].b, b)
  t.is(b.a, a)
  t.is(b.b, b)

  const bytes = cbor.encodeAll([a], {sharing:true})

  t.is(cbor.diagnose(bytes), '28([28({"a": 29(0), "b": 29(1)})])')
  roundtrip(t, [a])
})


test('tangle 4', t => {
  const a = []
  const b = {}
  const c = {}
  const d = []
  a.push(a,b,c,d)
  d.push(a,b,c,d)
  b.a = a
  b.b = b
  b.c = c
  b.d = d
  c.a = a
  c.b = b
  c.c = c
  c.d = d
  
  roundtrip(t, [a])
})

