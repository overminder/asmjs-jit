goog.provide('asmjit.ll.type');

goog.require('goog.array');
goog.require('goog.asserts');

goog.scope(function() {

var _ = asmjit.ll.type;

/**
 * @constructor
 */
_.TyCon = function(name, tyArgs) {
  this.name_ = name;
  this.tyArgs_ = tyArgs;
};

_.TyCon.prototype.tyArgAt = function(i) {
  return this.tyArgs_[i];
};

_.TyCon.prototype.needsParenWrap_ = function() {
  return this.tyArgs_.length;
}

_.TyCon.prototype.toString = function() {
  var xs = [this.name_].concat(goog.array.map(this.tyArgs_,
    function(tyArg) {
      if (tyArg.needsParenWrap_()) {
        return '(' + tyArg.toString() + ')';
      }
      else {
        return tyArg.toString();
      }
    }));

  return xs.join(' ');
};

/**
 * @param {string} exprRepr The expr to annotate
 * @return {string} Annotated expr
 */
_.TyCon.prototype.annotate = function(exprRepr) {
  throw Error('Not applicable');
};

/**
 * @return {string} The default value of this type
 */
_.TyCon.prototype.defaultVal = function() {
  throw Error('Not applicable');
};

/**
 * @constructor
 */
_.Arrow = function(argTypes, resType) {
  goog.base(this, '(->)', [new _.TupleN(argTypes), resType]);
};
goog.inherits(_.Arrow, _.TyCon);

_.Arrow.prototype.toString = function() {
  return this.tyArgs_[0].toString() + ' -> ' +
         this.tyArgs_[1].toString();
};

_.Arrow.prototype.argTypes = function() {
  return this.tyArgs_[0].tyArgs_;
};

_.Arrow.prototype.resType = function() {
  return this.tyArgs_[1];
};

_.TupleN = function(xs) {
  goog.base(this, 'Tuple' + String(xs.length), xs);
};
goog.inherits(_.TupleN, _.TyCon);

_.TupleN.prototype.needsParenWrap_ = function() {
  return false;
};

_.TupleN.prototype.toString = function() {
  var xs = ['('];
  goog.array.forEach(this.tyArgs_, function(ty, i) {
    if (i != 0) {
      xs.push(', ');
    }
    xs.push(ty.toString());
  });
  xs.push(')');

  return xs.join('');
};

/**
 * @constructor
 */
_.Int = function(width, signed) {
  goog.asserts.assert(width == 1 ||
                      width == 2 ||
                      width == 4, 'wrong width');
  goog.base(this, (signed ? 'Int' : 'Uint') +
                  String(width * 8), []);

  this.width_ = width;
};
goog.inherits(_.Int, _.TyCon);

_.Int.prototype.width = function() { return this.width_; };

_.Int.prototype.shift = function() {
  switch (this.width_) {
  case 1:
    return 0;
  case 2:
    return 1;
  case 4:
    return 2;
  }
};

_.Int.prototype.annotate = function(exprRepr) {
  return '(' + exprRepr + ' | 0)';
};

_.Int.prototype.defaultVal = function() {
  return '0';
};

/**
 * Reuse Int32's methods
 * @constructor
 */
_.Ptr = function(type) {
  _.TyCon.call(this, 'Ptr', [type]);
};
goog.inherits(_.Ptr, _.Int);

_.Ptr.prototype.heapBase = function() {
  return 'heapBaseAs' + this.tyArgAt(0).toString();
};

/**
 * @constructor
 */
_.Void = function() {
  goog.base(this, 'Void', []);
};
goog.inherits(_.Void, _.TyCon);

_.woid = new _.Void();
_.i32  = new _.Int(4, true);
_.u32  = new _.Int(4, false);
_.i32p = new _.Ptr(_.i32);
_.i16p = new _.Ptr(new _.Int(2, true));
_.i8p  = new _.Ptr(new _.Int(1, true));
_.u32p = new _.Ptr(_.u32);
_.u16p = new _.Ptr(new _.Int(2, false));
_.u8p  = new _.Ptr(new _.Int(1, false));

});  // !goog.scope

// vim: set ts=2 sts=2 sw=2:
