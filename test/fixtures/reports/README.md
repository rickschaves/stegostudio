# Relatórios do smoke test — v2.42.4 (12/08/2026)

Exportados de um smoke test **real** no navegador, não sintetizados. Foram eles
que expuseram os dois defeitos corrigidos na v2.42.5:

| arquivo | papel |
|---|---|
| `..._imagem_limpa_...` | controle sem stego, com C2PA — saturava em 100 |
| `..._encoded_..._pass_correct` | PNG nativo, senha certa — extração não pesava |
| `..._encoded_..._pass_incorrect` | mesmo arquivo, senha errada — controle negativo |
| `..._resistente_..._pass_correct` | JPEG robusto, senha certa — já correto |
| `..._resistente_..._pass_incorrect` | mesmo arquivo, senha errada — controle negativo |

Os pares "mesma imagem, senha certa vs. errada" são o que torna o conjunto útil:
isolam o efeito da extração de tudo o mais.

O CHECK 15 usa relatórios **mínimos derivados** destes, não os arquivos brutos —
eles são grandes e cheios de campo irrelevante. Estes ficam como referência e
como base da F17.

**Não regenerar.** Vieram de uma sessão de navegador que não se repete igual.

## F1 / v2.42.10

A subpasta `f1_v2.42.10/` preserva os três relatórios que mostraram a assimetria
de evidência entre duas senhas válidas e motivaram a v2.42.11. São história do
bug e não devem ser “corrigidos” retroativamente.
