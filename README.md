# borc-refs

A fork of [borc](https://github.com/dignifiedquire/borc) which is itself a fork of [node-cbor](https://github.com/hildjj/node-cbor).  Adds support for detecting, transmitting, and reconstructing shared values (including cycles and lattices), using [the cbor value-sharing extension](http://cbor.schmorp.de/value-sharing) (semantic tags 28 and 29).

This isn't a github fork because I already had a fork of [node-cbor](https://github.com/hildjj/node-cbor) and github wont allow that, as far as I can tell.

Additions in this fork:

1.  The decoder handles tags 28 and 29, re-constructing any shared values.  This is cheap, so it's always on.  It doesn't do anything unless you decode cbor data containing these tags.

2.  Added encodeAll(valueArray, options), to give a convenient way to give options to the encoder, and take a special option (below).

3.  Added the Encoder option pleaseKeep.  Value is an array of objects (in any order) that you want to be sent as shared values (whenever they are next encountereed in the Encoding process).

4.  Added the boolean option "sharing" for encodeAll.  Makes structure sharing, including cycles, just work (in theory).  There is a performance cost, so it's not always on.   Implemented as: the encoder detects all shared objects (by attaching a Symbol) while doing a discarded run of encodeAll.  It then runs encodeAll again with pleaseKeep set to any shared objects it found (and to remove the Symbol).  

5.  Added depth checking, with an encoder maxDepth option.   If structures are too deep, an error is thrown saying to set a higher maxDepth or possibly turn on sharing.  Without this, when you hit a circular structure (without having set sharing true), you get a vast stack overflow which is hard to diagnose.  Defaults to 20, which is enough for the test suite.

6.  Added a "kept" option to both Encoder and Decoder, allowing the caller to specify the array to use for remembering shared values.   Like, if you have a stream of cbor frames, and you want back-references to work for the whole stream, not just the frames.  kept[n] is the nth shared value.

## Issues

Maybe sharing should be a flag on Decoder, too?

Maybe sharing should default to on?

Right now, sharing is an option to Encoder.shareAll, not to Encoder.  That'd be nice to fix.

Lots of corner cases haven't been tested

## Tests

For now [my tests](https://github.com/sandhawke/borc-refs/blob/master/test/refs.ava.js) use [ava](https://github.com/avajs/ava) like [node-cbor](https://github.com/hildjj/node-cbor) because that's where I first started this project.

## License

MIT
