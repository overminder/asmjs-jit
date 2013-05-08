goog.provide('asmjit.ll.ast');

goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.asserts');

goog.require('asmjit.ll.type');

goog.scope(function() {

var _ = asmjit.ll.ast;
var ll = asmjit.ll;

_.uniqueIdCounter_ = 0;
_.mkUniqueId = function(prefix) {
  return prefix + '_' + String(_.uniqueIdCounter_++);
};

/**
 * @constructor
 */
_.Module = function() {
  /**
   * @type {Object.<_.Var>}
   * @private
   */
  this.vars_ = {};
  /**
   * @type {Object.<_.Proc>}
   * @private
   */
  this.procs_ = {};
  /**
   * @type {Object.<_.ProcTable>}
   * @private
   */
  this.tables_ = {};
  /**
   * @type {Object.<_.Var>}
   * @private
   */
  this.exports_ = {};
};

_.Module.prototype.compile = function() {
  return new Function(this.toAsmSrc())();
};

_.Module.prototype.toAsmSrc = function() {
  var xs = [ 'var Module = function() {'
           , '  "use asm";'
           ];

  goog.object.forEach(this.vars_, function(val) {
    xs.push(val.toAsmSrc());
  });

  goog.object.forEach(this.procs_, function(val) {
    xs.push(val.toAsmSrc());
  });

  goog.object.forEach(this.tables_, function(val) {
    xs.push(val.toAsmSrc());
  });

  var isFirstPair = false;
  xs.push('  return {');
  goog.object.forEach(this.exports_, function(val, key) {
    if (!isFirstPair) {
      isFirstPair = true;
    }
    else {
      xs.push(', ');
    }
    xs.push(key, ': ', val.name());
  });
  xs.push( '  };'
         , '};'
         , 'return Module();'
         );

  return xs.join('\n');
};

_.Module.prototype.addProc = function(proc, opt_export) {
  this.procs_[proc.name()] = proc;
  if (opt_export) {
    this.exports_[proc.name()] = proc;
  }
};

/**
 * @constructor
 */
_.Proc = function(type) {
  /**
   * @type {string}
   * @private
   */
  this.name_ = _.mkUniqueId('proc');

  /**
   * @type {Array.<_.Var>}
   * @private
   */
  this.args_ = goog.array.map(type.argTypes(), function(type) {
    return new this.mkArg(type);
  }, this);

  this.locals_ = [];

  var resType = type.resType();
  /**
   * @type {_.BodyStmt}
   * @private
   */
  this.body_ = new _.BodyStmt(new _.SeqStmt([]),
                              resType === ll.type.woid ?
                              _.returnStmt :
                              new _.ReturnExprStmt(
                                _.typeToLiteral(resType)));

  /**
   * @type {ll.type.Arrow}
   * @private
   */
  this.type_ = type;
};

_.Proc.prototype.type = function() { return this.type_; };
_.Proc.prototype.name = function() { return this.name_; };
_.Proc.prototype.arg = function(nth) { return this.args_[nth]; };

_.Proc.prototype.toAsmSrc = function() {
  // Emit function name and args decl
  var xs = ['function ' + this.name_ + '('];
  goog.array.forEach(this.args_, function(arg, i) {
    if (i != 0) {
      xs.push(', ');
    }
    xs.push(arg.name());
  });
  xs.push(') {');

  // Emit function arg type
  goog.array.forEach(this.args_, function(arg) {
    xs.push(arg.name(), ' = ', arg.toAsmSrc(), ';');
  });

  // Emit local var type
  goog.array.forEach(this.locals_, function(v) {
    xs.push('var ', v.name(), ' = ', v.type().defaultVal(), ';');
  });
  
  // Emit body
  xs.push(this.body_.toAsmSrc());

  // Emit function footer
  xs.push('}');
  return xs.join('');
};

_.Proc.prototype.mkArg = function(type) {
  var name = _.mkUniqueId('arg');
  return new _.Var(type, name);
};

_.Proc.prototype.mkVar = function(type, opt_ident) {
  goog.asserts.assert(type, 'Proc.mkVar: must provide a type');
  var name = _.mkUniqueId(opt_ident ? opt_ident : 'var');
  var v = new _.Var(type, name);
  this.locals_.push(v);
  return v;
};

_.Proc.prototype.addStmt = function(stmt) {
  this.body_.stmts_.push(stmt);
};

_.Proc.prototype.setReturn = function(opt_expr) {
  this.body_.retStmt_ = _.mkReturnStmt(opt_expr);
};

_.Proc.prototype.toCallable = function() {
  return new _.ProcRef(this);
};

_.typeToLiteral = function(type) {
  var repr = type.defaultVal();
  return _.typeToLiteral.mapping_[type.toString()](repr);
};

_.typeToLiteral.mapping_ = {
  'Int32': function(s) {
    return new _.Int32Literal(parseInt(s));
  }
};

/**
 * @constructor
 */
_.Expr = function() {
};
_.Expr.prototype.type_ = ll.type.any;

_.Expr.prototype.type = function() { return this.type_; }

/**
 * @constructor
 */
_.AddExpr = function(lhs, rhs, opt_type) {
  this.lhs_ = lhs;
  this.rhs_ = rhs;

  var lType = lhs.type();
  var rType = rhs.type();
  // Guess type
  if (lType === rType && lType === ll.type.i32) {
    this.type_ = ll.type.i32;
  }
  else {
    throw Error('Cannot guess type from:', 'AddExpr', lhs, rhs);
  }
};
goog.inherits(_.AddExpr, _.Expr);

_.AddExpr.prototype.toAsmSrc = function() {
  return this.type_.annotate('(' + this.lhs_.toAsmSrc() + ' + ' +
                             this.rhs_.toAsmSrc() + ')');
};

/**
 * @constructor
 */
_.Literal = function() {
};
goog.inherits(_.Literal, _.Expr);

/**
 * @constructor
 */
_.Int32Literal = function(ival) {
  this.ival_ = ival;
};
goog.inherits(_.Literal, _.Expr);

_.Int32Literal.prototype.type_ = ll.type.i32;

_.Int32Literal.prototype.toAsmSrc = function() {
  return String(this.ival_);
};

/**
 * @constructor
 */
_.Var = function(type, name) {
  this.type_ = type;
  this.name_ = name;
};
goog.inherits(_.Var, _.Expr);

_.Var.prototype.toAsmSrc = function() {
  return this.type_.annotate(this.name_);
};

_.Var.prototype.name = function() { return this.name_; }

/**
 * @constructor
 */
_.Call = function(func, args) {
  /**
   * @type {_.Callable}
   * @private
   */
  this.func_ = func;

  this.args_ = args;
  this.type_ = func.type().resType();
};
goog.inherits(_.Call, _.Expr);

_.Call.prototype.toAsmSrc = function() {
  var xs = [this.func_.toAsmSrc(), '('];
  goog.array.forEach(this.args_, function(arg, i) {
    if (i) {
      xs.push(', ');
    }
    xs.push(arg.toAsmSrc());
  });
  xs.push(')');
  return this.type_.annotate(xs.join(''));
};

/**
 * @constructor
 */
_.Callable = function() {
};
goog.inherits(_.Callable, _.Expr);

/**
 * @constructor
 */
_.ProcRef = function(proc) {
  this.proc_ = proc;
  this.type_ = proc.type();
};
goog.inherits(_.ProcRef, _.Callable);

_.ProcRef.prototype.toAsmSrc = function() {
  return this.proc_.name();
};

/**
 * @constructor
 */
_.Stmt = function() {
};

/**
 * @constructor
 */
_.ReturnStmt = function() {
};
goog.inherits(_.ReturnStmt, _.Stmt);

_.ReturnStmt.prototype.toAsmSrc = function() {
  return 'return;';
};

_.returnStmt = new _.ReturnStmt();

/**
 * @constructor
 */
_.ReturnExprStmt = function(expr) {
  /**
   * @type {_.Expr}
   * @private
   */
  this.expr_ = expr;
};
goog.inherits(_.ReturnExprStmt, _.Stmt);

_.ReturnExprStmt.prototype.toAsmSrc = function() {
  return 'return ' + this.expr_.toAsmSrc() + ';';
};

_.mkReturnStmt = function(opt_expr) {
  if ((!opt_expr) || (opt_expr.type() === ll.type.woid)) {
    return _.returnStmt;
  }
  return new _.ReturnExprStmt(opt_expr);
};

/**
 * @constructor
 */
_.BodyStmt = function(stmt, retStmt) {
  this.stmt_ = stmt;
  this.retStmt_ = retStmt;
};
goog.inherits(_.BodyStmt, _.Stmt);

_.BodyStmt.prototype.toAsmSrc = function() {
  return this.stmt_.toAsmSrc() + '\n' + this.retStmt_.toAsmSrc();
};

/**
 * @constructor
 */
_.SeqStmt = function(stmts) {
  this.stmts_ = stmts;
};
goog.inherits(_.SeqStmt, _.Stmt);

_.SeqStmt.prototype.toAsmSrc = function() {
  return goog.array.map(this.stmts_, function(stmt) {
    return stmt.toAsmSrc();
  }).join('\n');
};

/**
 * @constructor
 */
_.ExprStmt = function(expr) {
  this.expr_ = expr;
};
goog.inherits(_.ExprStmt, _.Stmt);

_.ExprStmt.prototype.toAsmSrc = function() {
  return this.expr_.toAsmSrc() + ';';
};

});  // !goog.scope

// vim: set ts=2 sts=2 sw=2:

