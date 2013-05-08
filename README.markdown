### What's this

A code generation library targetting [asm.js](http://asmjs.org/spec/latest/).

### Is asm.js fast?

Reasonably fast. For micro-benchmarks like recursively calculating fibonacci,
IonMonkey-trunk can be 2x faster than v8-trunk.

And here's the x86-64 code generated from asm.js's fibonacci function:

    0x00007ffff7f6d000:  sub    $0x18,%rsp
    0x00007ffff7f6d004:  mov    $0x16b4c18,%r11d  # Load stackPtr limit
    0x00007ffff7f6d00a:  cmp    %rsp,(%r11)       # Stack check
    0x00007ffff7f6d00d:  jae    0x7ffff7f6e228    # Handle stack overflow
    0x00007ffff7f6d013:  mov    %rdi,%rax
    0x00007ffff7f6d016:  cmp    $0x2,%eax
    0x00007ffff7f6d019:  jge    0x7ffff7f6d024
    0x00007ffff7f6d01f:  jmpq   0x7ffff7f6d050    # This one can be killed
    0x00007ffff7f6d024:  mov    %rax,%rdi
    0x00007ffff7f6d027:  sub    $0x1,%edi
    0x00007ffff7f6d02a:  mov    %rax,0x10(%rsp)
    0x00007ffff7f6d02f:  callq  0x7ffff7f6d000
    0x00007ffff7f6d034:  mov    0x10(%rsp),%rdi
    0x00007ffff7f6d039:  sub    $0x2,%edi
    0x00007ffff7f6d03c:  mov    %rax,0x8(%rsp)
    0x00007ffff7f6d041:  callq  0x7ffff7f6d000
    0x00007ffff7f6d046:  mov    0x8(%rsp),%rcx
    0x00007ffff7f6d04b:  add    %eax,%ecx
    0x00007ffff7f6d04d:  mov    %rcx,%rax
    0x00007ffff7f6d050:  add    $0x18,%rsp
    0x00007ffff7f6d054:  retq   


### But emscripten can already generate asm.js!

Yes, I know that. But sometimes we may need jit...
Also, It's fun to write this library.

