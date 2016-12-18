# borc-refs

A fork of [borc](https://github.com/dignifiedquire/borc) which is itself a fork of (node-cbor)[https://github.com/hildjj/node-cbor].  Adds support for detecting, transmitting, and reconstructing shared values (including cycles and lattices), using [the cbor value-sharing extension](http://cbor.schmorp.de/value-sharing), which uses semantic tags 28 and 29.

Additions in this fork

1.  The decoder handles tags 28 and 29, re-constructing any shared values.  This doesn't cost anything, so it's always on.

2.  Added encodeAll, to give a convenient way to give options to the encoder, and take a special option (below).

3.  Added the Encoder option pleaseKeep.  Value is an array of objects that you want to be sent as shared values.

4.  Added the option "sharing" for encodeAll.  When true, the encoder detects all shared objects (by attaching a Symbol) doing a discarded run of encodeAll.  It then runs encodeAll again with pleaseKeep set to all the shared objects it found (and to remove the Symbol).

5.  Added depth checking, with an encoder maxDepth option.   If structures are too deep, an error is thrown saying to set a higher maxDepth or possibly turn on sharing.  Without this, when you hit a circular structure (without having set sharing true), you get a stack overflow which is hard to diagnose.

6.  Added a "kept" option to both Encoder and Decoder, allowing the caller to specify the array to use for remembering shared values.   kept[n] is the nth shared value.

## Tests

For now my tests use ava like (node-cbor)[https://github.com/hildjj/node-cbor] because that's where I first started this project.

## License

MIT
