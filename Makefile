
asmjit-c.js : $(shell find src/ -name "*.js")
	closurebuilder.py --root=src --namespace=asmjit.driver \
		--compiler_flags="--compilation_level=SIMPLE_OPTIMIZATIONS" \
		--output_file=$@

clean :
	rm asmjit-c.js

