# Budama 2. adım: ONNX modelindeki kelime gömme matrisini yalnız tutulan parçaların satırlarına indirir.
# python3 -I budama.py <model_quantized.onnx> <sozluk.json> <cikti.onnx>
# Satırlar olduğu gibi kopyalanır (aynı ölçek ve sıfır noktası), yani tutulan parçaların gömmesi birebir aynıdır.
import sys, json
import numpy as np, onnx
from onnx import numpy_helper
giris, sozluk, cikti = sys.argv[1:4]
ids = np.array(json.load(open(sozluk))['eski'], dtype=np.int64)
assert list(ids[:4]) == [0, 1, 2, 3], 'özel parçalar 0-3 yerinde kalmalı (<pad>=1 konum kimliği için)'
m = onnx.load(giris)
for i, t in enumerate(m.graph.initializer):
    if t.name == 'embeddings.word_embeddings.weight_quantized':
        a = numpy_helper.to_array(t); yeni = numpy_helper.from_array(np.ascontiguousarray(a[ids]), t.name)
        m.graph.initializer[i].CopyFrom(yeni); print('kelime gömmesi', a.shape, '->', a[ids].shape)
onnx.save(m, cikti)
import os; print(cikti, round(os.path.getsize(cikti) / 1e6, 1), 'MB')
