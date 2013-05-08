// Well, this api seems to be much easier to work with...
_.fiboBuilder = function(proc, args) {
  proc.setName('fibo');
  proc.setArgTypes(['int32']);
  proc.setResType('int32');
  proc.setExport(true);

  proc.ifStmt(proc.lessthan(args(0), 2), function() {
    return args(0);
  }, function() {
    var t0 = proc.call('fibo', [proc.sub(args(0), 1)]);
    var t1 = proc.call('fibo', [proc.sub(args(0), 2)]);
    return proc.add(t0, t1);
  });
};

_.loopBuilder = function(proc, args) {
  proc.setName('loopSum');
  proc.setArgTypes(['int32p', 'int32']);
  proc.setResType('int32');
  proc.setExport(true);

  proc.assign('s', 0);
  proc.forStmt(proc.assign('i', 0),
               proc.lessthan('i', args(2)),
               proc.assign('i', proc.add('i', 1)),
               proc.assign('s',
                 proc.add('s', proc.deref(args(0), 'i'))));
  return 's';
};
