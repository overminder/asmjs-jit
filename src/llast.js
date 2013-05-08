goog.provide('asmjit.ll.ast');
goog.provide('asmjit.ll.ast.Rator');

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
   * Global (actually is module-local) varaibles
   * @type {Array.<_.Var>}
   * @private
   */
  this.vars_ = [];

  /**
   * Foreign imports
   * @type {Array.<_.Import>}
   */
  this.imports_ = [];

  this.prelinkedFuncs_ = {};

  /**
   * @type {Array.<_.Proc>}
   * @private
   */
  this.procs_ = [];
  /**
   * @type {Object.<_.ProcTable>}
   * @private
   */
  this.tables_ = {};
  /**
   * @type {Object.<_.ProcRef>}
   * @private
   */
  this.exports_ = {};

  this.usingHeap_ = false;
};

_.Module.prototype.setUseHeap = function() {
  if (!this.usingHeap_) {
    this.usingHeap_ = true;
    goog.array.forEach([ll.type.i32p, ll.type.i16p, ll.type.i8p,
                        ll.type.u32p, ll.type.u16p, ll.type.u8p],
      function(ptrTy) {
        this.imports_.push(new _.HeapDecl(ptrTy));
      }, this);
  }
};

_.Module.prototype.foreignImport = function(func, type) {
  var name = _.mkUniqueId('ffi');
  var foreignRef = new _.ForeignRef(name, type);
  this.imports_.push(new _.FFIDecl(foreignRef));
  this.prelinkedFuncs_[name] = func;
  return foreignRef;
};

/**
 * Sanity checks: typechecking and many more.
 */
_.Module.prototype.lint = function() {
  goog.array.forEach(this.procs_, function(proc) {
    proc.lint();
  });
};

/**
 * All ffi calls are managed for now, to simplify the
 * compilation process.
 */
_.Module.prototype.compile = function() {
  this.lint();
  var module = eval(this.toAsmSrc());
  var foreign = this.prelinkedFuncs_;
  return function(stdlib, heap) {
    return module(stdlib, foreign, heap);
  };
};

_.Module.prototype.toAsmSrc = function() {
  var xs = [ '(function(stdlib, foreign, heap) {'
           , '  "use asm";'
           ];

  goog.array.forEach(this.imports_, function(x) {
    xs.push(x.toAsmSrc());
  });

  goog.array.forEach(this.vars_, function(v) {
    xs.push('var ' + v.name() + ' = ' +
            v.type().defaultVal() + ';');
  });

  goog.array.forEach(this.procs_, function(proc) {
    xs.push(proc.toAsmSrc());
  });

  goog.object.forEach(this.tables_, function(table) {
    xs.push(table.toAsmSrc());
  });

  var isFirstPair = false;
  xs.push('  return {');
  goog.object.forEach(this.exports_, function(ref, asName) {
    if (!isFirstPair) {
      isFirstPair = true;
    }
    else {
      xs.push(', ');
    }
    xs.push(asName, ': ', ref.toAsmSrc());
  });
  xs.push( '  };'
         , '})'
         );

  return xs.join('\n');
};

_.Module.prototype.addProc = function(proc, opt_export) {
  this.procs_.push(proc);
  if (opt_export) {
    this.exports_[proc.name()] = proc.toCallable();
  }
};

_.Import = function() {
};

_.HeapDecl = function(ptrType) {
  this.ptrType_ = ptrType;
};
goog.inherits(_.HeapDecl, _.Import);

_.HeapDecl.prototype.toAsmSrc = function() {
  var valType = this.ptrType_.tyArgAt(0);
  return 'var ' + this.ptrType_.heapBase() + ' = ' +
         'new stdlib.' + valType.toString() + 'Array(heap);';
};

_.FFIDecl = function(foreignRef) {
  this.ref_ = foreignRef;
};
goog.inherits(_.FFIDecl, _.Import);

