### As a jit library

- Should be easier to use than directly targeting asm.js
- This includes: strong typing, type inference and explicit casting
- Automatic local and global variable management
- Automatic pointer management
- Automatic function pointer management
- Support for tail recursion (to loop) and tail call elim (by trampol)?

- Don't insert |0 in chrome since v8's i32 narrowing is currently broken (and
  just fixed in the upstream but appearently not applied to node and chrome 26)
