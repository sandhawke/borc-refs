'use strict'

const debugM = require('debug')
const debug = debugM('encoder')
const url = require('url')
const Bignumber = require('bignumber.js')

const utils = require('./utils')
const constants = require('./constants')
const MT = constants.MT
const NUMBYTES = constants.NUMBYTES
const SHIFT32 = constants.SHIFT32
const SYMS = constants.SYMS
const TAG = constants.TAG
const HALF = (constants.MT.SIMPLE_FLOAT << 5) | constants.NUMBYTES.TWO
const FLOAT = (constants.MT.SIMPLE_FLOAT << 5) | constants.NUMBYTES.FOUR
const DOUBLE = (constants.MT.SIMPLE_FLOAT << 5) | constants.NUMBYTES.EIGHT
const TRUE = (constants.MT.SIMPLE_FLOAT << 5) | constants.SIMPLE.TRUE
const FALSE = (constants.MT.SIMPLE_FLOAT << 5) | constants.SIMPLE.FALSE
const UNDEFINED = (constants.MT.SIMPLE_FLOAT << 5) | constants.SIMPLE.UNDEFINED
const NULL = (constants.MT.SIMPLE_FLOAT << 5) | constants.SIMPLE.NULL

const MAXINT_BN = new Bignumber('0x20000000000000')
const BUF_NAN = new Buffer('f97e00', 'hex')
const BUF_INF_NEG = new Buffer('f9fc00', 'hex')
const BUF_INF_POS = new Buffer('f97c00', 'hex')

/* We always color the objects using the same Symbol property, so that
 * we probably don't have to clean up after ourselves.  An earlier
 * version used a different boolean Symbol property for each run, but
 * the second pass to clean those up was pretty expensive, and in the
 * normal case, leaving a single extra property is harmless.  We might
 * just call it _borc_color to make it less confusing in debugging,
 * but then we'd have to skip it during encoding.  Of course we could
 * also just use a weakset. */
const COLOR = Symbol('shared object flag')

function toType (obj) {
  // [object Type]
  // --------8---1
  return ({}).toString.call(obj).slice(8, -1)
}

/**
 * Transform JavaScript values into CBOR bytes
 *
 */
class Encoder {
  /**
   * @param {Object} [options={}]
   * @param {function(Buffer)} options.stream
   */
  constructor (options) {
    options = options || {}

    this.streaming = typeof options.stream === 'function'
    this.onData = options.stream

    this._kept = options.kept || []
    this._pleaseKeep = options.pleaseKeep || []

    if (options.onCycle) {
      debug('onCycle provided; doing path checking')
      this._onCycle = options.onCycle
      this._path = []
      // turn coloring on, since we need it as a cheap first cut
      // (options.onShared may overwrite this, which is fine)
      this._onShared = () => true
      this._currentColor = Symbol()
    }

    if (options.onShared) {
      this._onShared = options.onShared
      this._currentColor = Symbol()
    }

    this.depth = 0
    this.maxDepth = options.maxDepth || 20

    this.semanticTypes = [
      [url.Url, this._pushUrl],
      [Bignumber, this._pushBigNumber]
    ]

    const addTypes = options.genTypes || []
    const len = addTypes.length
    for (let i = 0; i < len; i++) {
      this.addSemanticType(
        addTypes[i][0],
        addTypes[i][1]
      )
    }

    this._reset()
  }

  addSemanticType (type, fun) {
    const len = this.semanticTypes.length
    for (let i = 0; i < len; i++) {
      const typ = this.semanticTypes[i][0]
      if (typ === type) {
        const old = this.semanticTypes[i][1]
        this.semanticTypes[i][1] = fun
        return old
      }
    }
    this.semanticTypes.push([type, fun])
    return null
  }

  push (val) {
    if (!val) {
      return true
    }
    /*   no measurable performance increase
    if (this._onCycle) {
      // during cycle-checking, we can stop here
      return true
    }
    */

    this.result[this.offset] = val
    this.resultMethod[this.offset] = 0
    this.resultLength[this.offset] = val.length
    this.offset ++

    if (this.streaming) {
      this.onData(this.finalize())
    }

    return true
  }

  pushWrite (val, method, len) {
    this.result[this.offset] = val
    this.resultMethod[this.offset] = method
    this.resultLength[this.offset] = len
    this.offset ++

    if (this.streaming) {
      this.onData(this.finalize())
    }

    return true
  }

  _pushUInt8 (val) {
    return this.pushWrite(val, 1, 1)
  }

  _pushUInt16BE (val) {
    return this.pushWrite(val, 2, 2)
  }

