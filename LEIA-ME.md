# STEGO·STUDIO — Pacote completo do repositório (v2.38.2)

Tudo que o repo precisa, na versão mais atual. Substitui o conteúdo anterior.

## Estrutura
- **`docs/STEGO_STUDIO_CONTEXTO_BASTÃO.md`** — ⭐ **comece por aqui.** É o
  documento de passagem de bastão: quem é quem, ritual de trabalho, princípios,
  onde estamos, para onde vamos, e os erros que já cometemos para não repetir.
- `docs/STEGO_STUDIO_CONTEXTO_ORIGINAL.md` — o contexto original, preservado.
- `docs/ROADMAP_STEGO_STUDIO.md` — frentes, decisões e justificativas.
- `docs/STEGO_STUDIO_CHANGELOG.md` — histórico completo de versões.
- `docs/MEDICAO_REDES_SOCIAIS.md` — as medições de WhatsApp, X, Facebook e
  Instagram, com as provas. **Dado caro, não refaça.**
- `docs/README.md` — descrição pública do projeto.
- `src/` — os **16 módulos** do build + `styles.css` + `hash-wasm.js` +
  `fonts/` (5 woff2).
- `template.html` — **na raiz, e só lá.** O `build.js` lê de `__dirname`, nunca
  de `src/`. Se aparecer uma cópia em `src/`, ela é órfã: o build a ignora e
  alguém vai acabar editando a errada. Apague.
- `build.js` e `test.js` — na raiz. O build espera `src/` ao lado.
- `ASSETS_BASE64.md` + `unpack_assets.js` — **os binários do projeto, em texto.**
  O repo rejeita `.woff2`/`.ico` e transcodifica PNG para JPEG (destruindo o
  alfa), então fontes e ícones vivem aqui em base64 com SHA-256. Rode
  `node unpack_assets.js` para reconstruir `src/fonts/` (necessário para
  buildar) e `deploy/` (o que sobe para a Cloudflare).
- `HTML_PRODUCAO/stego_studio_v2.38.2.html` — arquivo único para deploy.

## Como buildar
    node unpack_assets.js   # 1ª vez: recria src/fonts/ e deploy/
    node build.js           # gera dist/stego_studio_v2.38.2.html
    node test.js            # 11 invariantes

## Deploy
O HTML de produção sobe para a Cloudflare **renomeado para `index.html`**,
junto com os 10 estáticos da pasta `deploy/`, todos na raiz do diretório de
upload. O upload direto da Cloudflare Pages **substitui o diretório inteiro** —
subir só o `index.html` apaga os favicons, o `og-image.png` e o `sitemap.xml`.

## Bump de versão — toca exatamente 5 pontos
1. `build.js` → `const VERSION`
2. `src/main.js` → string `_tool`
3. `template.html` → versão no logo do header (**não é injetada pelo build**)
4. `src/ui.js` → primeira entrada do array `CHANGELOG`
5. `docs/STEGO_STUDIO_CHANGELOG.md`

O `test.js` cobre os pontos 1–4 via HTML final; o 5 é manual.

## Estado
- **v2.41.0** — Modo Pro removido: offline sem exceção, sem backend nem chave.
- **F4** (modo robusto), **JPEG progressivo** (v2.36.0) e **F9** (impressão
  digital, v2.39.0) concluídas.
- Próxima frente: **F14** — licença e repositório público.
