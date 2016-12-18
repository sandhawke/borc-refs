# borc-refs

A fork of [borc](https://github.com/dignifiedquire/borc) which is itself a fork of [node-cbor](https://github.com/hildjj/node-cbor).  Adds support for detecting, transmitting, and reconstructing shared values (including cycles and lattices), using [the cbor value-sharing extension](http://cbor.schmorp.de/value-sharing), which uses semantic tags 28 and 29.

This isn't a github fork because I already had a fork of [node-cbor](https://github.com/hildjj/node-cbor) and github wont allow that, as far as I can tell.

Additions in this fork:

1.  The decoder handles tags 28 and 29, re-constructing any shared values.  This is cheap, so it's always on.  It doesn't do anything unless you decode cbor data containing these tags.

2.  Added encodeAll(valueArray, options), to give a convenient way to give options to the encoder, and take a special option (below).

3.  Added the Encoder option pleaseKeep.  Value is an array of objects (in any order) that you want to be sent as shared values.

4.  Added the boolean option "sharing" for encodeAll.  Makes structure sharing, including cycles, just work.  There a performance cost, so it's not always on.   Implemented as: the encoder detects all shared objects (by attaching a Symbol) while doing a discarded run of encodeAll.  It then runs encodeAll again with pleaseKeep set to any shared objects it found (and to remove the Symbol).  

5.  Added depth checking, with an encoder maxDepth option.   If structures are too deep, an error is thrown saying to set a higher maxDepth or possibly turn on sharing.  Without this, when you hit a circular structure (without having set sharing true), you get a vast stack overflow which is hard to diagnose.

6.  Added a "kept" option to both Encoder and Decoder, allowing the caller to specify the array to use for remembering shared values.   kept[n] is the nth shared value.

## Issues

Maybe sharing should be a flag on Decoder, too?

Maybe sharing should default to on?

Right now, sharing is an option to Encoder.shareAll, not to Encoder.  That'd be nice to fix.

Lots of corner cases haven't been tested

Hard to know a good maxDepth.   For the current test suite, maxDepth 10 covers all but 9 test, and maxDepth 50 covers everything except 'large input' and 'random data'.  For those tests, we need about 100,000!   So, maybe 50, and for those tests we'll set a larger maxDepth?

## Tests

For now [my tests](https://github.com/sandhawke/borc-refs/blob/master/test/refs.ava.js) use [ava](https://github.com/avajs/ava) like [node-cbor](https://github.com/hildjj/node-cbor) because that's where I first started this project.

## License

MIT