  _pushUInt32BE (val) {
    return this.pushWrite(val, 3, 4)
  }

  _pushDoubleBE (val) {
    return this.pushWrite(val, 4, 8)
  }

  _pushNaN () {
    return this.push(BUF_NAN)
  }

  _pushInfinity (obj) {
    const half = (obj < 0) ? BUF_INF_NEG : BUF_INF_POS
    return this.push(half)
  }

  _pushFloat (obj) {
    const b2 = new Buffer(2)

    if (utils.writeHalf(b2, obj)) {
      if (utils.parseHalf(b2) === obj) {
        return this._pushUInt8(HALF) && this.push(b2)
      }
    }

    const b4 = new Buffer(4)
    b4.writeFloatBE(obj, 0)
    if (b4.readFloatBE(0) === obj) {
      return this._pushUInt8(FLOAT) && this.push(b4)
    }

    return this._pushUInt8(DOUBLE) && this._pushDoubleBE(obj)
  }

  _pushInt (obj, mt, orig) {
    const m = mt << 5
    if (obj < 24) {
      return this._pushUInt8(m | obj)
    }

    if (obj <= 0xff) {
      return this._pushUInt8(m | NUMBYTES.ONE) && this._pushUInt8(obj)
    }

    if (obj <= 0xffff) {
      return this._pushUInt8(m | NUMBYTES.TWO) && this._pushUInt16BE(obj)
    }

    if (obj <= 0xffffffff) {
      return this._pushUInt8(m | NUMBYTES.FOUR) && this._pushUInt32BE(obj)
    }

    if (obj <= Number.MAX_SAFE_INTEGER) {
      return this._pushUInt8(m | NUMBYTES.EIGHT) &&
        this._pushUInt32BE(Math.floor(obj / SHIFT32)) &&
        this._pushUInt32BE(obj % SHIFT32)
    }

    if (mt === MT.NEG_INT) {
      return this._pushFloat(orig)
    }

    return this._pushFloat(obj)
  }

  _pushIntNum (obj) {
    if (obj < 0) {
      return this._pushInt(-obj - 1, MT.NEG_INT, obj)
    } else {
      return this._pushInt(obj, MT.POS_INT)
    }
  }

  _pushNumber (obj) {
    switch (false) {
      case (obj === obj): // eslint-disable-line
        return this._pushNaN(obj)
      case isFinite(obj):
        return this._pushInfinity(obj)
      case ((obj % 1) !== 0):
        return this._pushIntNum(obj)
      default:
        return this._pushFloat(obj)
    }
  }

  _pushString (obj) {
    const len = Buffer.byteLength(obj, 'utf8')
    return this._pushInt(len, MT.UTF8_STRING) && this.pushWrite(obj, 5, len)
  }

  _pushBoolean (obj) {
    return this._pushUInt8(obj ? TRUE : FALSE)
  }

  _pushUndefined (obj) {
    return this._pushUInt8(UNDEFINED)
  }

  _pushArray (gen, obj) {
    const len = obj.length
    if (!gen._pushInt(len, MT.ARRAY)) {
      return false
    }
    for (let j = 0; j < len; j++) {
      if (!gen.pushAny(obj[j])) {
        return false
      }
    }
    return true
  }

  _pushTag (tag) {
    return this._pushInt(tag, MT.TAG)
  }

  _pushDate (gen, obj) {
    return gen._pushTag(TAG.DATE_EPOCH) && gen.pushAny(obj / 1000)
  }

  _pushBuffer (gen, obj) {
    return gen._pushInt(obj.length, MT.BYTE_STRING) && gen.push(obj)
  }

  _pushNoFilter (gen, obj) {
    return gen._pushBuffer(gen, obj.slice())
  }

  _pushRegexp (gen, obj) {
    return gen._pushTag(TAG.REGEXP) && gen.pushAny(obj.source)
  }

  _pushSet (gen, obj) {
    if (!gen._pushInt(obj.size, MT.ARRAY)) {
      return false
    }
    for (let x of obj) {
      if (!gen.pushAny(x)) {
        return false
      }
    }
    return true
  }

  _pushUrl (gen, obj) {
    return gen._pushTag(TAG.URI) && gen.pushAny(obj.format())
  }

  _pushBigint (obj) {
    let tag = TAG.POS_BIGINT
    if (obj.isNegative()) {
      obj = obj.negated().minus(1)
      tag = TAG.NEG_BIGINT
    }
    let str = obj.toString(16)
    if (str.length % 2) {
      str = '0' + str
    }
    const buf = new Buffer(str, 'hex')
    return this._pushTag(tag) && this._pushBuffer(this, buf)
  }

