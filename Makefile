all : asmjit-c.js scheme-c.js

asmjit-c.js : $(shell find src/ -name "*.js")
	closurebuilder.py --root=src --namespace=asmjit.driver \
		--compiler_flags="--compilation_level=SIMPLE_OPTIMIZATIONS" \
		--output_file=$@

scheme-c.js : $(shell find src/ -name "*.js") $(shell find toys/ -name "*.js")
	closurebuilder.py --root=src --root=toys --namespace=lang.scheme \
		--compiler_flags="--compilation_level=SIMPLE_OPTIMIZATIONS" \
		--output_file=$@

clean :
	rm asmjit-c.js scheme-c.js

