'use strict'

const tagged = require('./tagged')

/**
 * Traverse objs looking for items tagged 29 (shared-value reference),
 * and replacing them with the value they are a reference too (from
 * kept).  Returns the number of still-unresolved references.
 *
 */

function resolveReferences (objs, kept) {
  let remaining = 0
  if (!Array.isArray(objs)) {
    throw Error('array required, so we can modify in place')
  }
  if (!kept) {
    throw Error('missing "kept" array of references')
  }
  walk(kept, subs)
  walk(objs, subs)
  return remaining

  function subs (parent, key) {
    let me = parent[key]
    if (me instanceof tagged && me.tag === 29) {
      const r = kept[me.value]
      if (r === undefined) {
        // console.log('remaining', remaining)
        remaining++
        return false
      } else {
        // r is one of borc decoder's internal structure objects, like
        // { type: 3, length: 1, ref: [ 28 ], tag28index: 0 }
        const val = r.ref[1]
        parent[key] = val
        me = val
        return false
      }
    }
    return true
  }
}

/**
 * Traverse an array of recursive arrays/objects, and call
 * visitor(parent, key) on each structure member, giving it a chance
 * to modify the value in place.  If visitor returns true, we'll then
 * walk the value the visitor left; if false, we'll skip it.
 *
 * We can walk circular structures; we move along, without calling
 * visitor, if we hit a node that's already in the path from the root.
 */
function walk (array, visitor) {
  const path = []
  function walkWithKey(parent, key) {
    let me = parent[key]
    if (path.indexOf(me) > -1) return // been here already
    if (visitor(parent, key)) {
      me = parent[key]
      path.push(me)
      if (typeof me === 'object' || typeof me === 'function') {
        if (Array.isArray(me)) {
          // console.log('-- array', me)
          for (let i = 0; i <= me.length; i++) {
            walkWithKey(me, i)
          }
        } else {
          // console.log('-- obj', me)
          for (const key of Reflect.ownKeys(me)) {
            walkWithKey(me, key)
          }
        }
      }
      path.pop()
    }
  }
  walkWithKey([array], 0)
}

module.exports = resolveReferences
