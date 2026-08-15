# F1 / duas mensagens — evidência do bug da v2.42.10

Três relatórios exportados da **mesma imagem v2.29.0** durante o smoke de
14/08/2026. São preservados como evidência histórica do defeito que motivou a
v2.42.11.

- senha errada → nenhuma mensagem / sem confirmação nativa;
- senha 1424 → `Mensagem alternativa`, mas sem `nativeExtracted` na v2.42.10;
- senha 2414 → `Teste encode mensagem real v2.29.0` + `nativeExtracted`.

Não editar estes JSONs para “ficarem certos”: eles documentam o comportamento
antigo. O CHECK 18 usa um vetor binário compacto separado, extraído da mesma
imagem, para a regressão executável.
