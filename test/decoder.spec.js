/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const Bignumber = require('bignumber.js')

const cases = require('./fixtures/cases')
const vectors = require('./fixtures/vectors.js')
const cbor = require('../')

const decoder = new cbor.Decoder()

describe('Decoder', function () {
  describe('vectors', () => {
    for (var i = 0; i < vectors.length; i++) {
      if (vectors[i].diagnostic) {
        continue
      }
      testGood(
        new Buffer(vectors[i].hex, 'hex'),
        vectors[i].decoded,
        vectors[i].hex
      )
    }
  })

  describe('good', () => testAll(cases.good))
  describe('decode', () => testAll(cases.decodeGood))
  describe('edges', () => failAll(cases.decodeBad))
  describe('bad first', () => failFirstAll(cases.decodeBad))

  describe('misc', () => {
    it('custom tags', () => {
      function replaceTag (val) {
        return {foo: val}
      }

      function newTag (val) {
        return 'cool'
      }

      const d = new cbor.Decoder({
        tags: {0: replaceTag, 127: newTag}
      })

      const input = new Buffer('d87f01c001', 'hex')

      expect(
        d.decodeAll(input)
      ).to.be.eql([
        'cool', {foo: 1}
      ])
    })

    it('parse tag', () => {
      const vals = cbor.decodeFirst('d87f01', 'hex')
      expect(vals).to.be.eql(new cbor.Tagged(127, 1))
    })

    it('decodeFirst', () => {
      expect(
        cbor.decodeFirst('01')
      ).to.be.eql(1)

      expect(
        cbor.decodeFirst('AQ==', 'base64')
      ).to.be.eql(1)

      expect(
        () => cbor.decodeFirst('')
      ).to.throw()

      expect(
        () => cbor.decodeFirst(new Buffer(0))
      ).to.throw()
    })

    it('decodeAll', () => {
      expect(
        cbor.decodeAll('0101')
      ).to.be.eql(
        [1, 1]
      )

      expect(
        cbor.decodeAll('AQ==', 'base64')
      ).to.be.eql(
        [1]
      )

      expect(
        () => cbor.decodeAll('7f')
      ).to.throw()

      expect(cbor.Decoder.decodeAll('0202')).to.be.eql([2, 2])
      expect(cbor.Decoder.decodeAll('AgI=', 'base64')).to.be.eql([2, 2])
      expect(cbor.Decoder.decodeAll('0202')).to.be.eql([2, 2])
      expect(cbor.Decoder.decodeAll('f6f6')).to.be.eql([null, null])
      expect(
        () => cbor.Decoder.decodeAll('63666fj')
      ).to.throw()
    })

    it('decodeFirst large input', () => {
      const largeInput = []
      for (let i = 0; i < 0x10000; i++) {
        largeInput.push('hi')
      }

      expect(
        cbor.decodeFirst(cbor.encode(largeInput))
      ).to.be.eql(
        largeInput
      )
    })

    it('decodeAll large input', () => {
      const largeInput = []
      for (let i = 0; i < 0x10000; i++) {
        largeInput.push('hi')
      }

      expect(
        cbor.decodeAll(cbor.encode(largeInput))
      ).to.be.eql(
        [largeInput]
      )
    })
    // TODO: implement depth limit
    it.skip('depth', () => {
      expect(
        () => cbor.decodeFirst('818180', {max_depth: 1})
      ).to.throw()
    })
  })
})

function testGood (input, expected, desc) {
  it(desc, () => {
    const res = decoder.decodeFirst(input)

    if (isNaN(expected)) {
      expect(isNaN(res)).to.be.true
    } else if (res instanceof Bignumber) {
      expect(res).be.eql(new Bignumber(String(expected)))
    } else {
      expect(res).to.be.eql(expected)
    }
  })
}

function testAll (list) {
  list.forEach((c) => {
    it(c[1], () => {
      const res = cbor.decodeFirst(cases.toBuffer(c))
      if (isNaN(c[0])) {
        expect(isNaN(res)).to.be.true
      } else {
        expect(res).to.be.eql(c[0])
      }
    })
  })
}

function failAll (list) {
  list.forEach((c) => {
    it(`fails - ${c}`, () => {
      expect(
        () => cbor.decode(cases.toBuffer(c))
      ).to.throw()
    })
  })
}

function failFirstAll (list) {
  list.forEach((c) => {
    it(`fails - ${c}`, () => {
      expect(
        () => cbor.decodeFirst(cases.toBuffer(c))
      ).to.throw()
    })
  })
}