  _pushBigNumber (gen, obj) {
    if (obj.isNaN()) {
      return gen._pushNaN()
    }
    if (!obj.isFinite()) {
      return gen._pushInfinity(obj.isNegative() ? -Infinity : Infinity)
    }
    if (obj.isInteger()) {
      return gen._pushBigint(obj)
    }
    if (!(gen._pushTag(TAG.DECIMAL_FRAC) &&
      gen._pushInt(2, MT.ARRAY))) {
      return false
    }

    const dec = obj.decimalPlaces()
    const slide = obj.mul(new Bignumber(10).pow(dec))
    if (!gen._pushIntNum(-dec)) {
      return false
    }
    if (slide.abs().lessThan(MAXINT_BN)) {
      return gen._pushIntNum(slide.toNumber())
    } else {
      return gen._pushBigint(slide)
    }
  }

  _pushMap (gen, obj) {
    if (!gen._pushInt(obj.size, MT.MAP)) {
      return false
    }

    return this._pushRawMap(
      obj.size,
      Array.from(obj)
    )
  }

  _pushObject (obj) {
    if (!obj) {
      return this._pushUInt8(NULL)
    }

    var len = this.semanticTypes.length
    for (var i = 0; i < len; i++) {
      if (obj instanceof this.semanticTypes[i][0]) {
        return this.semanticTypes[i][1].call(obj, this, obj)
      }
    }

    var f = obj.encodeCBOR
    if (typeof f === 'function') {
      return f.call(obj, this)
    }

    var keys = Object.keys(obj)
    var keyLength = keys.length
    if (!this._pushInt(keyLength, MT.MAP)) {
      return false
    }

    return this._pushRawMap(
      keyLength,
      keys.map((k) => [k, obj[k]])
    )
  }

  _pushRawMap (len, map) {
    // Sort keys for canoncialization
    // 1. encode key
    // 2. shorter key comes before longer key
    // 3. same length keys are sorted with lower
    //    byte value before higher

    map = map.map(function (a) {
      a[0] = Encoder.encode(a[0])
      return a
    }).sort(utils.keySorter)

    for (var j = 0; j < len; j++) {
      debug(' - map value ', j, map[j][0], map[j][1])
      if (!this.push(map[j][0])) {
        return false
      }

      if (!this.pushAny(map[j][1])) {
        return false
      }
    }

    return true
  }

  /**
   * Alias for `.pushAny`
   *
   * @param {*} obj
   * @returns {undefind}
   */
  write (obj) {
    this.pushAny(obj)
  }

  /**
   * Push any supported type onto the encoded stream
   *
   * @param {any} obj
   * @returns {boolean} true on success
   */
  pushAny (obj) {
    
    debug('pushObject', obj, this._kept, this._pleaseKeep)
    let i
    if (-1 !== (i = this._kept.indexOf(obj))) {
      debug('* ref back to', i)
      this._pushTag(29)
      this._pushInt(i)
      return true
    }
    if (-1 !== (i = this._pleaseKeep.indexOf(obj))) {
      const at = this._kept.push(obj) - 1
      debug('* establishing refback #', i)
      this._pleaseKeep.splice(i, 1)
      this._pushTag(28)
      // keep going, and actually serialize the value, below
    }

    if (this._onCycle &&
        obj !== null &&
        (typeof obj === 'object' || typeof obj === 'function')) {
      if (obj[COLOR] === this._currentColor) {
        let abort = false
        if (!this._onShared(obj)) abort = true
        if (this._onCycle) {
          debug('path check')
          if (this._path.indexOf(obj) > -1) {
            this._onCycle(obj)
            abort = true
          }
        }
        if (abort) return true
      }
      obj[COLOR] = this._currentColor
    }

    if (this._path && typeof obj === 'object') {
      this._path.push(obj)
      debug('path pushed, now', this._path)
    }
    
    this.depth++
    debug('++depth =', this.depth)
    if (this.depth > this.maxDepth) {
      throw Error('recursion too deep (' + this.depth +
                  '); consider "sharing" or "maxDepth"')
    }
      
    const val = (() => {  // catch the return, for depth counting
      var typ = toType(obj)
      switch (typ) {
      case 'Number':
        return this._pushNumber(obj)
      case 'String':
        return this._pushString(obj)
      case 'Boolean':
        return this._pushBoolean(obj)
      case 'Object':
        return this._pushObject(obj)
      case 'Array':
        return this._pushArray(this, obj)
      case 'Uint8Array':
        return this._pushBuffer(this, obj)
      case 'Null':
        return this._pushUInt8(NULL)
      case 'Undefined':
        return this._pushUndefined(obj)
      case 'Map':
        return this._pushMap(this, obj)
      case 'Set':
        return this._pushSet(this, obj)
      case 'Date':
        return this._pushDate(this, obj)
      case 'RegExp':
        return this._pushRegexp(this, obj)
      case 'Symbol':
        switch (obj) {
        case SYMS.NULL:
          return this._pushObject(null)
        case SYMS.UNDEFINED:
          return this._pushUndefined(void 0)
          // TODO: Add pluggable support for other symbols
        default:
          throw new Error('Unknown symbol: ' + obj.toString())
        }
      default:
        throw new Error('Unknown type: ' + typeof obj + ', ' + (obj ? obj.toString() : ''))
      }
    })()
    if (this._path && typeof obj === 'object') {
      this._path.pop()
      debug('path pop, now', this._path)
    }
    this.depth--
    debug('--depth =', this.depth)
    return val
  }

