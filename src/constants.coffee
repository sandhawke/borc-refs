class MT
  @POS_INT:      0
  @NEG_INT:      1
  @BYTE_STRING:  2
  @UTF8_STRING:  3
  @ARRAY:        4
  @MAP:          5
  @TAG:          6
  @SIMPLE_FLOAT: 7
exports.MT = MT

class TAG
  @DATE_STRING:         0
  @DATE_EPOCH:          1
  @POS_BIGINT:          2
  @NEG_BIGINT:          3
  @DECIMAL_FRAC:        4
  @BIGFLOAT:            5
  @BASE64URL_EXPECTED: 21
  @BASE64_EXPECTED:    22
  @BASE16_EXPECTED:    23
  @CBOR:               24
  @URI:                32
  @BASE64URL:          33
  @BASE64:             34
  @REGEXP:             35
  @MIME:               36
exports.TAG = TAG

class NUM_BYTES
  @ZERO:   0
  @ONE:   24
  @TWO:   25
  @FOUR:  26
  @EIGHT: 27
exports.NUM_BYTES = NUM_BYTES

class SIMPLE
  @FALSE: 20
  @TRUE: 21
  @NULL: 22
  @UNDEFINED: 23
exports.SIMPLE = SIMPLE