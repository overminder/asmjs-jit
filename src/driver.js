goog.provide('asmjit.driver');

goog.require('goog.userAgent');
goog.require('asmjit.ll.ast');
goog.require('asmjit.ll.type');

asmjit.driver.globalObject = this;

goog.scope(function() {

var _ = asmjit.driver;
var ll = asmjit.ll;

if (typeof console !== 'undefined') {
  _.print = function(x) {
    console.log(x);
  };
}
else {
  _.print = function(x) {
    print(x);
  }
}

_.mkFiboProc = function() {
  var fibo = new ll.ast.Proc(
    new ll.type.Arrow([ll.type.i32], ll.type.i32));
  fibo.name_ = 'fibo';
  var recurTest = new ll.ast.BinOp(ll.ast.Rator.ilt,
                                   fibo.arg(0),
                                   new ll.ast.Int32Literal(2));
  var retN = ll.ast.mkReturnStmt(fibo.arg(0));
  fibo.addStmt(ll.ast.mkIfStmt(recurTest, retN));

  var nsub1 = new ll.ast.BinOp(ll.ast.Rator.isub,
                               fibo.arg(0),
                               new ll.ast.Int32Literal(1));
  var res1 = new ll.ast.Call(fibo.toCallable(), [nsub1]);
  var nsub2 = new ll.ast.BinOp(ll.ast.Rator.isub,
                               fibo.arg(0),
                               new ll.ast.Int32Literal(2));
  var res2 = new ll.ast.Call(fibo.toCallable(), [nsub2]);
  var res = new ll.ast.BinOp(ll.ast.Rator.iadd, res1, res2);
  fibo.setReturn(res);
  return fibo;
};

_.mkSetrefProc = function() {
  var proc = new ll.ast.Proc(
    new ll.type.Arrow([ll.type.i32, ll.type.i32], ll.type.i32));
  proc.name_ = 'setref';
  proc.addStmt(new ll.ast.AssignStmt(
    new ll.ast.BinOp(ll.ast.Rator.deref,
      new ll.ast.Cast(ll.type.i32p, proc.arg(0)),
      new ll.ast.Int32Literal(0)), proc.arg(1)));
  proc.setReturn(
    new ll.ast.BinOp(ll.ast.Rator.deref,
      new ll.ast.Cast(ll.type.i32p, proc.arg(0)),
      new ll.ast.Int32Literal(0)));
  return proc;
};

_.mkFFICallProc = function(module) {
  var proc = new ll.ast.Proc(
    new ll.type.Arrow([ll.type.i32], ll.type.i32));
  proc.name_ = 'ffiCall';

  var ffiPrint = module.foreignImport(_.print,
    new ll.type.Arrow([ll.type.i32], ll.type.i32));

  proc.setReturn(new ll.ast.Call(ffiPrint, [proc.arg(0)]));
  return proc;
};

_.main = function() {
  "use strict";

  var module = new ll.ast.Module();
  module.setUseHeap();
  module.addProc(_.mkFiboProc(), true);
  module.addProc(_.mkSetrefProc(), true);
  module.addProc(_.mkFFICallProc(module), true);

  var rawCode = module.toAsmSrc();
  _.print(rawCode);

  // try to compile
  var compiledModule = module.compile();
  var buffer = new ArrayBuffer(4096);
  var linkedModule = compiledModule(
    _.globalObject, buffer);

  var fibo = linkedModule['fibo'];
  var setref = linkedModule['setref'];
  var ffiCall = linkedModule['ffiCall'];

  _.bench('fibo', fibo, [30]);
  _.bench('setref', setref, [0, 123]);
  _.bench('ffiCall', ffiCall, [98765]);
};

_.bench = function(name, f, args) {
  var d0 = new Date().getTime();
  var res = f.apply(null, args);
  var dt = new Date().getTime() - d0;

  _.print(name + ' => ' + String(res) + ' used ' +
          String(dt) + 'ms');
};

goog.exportSymbol('asmjit.driver.main', _.main);

});  // !goog.scope

// vim: set ts=2 sts=2 sw=2:
