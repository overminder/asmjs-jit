goog.provide('asmjit.ll.type');

goog.require('goog.array');

goog.scope(function() {

var _ = asmjit.ll.type;

/**
 * @constructor
 */
_.TyCon = function(name, tyArgs) {
  this.name_ = name;
  this.tyArgs_ = tyArgs;
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
_.Int32 = function() {
  goog.base(this, 'Int32', []);
};
goog.inherits(_.Int32, _.TyCon);

_.Int32.prototype.annotate = function(exprRepr) {
  return '(' + exprRepr + ' | 0)';
};

_.Int32.prototype.defaultVal = function() {
  return '0';
};

/**
 * @constructor
 */
_.Void = function() {
  goog.base(this, 'Void', []);
};
goog.inherits(_.Void, _.TyCon);

_.i32 = new _.Int32();
_.woid = new _.Void();

});  // !goog.scope

// vim: set ts=2 sts=2 sw=2:
