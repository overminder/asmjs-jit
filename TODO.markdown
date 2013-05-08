### As a jit library

- Should be easier to use than directly targeting asm.js
- This includes: strong typing, type inference and explicit casting
- Automatic local and global variable management
- Automatic pointer management
- Automatic function pointer management
- Support for tail recursion opt (transform to loop)
  and tail call opt (by trampolining)?
  * Note that TCO will cause a ~6x (vs native asm.js in ionmonkey, or 3x vs v8)
    slow down in tight tail-calling loops.

- Don't insert |0 in chrome since v8's i32 narrowing is currently broken
  (although that's just fixed in the upstream but appearently not yet
  applied to node-0.8.22 and chrome-26)

