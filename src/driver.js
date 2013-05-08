goog.provide('asmjit.driver');

goog.require('goog.userAgent');
goog.require('asmjit.ll.ast');
goog.require('asmjit.ll.type');

goog.scope(function() {

var _ = asmjit.driver;
var ll = asmjit.ll;

if (goog.userAgent.GECKO || goog.userAgent.WEBKIT) {
  _.print = function(x) {
    console.log(x);
  };
}
else {
  _.print = function(x) {
    print(x);
  }
}

_.main = function() {
  var i32AddType = new ll.type.Arrow(
    [ll.type.i32, ll.type.i32], ll.type.i32);
  _.print(i32AddType);

  var addProc = new ll.ast.Proc(i32AddType);
  addProc.setReturn(new ll.ast.AddExpr(addProc.arg(0),
                                       addProc.arg(1)));

  var addOne = new ll.ast.Proc(new ll.type.Arrow(
    [ll.type.i32], ll.type.i32));
  var t0 = addOne.mkVar(ll.type.i32)
  var t1 = addOne.mkVar(ll.type.i32);
  addOne.setReturn(new ll.ast.Call(addProc.toCallable(),
                                   [ addOne.arg(0)
                                   , new ll.ast.Int32Literal(1)
                                   ]));

  var module = new ll.ast.Module();
  module.addProc(addProc);
  module.addProc(addOne, true);

  var rawCode = module.toAsmSrc();
  _.print(rawCode);

  // try to compile
  var compiledModule = new Function(rawCode)();
  print(compiledModule[addOne.name()](41));
};

goog.exportSymbol('asmjit.driver.main', _.main);

});  // !goog.scope

// vim: set ts=2 sts=2 sw=2:
