# STEGO·STUDIO — Pacote completo do repositório (v2.42.1)

Tudo que o repo precisa, na versão mais atual. Substitui o conteúdo anterior.

**Código-fonte público:** github.com/rickschaves/stegostudio — GPL-3.0.

## Estrutura
- `docs/STEGO_STUDIO_CHANGELOG.md` — histórico completo de versões.
- `docs/MEDICAO_REDES_SOCIAIS.md` — as medições de WhatsApp, X, Facebook e
  Instagram, com as provas. **Dado caro, não refaça.**
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
- `LICENSE` — GPL-3.0, texto canônico da FSF.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md` — **em inglês**, para o público
  externo. O repositório está migrando para inglês no que o leitor de fora
  encontra; changelog e comentários de código seguem em português.
- `README.md` — descrição pública (em inglês), para o GitHub.
- `HTML_PRODUCAO/` — **um único arquivo**, o da versão atual. Ao publicar uma
  versão nova, apague o HTML anterior; dois arquivos ali significam que alguém
  vai baixar o errado.

Fora do repositório público, pelo `.gitignore`: `ROADMAP_STEGO_STUDIO.md`,
`STEGO_STUDIO_CONTEXTO_BASTÃO.md` e `STEGO_STUDIO_CONTEXTO_ORIGINAL.md` — são
documentos internos de trabalho. Continuam no pacote zip.

## Como buildar
    node unpack_assets.js   # 1ª vez: recria src/fonts/ e deploy/
    node build.js           # gera dist/stego_studio_v<VERSION>.html
    node test.js            # 12 invariantes

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

⚠️ **Este arquivo NÃO entra nesse bump automático.** Ele já foi corrompido por
`sed` cego trocando número por número — o cabeçalho ficou numa versão e o corpo
em outra, e nenhum invariante pega isso porque é texto de documentação. **Edite
à mão e releia.**

## Estado
- **v2.42.1** — hardening: 4 sinks de XSS restantes, textos, limites de memória.
- **v2.42.0** — hardening: XSS de metadados, C2PA sem validação, veto de EXIF.
- **v2.41.0** — licença GPL-3.0 e código-fonte publicado no GitHub.
- **v2.40.0** — Modo Pro removido: offline sem exceção, sem backend nem chave.
- **F4** (modo robusto), **JPEG progressivo** (v2.36.0), **F9** (impressão
  digital de ferramenta, v2.39.0) e **F14** (licença, v2.41.0) concluídas.
- Próxima frente: **F13** — submeter ao catálogo do Lerch (textos prontos no
  roadmap). Na fila de código: **F10 fatia 1** (JSteg ou investigar stegosuite)
  e **F12 degrau 1** (7 modos do rijndael-128).