  finalize () {
    if (this.offset === 0) {
      return null
    }

    var result = this.result
    var resultLength = this.resultLength
    var resultMethod = this.resultMethod
    var offset = this.offset

    // Determine the size of the buffer
    var size = 0
    var i = 0

    for (; i < offset; i++) {
      size += resultLength[i]
    }

    var res = Buffer.allocUnsafe(size)
    var index = 0
    var length = 0

    // Write the content into the result buffer
    for (i = 0; i < offset; i++) {
      length = resultLength[i]

      switch (resultMethod[i]) {
        case 0:
          result[i].copy(res, index)
          break
        case 1:
          res.writeUInt8(result[i], index, true)
          break
        case 2:
          res.writeUInt16BE(result[i], index, true)
          break
        case 3:
          res.writeUInt32BE(result[i], index, true)
          break
        case 4:
          res.writeDoubleBE(result[i], index, true)
          break
        case 5:
          res.write(result[i], index, length, 'utf8')
          break
        default:
          throw new Error('unkown method')
      }

      index += length
    }

    var tmp = res

    this._reset()

    return tmp
  }

  _reset () {
    this.result = []
    this.resultMethod = []
    this.resultLength = []
    this.offset = 0
  }

  /**
   * Encode the given value
   * @param {*} o
   * @returns {Buffer}
   */
  static encode (o, options) {
    const enc = new Encoder(options)
    enc.pushAny(o)

    return enc.finalize()
  }

  /**
   * Like encodeAll, but also works for objects with cycles, using keep()
   *
   * Access as encodeAll with options {cycles: true}
   *
   * encodeCyclic?
   *
   */
  static encodeAllWithSharing (objs, options) {
    const opt = {}

    // remove the sharing:true that landed us here, or we'll
    // be looping back again when we call encodeAll
    Object.assign(opt, options || {})

    const shared = []
    opt.onShared = x => {
      debug('shared object detected:', x)  // strings, etc?
      if (shared.indexOf(x) === -1) {
        debug('... stored at index:', shared.length)
        shared.push(x)
      } else {
        debug('...already had it')
      }
      return false // no need to go in, since we've already looked there
    }
    opt.onCycle = x => {
      debug('cycle object detected:', x)  // strings, etc?
      if (shared.indexOf(x) === -1) {
        debug('... stored at index:', shared.length)
        shared.push(x)
      } else {
        debug('...already had it')
      }
    }

    debug('\n\nfirst pass, looking for sharing')
    const bytes = Encoder.encodeAll(objs, opt)

    if (shared.length === 0) {
      // could go through an delete COLOR if we really want, but that's
      // slow
      return bytes
    }
    
    debug('shared objects:', shared)

    opt.pleaseKeep = shared
    delete opt.onCycle   // no need for cycle detection this time
    delete opt.onShared  // or this, since we've marked them already

    debug('\n\nsecond pass, pleaseKeep', opt.pleaseKeep)
    return Encoder.encodeAll(objs, opt)
  }
  
  /**
   * Encode zero or more JavaScript objects, provided in an array, and
   * return a Buffer containing the CBOR bytes.  Unlike encode(), this
   * allows passing options to the encoder.
   *
   * @param {...any} objs - the objects to encode
   * @returns {Buffer} - the encoded objects
   */
  static encodeAll (objs, options) {
    if (options && (options.sharing || options.cycles)) {
      const opt = {}
      Object.assign(opt, options)
      // because we might recurse back
      delete opt.sharing
      delete opt.cycles
      return Encoder.encodeAllWithSharing(objs, opt)
    }
    debug('encodeAll...')
    const enc = new Encoder(options)
    for (const o of objs) {
      enc.pushAny(o)
    }
    return enc.finalize()
  }

}

module.exports = Encoder




