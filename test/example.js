'use strict'
// const cbor = require('cbor-graph')  // or whatever this ends up called
const cbor = require('..')

let bytes
{
  const alice = { friends: [] }
  const bob = { friends: [] }
  alice.friends.push(bob)
  bob.friends.push(alice)
  alice.self = alice // even simpler demo
  const people = [ alice, bob ]

  bytes = cbor.encode(people)  // It works!  No infinite loop!
  console.log(cbor.diagnose(bytes))
  // => [28({"self": 29(0), "friends": [28({"friends": [29(0)]})]}), 29(1)]
}

{
  const people = cbor.decode(bytes)
  console.log('decoded:', people)
  // => decoded: [ { self: [Circular], friends: [ [Object] ] },
  //               { friends: [ [Object] ] } ]
  const [alice, bob] = people
  console.log(alice.friends.indexOf(bob) > -1 ? 'friend found!':false)
  // => friend found!
  console.log(bob.friends.indexOf(alice) > -1 ? 'friend found!':false)
  // => friend found!
}