_.FFIDecl.prototype.toAsmSrc = function() {
  return 'var ' + this.ref_.name() + ' = ' +
         'foreign.' + this.ref_.name() + ';';
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

_.Proc.prototype.lint = function() {
  goog.asserts.assert(this.type_ instanceof ll.type.Arrow);
  goog.asserts.assert(this.body_ instanceof _.BodyStmt);
  this.body_.assertType(this.type_.resType());
};

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

_.Proc.prototype.mkLocal = function(type, opt_ident) {
  goog.asserts.assert(type, 'Proc.mkLocal: must provide a type');
  var name = _.mkUniqueId(opt_ident ? opt_ident : 'local');
  var v = new _.Var(type, name);
  this.locals_.push(v);
  return v;
};

_.Proc.prototype.addStmt = function(stmt) {
  this.body_.stmt_.addStmt(stmt);
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

_.Expr.prototype.assertType = function(type) {
  goog.asserts.assert(this.type_ === type,
    'expr typecheck failed: `' + this.toAsmSrc() + '`');
  this.lint();
};

_.Expr.prototype.lint = function() {
  throw Error('Expr.lint(' + this.toAsmSrc() + '): abstract');
};

/**
 * XXX: typechecking using {op}
 * @constructor
 */
_.BinOp = function(op, lhs, rhs, opt_resType) {
  this.op_ = op;
  this.lhs_ = lhs;
  this.rhs_ = rhs;

  var lType = lhs.type();
  var rType = rhs.type();

  // Figure out the type
  var type = op.guessType(lhs, rhs);
  if (type) {
    if (opt_resType) {
      goog.asserts.assert(type === opt_resType);
    }
    this.type_ = type;
  }
  else if (opt_resType) {
    this.type_ = opt_resType;
  }
  else {
    throw Error('cannot guess type', this, lhs, rhs);
  }
};
goog.inherits(_.BinOp, _.Expr);

_.BinOp.prototype.toAsmSrc = function() {
  var repr;
  if (this.op_.infix()) {
    repr = this.lhs_.toAsmSrc() + this.op_.toAsmSrc() +
           this.rhs_.toAsmSrc();
  }
  else {
    repr = this.op_.toAsmSrc(this.lhs_, this.rhs_);
  }
  return this.type_.annotate('(' + repr + ')');
};

_.BinOp.prototype.asLocation = function() {
  if (this.op_ instanceof _.Deref) {
    return this.op_.asLocation(this.lhs_, this.rhs_);
  }
  throw Error('Not a location expr');
};

_.BinOp.prototype.lint = function() {
  goog.asserts.assert(this.op_ instanceof _.Rator);
  this.op_.lint(this.lhs_, this.rhs_, this.type_);
};

_.Rator = function() {
};

_.Rator.prototype.infix = function() {
  return false;
};

_.ArithRator = function(name) {
  this.name_ = name;
};
goog.inherits(_.ArithRator, _.Rator);

_.ArithRator.prototype.toAsmSrc = function() {
  return this.name_;
};

_.ArithRator.prototype.infix = function() {
  return true;
};

_.ArithRator.prototype.lint = function(lhs, rhs, type) {
  goog.asserts.assert(lhs.type() === rhs.type() &&
                      lhs.type() === type);
};

_.ArithRator.prototype.guessType = function(lhs, rhs) {
  if (lhs.type() === rhs.type() &&
      lhs.type() === ll.type.i32) {
    return ll.type.i32;
  }
  else {
    return null;
  }
};

_.Rator.iadd = new _.ArithRator('+');
_.Rator.isub = new _.ArithRator('-');
_.Rator.imul = new _.ArithRator('*');
_.Rator.idiv = new _.ArithRator('/');
_.Rator.ilt = new _.ArithRator('<');
_.Rator.ile = new _.ArithRator('<=');
_.Rator.ieq = new _.ArithRator('==');
_.Rator.ine = new _.ArithRator('!=');
_.Rator.igt = new _.ArithRator('>');
_.Rator.ige = new _.ArithRator('>=');

_.Deref = function() {
};
goog.inherits(_.Deref, _.Rator);

_.Deref.prototype.infix = function() {
  return false;
};

_.Deref.prototype.guessType = function(base, offset) {
  ptrType = base.type();
  goog.asserts.assert(ptrType instanceof ll.type.Ptr);
  var valType = ptrType.tyArgAt(0);
  goog.asserts.assert(valType instanceof ll.type.Int);

  var ixType = offset.type();
  goog.asserts.assert(ixType instanceof ll.type.Int);

  return valType;
};

_.Deref.prototype.toAsmSrc = function(base, offset) {
  var ptrType = base.type();
  var valType = ptrType.tyArgAt(0);
  var shift = String(valType.shift());

  var shiftedOffset = '((' + offset.toAsmSrc() + ' << ' +
                      shift + ') | 0)';
  var combinedBase = '((' + base.toAsmSrc() + ' + ' +
                     shiftedOffset + ') | 0)';

  var shiftBack = combinedBase + ' >> ' + shift;
  var repr = '[' + shiftBack + ']';
  return ptrType.heapBase() + repr;
};

_.Deref.prototype.asLocation = function(base, offset) {
  return this.toAsmSrc(base, offset);
};

_.Deref.prototype.lint = function(base, offset, type) {
  goog.asserts.assert(this.guessType(base, offset) === type);
};

_.Rator.deref = new _.Deref();


/**
 * @constructor
 */
_.Literal = function() {
};
goog.inherits(_.Literal, _.Expr);

_.Literal.prototype.lint = function() {
};

/**
 * @constructor
 */
_.Int32Literal = function(ival) {
  this.ival_ = ival;
};
goog.inherits(_.Int32Literal, _.Literal);

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

_.Var.prototype.asLocation = function() {
  return this.name();
};

_.Var.prototype.lint = function() {
  goog.asserts.assert(this.type_ instanceof ll.type.TyCon);
  goog.asserts.assert(!(this.type_ instanceof ll.type.Arrow));
};

_.Cast = function(type, expr) {
  this.type_ = type;
  this.expr_ = expr;
};
goog.inherits(_.Cast, _.Expr);

_.Cast.prototype.toAsmSrc = function() {
  return this.type_.annotate(this.expr_.toAsmSrc());
};

_.Cast.prototype.lint = function() {
  this.expr_.lint();
};

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

_.Call.prototype.lint = function() {
  var funcType = this.func_.type();
  goog.asserts.assert(this.type_ === funcType.resType());
  goog.array.forEach(this.args_, function(arg, i) {
    arg.assertType(funcType.argTypes()[i]);
  });
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
_.ForeignRef = function(name, type) {
  this.name_ = name;
  this.type_ = type;
};
goog.inherits(_.ForeignRef, _.Callable);

_.ForeignRef.prototype.name = function() { return this.name_; };
_.ForeignRef.prototype.toAsmSrc = function() {
  return this.name_;
};

/**
 * @constructor
 */
_.Stmt = function() {
};

_.Stmt.prototype.lint = function(resType) {
  throw Error('Stmt.lint: abstract');
};

/**
 * @constructor
 */
_.ReturnStmt = function() {
};
goog.inherits(_.ReturnStmt, _.Stmt);

_.ReturnStmt.prototype.assertType = function(type) {
  goog.asserts.assert(type === ll.type.woid);
};

_.ReturnStmt.prototype.lint = _.ReturnStmt.prototype.assertType;

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

_.ReturnExprStmt.prototype.assertType = function(type) {
  this.expr_.assertType(type);
};

_.ReturnExprStmt.prototype.lint =
  _.ReturnExprStmt.prototype.assertType;

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

_.BodyStmt.prototype.assertType = function(resType) {
  this.stmt_.lint(resType);
  this.retStmt_.assertType(resType);
};

/**
 * @constructor
 */
_.SeqStmt = function(stmts) {
  this.stmts_ = stmts;
};
goog.inherits(_.SeqStmt, _.Stmt);

_.SeqStmt.prototype.lint = function(resType) {
  goog.array.forEach(this.stmts_, function(stmt) {
    stmt.lint(resType);
  });
};

_.SeqStmt.prototype.addStmt = function(stmt) {
  this.stmts_.push(stmt);
};

_.SeqStmt.prototype.toAsmSrc = function() {
  return goog.array.map(this.stmts_, function(stmt) {
    return stmt.toAsmSrc();
  }).join('\n');
};

_.mkIfStmt = function(expr, thenStmt, opt_elseStmt) {
  if (opt_elseStmt) {
    return new _.IfElseStmt(expr, thenStmt, opt_elseStmt);
  }
  return new _.IfStmt(expr, thenStmt);
};

_.IfStmt = function(expr, thenStmt) {
  this.expr_ = expr;
  this.thenStmt_ = thenStmt;
};
goog.inherits(_.IfStmt, _.Stmt);

_.IfStmt.prototype.toAsmSrc = function() {
  return [ 'if (' + this.expr_.toAsmSrc() + ') {'
         , this.thenStmt_.toAsmSrc()
         , '}'].join('\n');
};

_.IfStmt.prototype.lint = function(resType) {
  this.expr_.assertType(ll.type.i32);
  this.thenStmt_.lint(resType);
};

_.IfElseStmt = function(expr, thenStmt, elseStmt) {
  this.expr_ = expr;
  this.thenStmt_ = thenStmt;
  this.elseStmt_ = elseStmt;
};
goog.inherits(_.IfElseStmt, _.Stmt);

_.IfElseStmt.prototype.toAsmSrc = function() {
  return [ 'if (' + this.expr_.toAsmSrc() + ') {'
         , this.thenStmt_.toAsmSrc()
         , '}'
         , 'else {'
         , this.elseStmt_.toAsmSrc()
         , ' }'].join('\n');
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

_.AssignStmt = function(lhs, rhs) {
  /**
   * @type {_.Var|_.BinOp}
   * @private
   */
  this.lhs_ = lhs;

  /**
   * @type {_.Expr}
   * @private
   */
  this.rhs_ = rhs;
};
goog.inherits(_.AssignStmt, _.Stmt);

_.AssignStmt.prototype.toAsmSrc = function() {
  return this.lhs_.asLocation() + ' = ' +
         this.rhs_.toAsmSrc() + ';';
};

_.AssignStmt.prototype.lint = function(resType) {
  this.lhs_.assertType(this.rhs_.type());
  this.rhs_.assertType(this.lhs_.type());
};

});  // !goog.scope

// vim: set ts=2 sts=2 sw=2:

