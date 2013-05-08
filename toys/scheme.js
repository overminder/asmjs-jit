goog.provide('lang.scheme');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('asmjit.driver');

goog.scope(function() {

var _ = lang.scheme;
var jit = asmjit.driver;

_.Cell = function() {
};

_.Cell.prototype.isNil = function() {
  return this === _.nil;
};

_.Cell.prototype.isPair = function() {
  return this instanceof _.Pair;
};

_.Cell.prototype.isList = function() {
  return this.isNil() || this.isPair();
};

_.Cell.prototype.toString = function() {
  return '#<Cell>';
};

_.Nil = function() {
};
goog.inherits(_.Nil, _.Cell);

_.Nil.prototype.toString = function() {
  return '()';
};

_.nil = new _.Nil();

_.Pair = function(car, cdr) {
  this.car_ = car;
  this.cdr_ = cdr;
};
goog.inherits(_.Pair, _.Cell);

_.Pair.prototype.toString = function() {
  var xs = ['(', this.car_.toString()];
  var it = this.cdr_;

  while (it instanceof _.Pair) {
    xs.push(' ', it.car_.toString());
    it = it.cdr_;
  }

  if (!it.isNil()) {
    xs.push(' . ', it.toString());
  }
  xs.push(')');
  return xs.join('');
};

_.jsArrayToList = function(arr, opt_tail) {
  return goog.array.reduceRight(arr, function(xs, x) {
    return new _.Pair(x, xs);
  }, opt_tail ? opt_tail : _.nil);
};

_.listToJsArray = function(xs) {
  var arr = [];
  while (xs.isPair()) {
    arr.push(xs.car_);
    xs = xs.cdr_;
  }
  if (xs.isNil()) {
    return arr;
  }
  else {
    throw Error('Not a proper list: ' + xs.toString());
  }
};

_.toScheme = function(x, opt_recur) {
  if (goog.isString(x)) {
    return _.mkAtom(x);
  }
  else if (goog.isArray(x)) {
    if (opt_recur) {
      x = goog.array.map(x, function(item) {
        return _.toScheme(item, true);
      });
    }
    return _.jsArrayToList(x);
  }
  else if (x instanceof _.Cell) {
    return x;
  }
  else {
    goog.asserts.assert(false,
      'Dont know how to convert ' + String(x));
  }
};

_.toJs = function(x, opt_recur) {
  if (x.isList()) {
    var arr = _.listToJsArray(x);
    if (opt_recur) {
      arr = goog.array.map(arr, function(item) {
        return _.toJs(item, true);
      });
    }
    return arr;
  }
  else if (x instanceof _.Atom) {
    return x.val_;
  }
  else if (!(x instanceof _.Cell)) {
    return x;
  }
  else {
    goog.asserts.assert(false,
      'Dont know how to convert ' + x.toString());
  }
};

_.Atom = function(val) {
  this.val_ = val;
};
goog.inherits(_.Atom, _.Cell);

_.Atom.prototype.toString = function() {
  return this.val_;
};

_.Atom.cache_ = {};
_.mkAtom = function(val) {
  var atom = _.Atom.cache_[val];
  if (!atom) {
    _.Atom.cache_[val] = atom = new _.Atom(val);
  }
  return atom;
};

_.Compiler = function(prog) {
  /**
   * @type {Array.<_.Cell>}
   * @private
   */
  this.prog_ = prog;
};

_.Compiler.compileToplevel = function() {
};

_.main = function() {
  var xs = _.toScheme(['define', 'id', ['lambda', ['x'], 'x']],
                      true);
  jit.print(xs);
};

});  // !goog.scope

// vim: set ts=2 sts=2 sw=2:
