function showHelpModal() {
  document.getElementById('help-overlay').classList.add('visible');
  // Comportamento exclusivo SEM flash de scroll: interceptamos o clique no
  // summary e controlamos open/close de forma síncrona — fechamos as outras
  // seções no mesmo frame em que abrimos a atual, evitando o instante em que
  // duas ficam abertas e a barra de rolagem pisca.
  const sections = document.querySelectorAll('#help-overlay .help-section');
  sections.forEach(sec => {
    if (!sec.dataset.exclusiveBound) {
      const summary = sec.querySelector('summary');
      if (summary) {
        summary.addEventListener('click', (e) => {
          e.preventDefault(); // impede o toggle nativo do <details>
          const willOpen = !sec.open;
          // Fecha todas antes de abrir a escolhida — tudo no mesmo frame
          sections.forEach(other => { other.open = false; });
          sec.open = willOpen;
        });
      }
      sec.dataset.exclusiveBound = '1';
    }
  });
}
function hideHelpModal() {
  document.getElementById('help-overlay').classList.remove('visible');
}

// ── Histórico de versões (changelog) ──
// Cada item: {t:'add'|'chg'|'fix', en:'...', pt:'...'}. Texto curto, pode usar <b>.
// CHANGELOG contém versões semver (v2.10+). CHANGELOG_LEGACY preserva versões pré-semver (≤ v2.9.1),
// exibidas com sufixo "— Legacy". O divisor entre os dois é renderizado em renderChangelog.
const CHANGELOG = [
  { ver:'v2.43.12', date:'2026-08-18', title:{en:'Cleaner stegomalware previews',pt:'Prévia de stegomalware mais limpa'}, items:[
    {t:'fix', en:'<b>Self-contained stegomalware indicators no longer repeat unrelated surrounding message text.</b> URLs, crypto addresses and long Base64 blobs show only the matched indicator, while script-like triggers keep the short Unicode-safe context needed to show the relevant code.', pt:'<b>Indicadores autocontidos de stegomalware não repetem mais trechos sem relação da mensagem ao redor.</b> URLs, endereços cripto e blobs Base64 longos mostram apenas o indicador encontrado, enquanto gatilhos como scripts mantêm o contexto curto e Unicode-safe necessário para exibir o código relevante.'},
  ]},
  { ver:'v2.43.11', date:'2026-08-18', title:{en:'Unicode-safe warnings and better recovered filenames',pt:'Avisos Unicode íntegros e nomes de arquivos recuperados melhores'}, items:[
    {t:'fix', en:'<b>Stegomalware context previews no longer split emoji or other supplementary Unicode characters at the crop boundary.</b> Warning snippets stay readable in the interface and remain safe to persist from exported reports.', pt:'<b>Os trechos de contexto do stegomalware não cortam mais emojis ou outros caracteres Unicode suplementares no meio.</b> Os avisos permanecem legíveis na interface e seguros para persistência a partir dos relatórios exportados.'},
    {t:'fix', en:'<b>Long recovered-file names now keep their final extension when Save file shortens the name.</b> Formats such as .zip, .png and .pdf remain identifiable after download.', pt:'<b>Nomes longos de arquivos recuperados agora preservam a extensão final quando Salvar arquivo encurta o nome.</b> Formatos como .zip, .png e .pdf continuam identificáveis após o download.'},
    {t:'chg', en:'<b>The Password ignored notice is shorter and clearer.</b> When the supplied password was not needed by the winning recovery path, the panel now states that the message was recovered without a password.', pt:'<b>O aviso Senha ignorada ficou mais curto e claro.</b> Quando a senha informada não foi necessária na rota vencedora, o painel agora informa que a mensagem foi recuperada sem senha.'},
  ]},
  { ver:'v2.43.10', date:'2026-08-18', title:{en:'Clearer Threat semantics and richer stegomalware context',pt:'Threat mais claro e contexto mais útil de stegomalware'}, items:[
    {t:'chg', en:'<b>Threat 100 is now reserved for direct confirmed recovery.</b> Strong heuristic evidence without a validated recovery can still reach 99 / HIGH, but no longer shares the terminal number used by CONFIRMED results.', pt:'<b>O Threat 100 agora fica reservado à recuperação direta confirmada.</b> Evidência heurística forte sem recuperação validada ainda pode chegar a 99 / ALTO, mas não compartilha mais o número terminal usado por resultados CONFIRMADOS.'},
    {t:'fix', en:'<b>Stegomalware warnings now show useful bounded context around the detected pattern instead of only the fragment that triggered the rule.</b> Recovered code remains inert text and is never interpreted as HTML.', pt:'<b>Os avisos de stegomalware agora mostram um contexto curto e útil ao redor do padrão detectado, em vez de apenas o fragmento que disparou a regra.</b> Código recuperado continua sendo exibido como texto inerte e nunca é interpretado como HTML.'},
  ]},
  { ver:'v2.43.9', date:'2026-08-18', title:{en:'Byte-exact recovered files and more accurate password context',pt:'Arquivos recuperados byte a byte e contexto de senha mais preciso'}, items:[
    {t:'fix', en:'<b>Password ignored is no longer shown when the supplied password was actually required to reveal a concealed header or reconstruct a shuffled legacy payload.</b> The note now explains that the recovered message does not require the supplied password.', pt:'<b>Senha ignorada não aparece mais quando a senha informada foi realmente necessária para revelar um header furtivo ou reconstruir um payload legado embaralhado.</b> O aviso agora explica que a mensagem recuperada não exige a senha informada.'},
    {t:'fix', en:'<b>Files recovered through compatible third-party methods now preserve their original bytes for saving.</b> Binary payloads are presented as recovered files instead of lossy UTF-8 text, while genuine text remains readable and copyable; declared compressed content is only offered after successful decompression.', pt:'<b>Arquivos recuperados por métodos compatíveis de terceiros agora preservam os bytes originais ao salvar.</b> Payloads binários são apresentados como arquivos recuperados em vez de texto UTF-8 corrompido, enquanto conteúdo textual continua legível e copiável; conteúdo declarado como comprimido só é oferecido após descompressão bem-sucedida.'},
  ]},
  { ver:'v2.43.8', date:'2026-08-17', title:{en:'Clearer password handling and consistent modal scrollbars',pt:'Uso de senha mais claro e scrollbars consistentes nos modais'}, items:[
    {t:'fix', en:'<b>If a password is supplied but recovery succeeds without using it, the decoded-message panel now says Password ignored.</b> An unnecessary password no longer looks like a validated password, and unprotected robust JPEG can fall back to its no-password path.', pt:'<b>Se uma senha for informada mas a recuperação acontecer sem usá-la, o quadro da mensagem agora avisa Senha ignorada.</b> Uma senha desnecessária não parece mais uma senha validada, e o JPEG resistente sem proteção pode voltar corretamente ao caminho sem senha.'},
    {t:'chg', en:'<b>How it works, Version history and About this project now use the same styled internal scrollbar language as the rest of the interface.</b>', pt:'<b>Como Funciona, Histórico de versões e Sobre este projeto agora usam a mesma linguagem visual de scrollbar interna do restante da interface.</b>'},
  ]},
  { ver:'v2.43.7', date:'2026-08-17', title:{en:'Stronger direct-recovery evidence and smaller PNG output',pt:'Evidência direta mais forte e saída PNG menor'}, items:[
    {t:'chg', en:'<b>Complete direct recovery through supported compatible methods now closes Threat at 100 / CONFIRMED.</b> Identification without recovered content and partial/truncated recovery remain below the terminal state.', pt:'<b>A recuperação direta completa por métodos compatíveis suportados agora fecha o Threat em 100 / CONFIRMADO.</b> Identificação sem conteúdo recuperado e recuperação parcial/truncada permanecem abaixo do estado terminal.'},
    {t:'chg', en:'<b>Successful Decode Status now uses the same Message recovered ✓ wording across recovery methods.</b> The identified method and protection remain separate evidence.', pt:'<b>O Decode Status de sucesso agora usa a mesma mensagem Mensagem recuperada ✓ entre os métodos de recuperação.</b> O método identificado e a proteção permanecem como evidências separadas.'},
    {t:'chg', en:'<b>PNG output now uses adaptive lossless row filtering before DEFLATE.</b> This can substantially reduce output size on many images without changing decoded pixels or the hidden payload.', pt:'<b>A saída PNG agora usa filtragem lossless adaptativa por linha antes do DEFLATE.</b> Isso pode reduzir substancialmente o tamanho em muitas imagens sem alterar os pixels decodificados nem o payload oculto.'},
    {t:'fix', en:'<b>The expanded Encoder editor now covers both real and alternative messages consistently.</b> Compact in-field controls no longer compete with the scrollbar, manual textarea resizing is removed, and the modal shows carrier capacity when available.', pt:'<b>O editor expandido do Encoder agora atende de forma consistente às mensagens real e alternativa.</b> Controles compactos dentro do campo não competem mais com a scrollbar, o redimensionamento manual foi removido e o modal mostra a capacidade da portadora quando disponível.'},
  ]},
  { ver:'v2.43.6', date:'2026-08-17', title:{en:'Format-aware steganalysis and safer message editing',pt:'Esteganálise por formato e edição de mensagem mais segura'}, items:[
    {t:'chg', en:'<b>The Analyzer now shows only the steganalysis family that applies to the file.</b> Lossless images use one format / LSB accordion, while JPEG uses JPEG / DCT; Decode Status now lives in the applicable surface instead of an unavailable panel.', pt:'<b>O Analyzer agora mostra apenas a família de esteganálise aplicável ao arquivo.</b> Imagens lossless usam um único accordion formato / LSB, enquanto JPEG usa JPEG / DCT; o Decode Status agora fica na superfície aplicável em vez de um painel indisponível.'},
    {t:'chg', en:'<b>JPEG / DCT now reports Method identified instead of separate native/third-party rows.</b> STEGO·STUDIO Robust and compatible third-party methods share the same public label, while locked, damaged and invalid robust states remain separate.', pt:'<b>JPEG / DCT agora informa Método identificado em vez de linhas separadas para o modo nativo e terceiros.</b> STEGO·STUDIO Resistente e métodos compatíveis de terceiros usam o mesmo rótulo público, enquanto estados resistente bloqueado, danificado ou inválido continuam separados.'},
    {t:'add', en:'<b>The Encoder message field can open a larger synchronized editor.</b> Real line breaks and Unicode formatting are preserved, while literal sequences such as \\n remain literal text. Recovered messages keep the bounded scroll view with Copy and Save TXT.', pt:'<b>O campo de mensagem do Encoder agora pode abrir um editor maior e sincronizado.</b> Quebras de linha reais e Unicode são preservados, enquanto sequências literais como \\n continuam sendo texto literal. Mensagens recuperadas mantêm a visualização limitada com scroll, Copiar e Salvar TXT.'},
    {t:'fix', en:'<b>An EXIF read failure is no longer scored as missing camera metadata by the origin classifier.</b> Unreadable metadata is treated as unknown instead of generating absence labels and weights.', pt:'<b>Uma falha de leitura EXIF não é mais pontuada como ausência de metadados de câmera pelo classificador de origem.</b> Metadados ilegíveis passam a ser tratados como desconhecidos em vez de gerar rótulos e pesos de ausência.'},
  ]},
  { ver:'v2.43.5', date:'2026-08-17', title:{en:'Richer JPEG evidence and better long-message handling',pt:'Evidência JPEG mais rica e mensagens longas melhores'}, items:[
    {t:'fix', en:'<b>Recovered messages are no longer silently cut at 5,000 characters on robust-JPEG and supported third-party extraction paths.</b> Long messages stay complete in the report while the on-screen box uses internal scroll plus Expand, Copy and Save TXT controls.', pt:'<b>Mensagens recuperadas não são mais cortadas silenciosamente em 5.000 caracteres nos caminhos JPEG robusto e de terceiros compatíveis.</b> Mensagens longas ficam completas no relatório enquanto a caixa na tela usa scroll interno, além de Expandir, Copiar e Salvar TXT.'},
    {t:'add', en:'<b>The JPEG / DCT panel now brings JPEG structure and direct extraction evidence together.</b> It shows robust-mode state, Reed-Solomon corrections and third-party engine evidence, explaining why a direct recovery can be CONFIRMED even when simple DCT statistics look normal.', pt:'<b>O painel JPEG / DCT agora reúne estrutura JPEG e evidência de extração direta.</b> Ele mostra estado do modo resistente, correções Reed-Solomon e evidência de motores de terceiros, explicando por que uma recuperação direta pode ficar CONFIRMADA mesmo quando estatísticas DCT simples parecem normais.'},
    {t:'fix', en:'<b>Encoder character counts now match the exact trimmed text that will be encoded.</b> The capacity meter and the post-encode statistics no longer disagree because of leading/trailing whitespace.', pt:'<b>A contagem de caracteres do Encoder agora corresponde exatamente ao texto aparado que será codificado.</b> O medidor de capacidade e as estatísticas após o encode não divergem mais por causa de espaços ou quebras nas bordas.'},
    {t:'chg', en:'<b>EXIF/XMP badges now call out camera-identification gaps in words.</b> Unavailable metadata, partial camera IDs and metadata with no complete camera ID are distinct states, so the warning no longer depends on color alone.', pt:'<b>Os badges EXIF/XMP agora destacam em texto lacunas na identificação da câmera.</b> Metadados indisponíveis, ID parcial e metadados sem ID completo de câmera são estados distintos, então o alerta não depende mais apenas da cor.'},
  ]},
  { ver:'v2.43.4', date:'2026-08-17', title:{en:'Stricter confirmed robust-JPEG recovery',pt:'Confirmação JPEG robusta mais estrita'}, items:[
    {t:'fix', en:'<b>An authenticated but empty robust-JPEG payload is no longer treated as recovered content or promoted to 100 / CONFIRMED.</b> Valid password-protected and compressed robust messages continue to decode normally.', pt:'<b>Um payload JPEG robusto autenticado, mas vazio, não é mais tratado como conteúdo recuperado nem promovido a 100 / CONFIRMADO.</b> Mensagens robustas válidas com senha e mensagens comprimidas continuam sendo decodificadas normalmente.'},
  ]},
  { ver:'v2.43.3', date:'2026-08-17', title:{en:'Safer robust-JPEG recovery validation',pt:'Validação mais segura da recuperação JPEG robusta'}, items:[
    {t:'fix', en:'<b>Malformed, truncated or unreadable inner content in a STEGO·STUDIO robust JPEG can no longer be promoted to 100 / CONFIRMED.</b> Valid password-protected and compressed no-password robust messages remain supported.', pt:'<b>Conteúdo interno malformado, truncado ou ilegível em um JPEG robusto do STEGO·STUDIO não pode mais ser promovido a 100 / CONFIRMADO.</b> Mensagens robustas válidas com senha e mensagens comprimidas sem senha continuam compatíveis.'},
  ]},
  { ver:'v2.43.2', date:'2026-08-17', title:{en:'Confirmed Threat aligned for robust JPEG',pt:'Threat confirmado alinhado no JPEG robusto'}, items:[
    {t:'fix', en:'<b>A successfully recovered STEGO·STUDIO robust JPEG now shows the same 100 / CONFIRMED Threat state as a directly recovered native PNG.</b> Passive JPEG analysis and failed/no-password attempts keep their existing scores.', pt:'<b>Um JPEG robusto do STEGO·STUDIO recuperado com sucesso agora mostra o mesmo estado Threat 100 / CONFIRMADO de um PNG nativo recuperado diretamente.</b> A análise passiva do JPEG e tentativas sem senha/com falha mantêm os scores existentes.'},
  ]},
  { ver:'v2.43.1', date:'2026-08-17', title:{en:'Robust JPEG restored, confirmed Threat, faster mobile swipe',pt:'JPEG robusto restaurado, Threat confirmado e swipe mais rápido'}, items:[
    {t:'fix', en:'<b>Password-protected encodes once again generate the sturdier JPEG companion image.</b> Protected PNG keeps the new F21 structure, while the robust JPEG keeps its existing compatible payload format.', pt:'<b>Codificações protegidas por senha voltam a gerar a imagem JPEG mais resistente.</b> O PNG protegido mantém a nova estrutura F21, enquanto o JPEG robusto preserva seu formato de payload compatível já existente.'},
    {t:'chg', en:'<b>When a native STEGO·STUDIO PNG/lossless message is directly recovered, Threat now shows 100 / CONFIRMED.</b> Passive scores and failed/absent-password analyses keep their existing heuristic weights.', pt:'<b>Quando uma mensagem nativa STEGO·STUDIO em PNG/lossless é recuperada diretamente, o Threat agora mostra 100 / CONFIRMADO.</b> Scores passivos e análises com senha ausente/incorreta mantêm os pesos heurísticos existentes.'},
    {t:'chg', en:'<b>High Capacity Mode now describes its trade-off without promising that every RGB output will score as more detectable.</b> It prioritizes room over minimizing embedding changes and can leave stronger statistical traces, especially with larger payloads; STC remains the stealth-oriented default.', pt:'<b>O Modo de Alta Capacidade agora descreve o trade-off sem prometer que toda saída RGB terá score mais detectável.</b> Ele prioriza espaço em vez de minimizar as alterações do embedding e pode deixar traços estatísticos mais fortes, especialmente com payloads maiores; STC continua sendo o padrão orientado à furtividade.'},
    {t:'chg', en:'<b>Mobile tab switching now accepts a short fast flick and needs a much shorter normal drag.</b> Vertical scrolling, system edge gestures, reversal before release and touch-click suppression remain preserved.', pt:'<b>A troca de abas no celular agora aceita um flick curto e rápido e exige um arrasto normal bem menor.</b> Rolagem vertical, gestos das bordas do sistema, reversão antes de soltar e supressão do clique pós-swipe continuam preservados.'},
  ]},
  { ver:'v2.43.0', date:'2026-08-16', title:{en:'Stronger protection for password-protected PNG payloads',pt:'Proteção mais forte para payloads PNG com senha'}, items:[
    {t:'chg', en:'<b>New password-protected lossless images now use a fresh structural salt for every encode and independent derived keys for header protection, body order where applicable, and AES-GCM content.</b> The previous 32-bit structural seed is no longer used by this PNG path; effective security still depends on password strength.', pt:'<b>Novas imagens lossless protegidas por senha agora usam um salt estrutural novo a cada codificação e chaves derivadas independentes para proteção do header, ordem do corpo quando aplicável e conteúdo AES-GCM.</b> A antiga seed estrutural de 32 bits não é mais usada nesse caminho PNG; a segurança efetiva continua dependendo da força da senha.'},
    {t:'fix', en:'<b>Protected header data is authenticated before its mode or declared body size is trusted.</b> If the header is valid but the protected body is damaged, the Decoder now reports that distinction instead of treating it as an ordinary failed recovery.', pt:'<b>Os dados do header protegido são autenticados antes que o modo ou o tamanho declarado do corpo sejam considerados confiáveis.</b> Se o header for válido mas o corpo protegido estiver danificado, o Decoder agora informa essa diferença em vez de tratar o caso como uma falha comum de recuperação.'},
    {t:'chg', en:'<b>Existing STEGO·STUDIO images remain decodable.</b> New images saved without a password keep the existing format. A passive analysis without the password may not identify the new protected PNG header; that absence is not treated as evidence that no hidden content exists.', pt:'<b>Imagens STEGO·STUDIO existentes continuam decodificáveis.</b> Novas imagens salvas sem senha mantêm o formato existente. Uma análise passiva sem a senha pode não identificar o novo header PNG protegido; essa ausência não é tratada como evidência de que não existe conteúdo oculto.'},
    {t:'chg', en:'<b>Password-protected PNG capacity now accounts for the stronger bootstrap overhead.</b> Very small carriers may therefore have less usable room than before.', pt:'<b>A capacidade de PNGs protegidos por senha agora considera o overhead do bootstrap mais forte.</b> Por isso, portadoras muito pequenas podem ter menos espaço utilizável do que antes.'},
    {t:'fix', en:'<b>The Encoder stealth self-check now says only what its built-in checks measured.</b> Passing its threshold is no longer described as being statistically indistinguishable from noise.', pt:'<b>O auto-check furtivo do Encoder agora diz apenas o que as verificações internas mediram.</b> Passar pelo limiar não é mais descrito como ser estatisticamente indistinguível de ruído.'},
  ]},
  { ver:'v2.42.35', date:'2026-08-16', title:{en:'Smoother mobile swipe',pt:'Swipe móvel mais fluido'}, items:[
    {t:'chg', en:'<b>Mobile swipe now starts across almost the whole working panel, including image drop areas, buttons, labels and accordion headers.</b> A normal tap still acts normally; once a horizontal drag is clearly established, the panel follows the finger and the accidental click that would follow the swipe is suppressed.', pt:'<b>O swipe móvel agora pode começar em quase todo o painel de trabalho, inclusive áreas de imagem, botões, labels e cabeçalhos de accordion.</b> Um toque normal continua funcionando normalmente; quando um arrasto horizontal fica claro, o painel acompanha o dedo e o clique acidental que viria depois do swipe é suprimido.'},
    {t:'chg', en:'<b>Changing tabs now requires a substantially longer drag.</b> Short and indecisive movements return to the current tab, making accidental tab changes much less likely.', pt:'<b>Trocar de aba agora exige um arrasto consideravelmente mais longo.</b> Movimentos curtos ou indecisos retornam à aba atual, reduzindo bastante trocas acidentais.'},
    {t:'fix', en:'<b>Switching tabs no longer restarts the terminal typing animation.</b> The existing terminal state is preserved, reducing unnecessary work and making repeated swipes feel smoother on mobile.', pt:'<b>Trocar de aba não reinicia mais a animação de digitação do terminal.</b> O estado existente do terminal é preservado, reduzindo trabalho desnecessário e deixando swipes repetidos mais suaves no celular.'},
  ]},
  { ver:'v2.42.34', date:'2026-08-16', title:{en:'Interactive mobile swipe',pt:'Swipe móvel interativo'}, items:[
    {t:'chg', en:'<b>The mobile swipe now follows the finger continuously.</b> The current panel moves out while the neighboring panel enters at the same rate; reversing the finger reverses the interface before release.', pt:'<b>O swipe móvel agora acompanha continuamente o dedo.</b> O painel atual sai enquanto o painel vizinho entra na mesma proporção; inverter o movimento do dedo também inverte a interface antes de soltar.'},
    {t:'chg', en:'<b>Releasing early snaps back; crossing the commit distance completes the transition smoothly.</b> Vertical scrolling remains native until horizontal intent is clear, and browser/system edge space stays reserved.', pt:'<b>Soltar cedo faz a interface voltar; ultrapassar a distância de confirmação completa a transição suavemente.</b> A rolagem vertical permanece nativa até a intenção horizontal ficar clara, e as bordas continuam reservadas ao navegador/sistema.'},
    {t:'fix', en:'<b>The neighboring panel is anchored to the live mobile viewport during the gesture.</b> Mobile browser chrome changes no longer cancel a valid swipe, and an explicit tab tap immediately clears any pending swipe animation.', pt:'<b>O painel vizinho fica ancorado ao viewport móvel real durante o gesto.</b> Mudanças nas barras do navegador móvel não cancelam mais um swipe válido, e tocar explicitamente numa aba limpa imediatamente qualquer animação pendente.'},
  ]},
  { ver:'v2.42.33', date:'2026-08-16', title:{en:'First mobile swipe',pt:'Primeiro swipe móvel'}, items:[
    {t:'add', en:'<b>Introduced the first optional mobile swipe between Encode and Analyze · Decode.</b> The initial implementation changed tabs after a completed horizontal gesture while keeping the visible tabs as the canonical controls.', pt:'<b>Introduziu o primeiro swipe móvel opcional entre Encode e Analyze · Decode.</b> A implementação inicial trocava de aba após a conclusão de um gesto horizontal, mantendo as abas visíveis como controles canônicos.'},
    {t:'fix', en:'<b>The first swipe preserved vertical scrolling, rejected multi-touch/cancelled sequences and reserved browser/system edge gestures.</b>', pt:'<b>O primeiro swipe preservava a rolagem vertical, rejeitava sequências multitouch/canceladas e reservava gestos de borda do navegador/sistema.</b>'},
  ]},
  { ver:'v2.42.32', date:'2026-08-16', title:{en:'Safer Analyzer result rendering',pt:'Renderização mais segura dos resultados do Analyzer'}, items:[
    {t:'fix', en:'<b>Additional Analyzer values are now displayed safely as text.</b> Crafted file content in these result surfaces cannot be interpreted as HTML markup.', pt:'<b>Valores adicionais do Analyzer agora são exibidos com segurança como texto.</b> Conteúdo preparado no arquivo nessas superfícies de resultado não pode ser interpretado como markup HTML.'},
    {t:'fix', en:'<b>Unknown header-like prefixes found during deep scan remain untrusted and are displayed safely as text.</b>', pt:'<b>Prefixos desconhecidos semelhantes a headers encontrados no deep scan continuam sem confiança e são exibidos com segurança como texto.</b>'},
    {t:'chg', en:'<b>Legacy forensic-report-v2 values remain unchanged for compatibility.</b>', pt:'<b>Valores legados do forensic-report-v2 permanecem inalterados por compatibilidade.</b>'},
  ]},
  { ver:'v2.42.31', date:'2026-08-16', title:{en:'Safer display of forensic values',pt:'Exibição mais segura dos valores forenses'}, items:[
    {t:'fix', en:'<b>More forensic result fields are now displayed safely as text.</b> This includes Strings notes and types, detected header names, rare-color details, social-platform labels and AI format labels.', pt:'<b>Mais campos dos resultados forenses agora são exibidos com segurança como texto.</b> Isso inclui notas e tipos de Strings, nomes de header detectados, detalhes de cores raras, rótulos de plataformas sociais e rótulos de formato da IA.'},
  ]},
  { ver:'v2.42.30', date:'2026-08-16', title:{en:'Clearer AI labels and safer unavailable messages',pt:'Rótulos de IA mais claros e mensagens de indisponibilidade mais seguras'}, items:[
    {t:'fix', en:'<b>Vector/icon and digital-graphic AI labels no longer imply likelihood or a negative origin verdict.</b> They describe observed patterns while keeping the heuristic score capped.', pt:'<b>Os rótulos de IA para arte vetorial/ícones e gráficos digitais não implicam mais probabilidade nem um veredito negativo de origem.</b> Eles descrevem padrões observados mantendo o score heurístico limitado.'},
    {t:'fix', en:'<b>Unavailable Protocol and LSB notes are now displayed safely as text.</b>', pt:'<b>Notas de indisponibilidade de Protocolo e LSB agora são exibidas com segurança como texto.</b>'},
  ]},
  { ver:'v2.42.29', date:'2026-08-16', title:{en:'Security and semantic cleanup',pt:'Limpeza de segurança e semântica'}, items:[
    {t:'fix', en:'<b>Suspicious strings recovered from file bytes are escaped before being rendered.</b> Crafted file content can no longer become markup in the Strings panel.', pt:'<b>Strings suspeitas recuperadas dos bytes do arquivo são escapadas antes da renderização.</b> Conteúdo preparado no arquivo não pode mais virar markup no painel Strings.'},
    {t:'fix', en:'<b>The lowest AI-origin state now uses very-low suspicion/compatibility wording instead of “Unlikely”.</b> Low-noise interpretation no longer implies a probable synthetic origin or an unmeasured causal steganography claim.', pt:'<b>O nível mais baixo de origem por IA agora usa linguagem de suspeita/compatibilidade muito baixa em vez de “Improvável”.</b> A interpretação de baixo ruído não implica mais origem sintética provável nem uma relação causal não medida com esteganografia.'},
    {t:'fix', en:'<b>Public report values no longer leak Portuguese prose in the known format/string/DCT paths.</b> DCT failure reasons use stable codes and are localized only when displayed.', pt:'<b>Valores do relatório público não vazam mais texto em português nos caminhos conhecidos de formato/strings/DCT.</b> Motivos de falha DCT usam códigos estáveis e são traduzidos somente na exibição.'},
    {t:'fix', en:'<b>GPS is shown once in the EXIF panel while the existing <code>fields.GPS = "present"</code> report field is retained for compatibility.</b> Carrier Preflight fallbacks are also consistently English before i18n applies.', pt:'<b>GPS aparece uma única vez no painel EXIF, enquanto o campo existente <code>fields.GPS = "present"</code> é preservado no relatório por compatibilidade.</b> Os fallbacks do Carrier Preflight também ficam consistentemente em inglês antes da aplicação do i18n.'},
  ]},
  { ver:'v2.42.28', date:'2026-08-15', title:{en:'Final semantic alignment of forensic wording',pt:'Alinhamento semântico final dos textos forenses'}, items:[
    {t:'fix', en:'<b>EXIF software metadata is no longer described as confirmation of AI generation.</b> It is now explicitly supporting evidence because metadata can be edited or copied.', pt:'<b>Metadados de software no EXIF não são mais descritos como confirmação de geração por IA.</b> Agora são explicitamente evidência de apoio, pois metadados podem ser editados ou copiados.'},
    {t:'fix', en:'<b>A quiet LSB Replacement result no longer implies a low probability of hidden content.</b> The Analyzer now states only what the test found and reminds that LSB Matching or content-adaptive embedding may still be present.', pt:'<b>Um resultado silencioso para LSB Replacement não implica mais baixa probabilidade de conteúdo oculto.</b> O Analyzer agora informa somente o que o teste encontrou e lembra que LSB Matching ou embedding adaptativo ao conteúdo ainda podem estar presentes.'},
    {t:'chg', en:'<b>Carrier Preflight now exposes its main blind spots at the decision point.</b> A quiet preflight warns that password-protected or content-adaptively placed payloads may still be missed.', pt:'<b>O Carrier Preflight agora expõe suas principais limitações no momento da decisão.</b> Um preflight silencioso avisa que payloads protegidos por senha ou inseridos de forma adaptativa ao conteúdo ainda podem não ser detectados.'},
    {t:'chg', en:'<b>Origin wording now says Highest compatibility instead of Likely origin, and exported GPS presence uses a language-neutral token.</b>', pt:'<b>A origem agora é apresentada como Maior compatibilidade em vez de Origem provável, e a presença de GPS no relatório exportado usa um token neutro de idioma.</b>'},
  ]},
  { ver:'v2.42.27', date:'2026-08-15', title:{en:'Public claims aligned with measured coverage',pt:'Afirmações públicas alinhadas à cobertura medida'}, items:[
    {t:'chg', en:'<b>Steganalysis limits now distinguish LSB Matching from content-adaptive methods such as HILL.</b> The help no longer says these methods are categorically undetectable; it says they may evade the built-in analysis, while known STEGO·STUDIO formats may still be recognised or decoded.', pt:'<b>Os limites de esteganálise agora distinguem LSB Matching de métodos adaptativos ao conteúdo como HILL.</b> A ajuda não diz mais que esses métodos são categoricamente indetectáveis; ela informa que podem escapar da análise embutida, enquanto formatos conhecidos do STEGO·STUDIO ainda podem ser reconhecidos ou decodificados.'},
    {t:'chg', en:'<b>AI-origin wording no longer presents C2PA or spectral analysis as definitive confirmation.</b> Content Credentials are described as provenance evidence that requires cryptographic validation, and heuristic image signals are explicitly non-conclusive.', pt:'<b>Os textos sobre origem por IA não apresentam mais C2PA ou análise espectral como confirmação definitiva.</b> Content Credentials são descritas como evidência de procedência que exige validação criptográfica, e os sinais heurísticos da imagem ficam explicitamente não conclusivos.'},
    {t:'chg', en:'<b>Origin Probability is now Origin Compatibility.</b> The 0–100 values are identified as heuristic compatibility scores rather than calibrated probabilities, and a zero Threat state is labelled “No signals” instead of “Clean”.', pt:'<b>Probabilidade de Origem agora é Compatibilidade com Origem.</b> Os valores de 0–100 são identificados como scores heurísticos de compatibilidade, não probabilidades calibradas, e um Threat zerado passa a ser “Sem sinais” em vez de “Limpo”.'},
  ]},
  { ver:'v2.42.26', date:'2026-08-15', title:{en:'Accordion localization and Carrier Preflight hover polished',pt:'Localização dos accordions e hover do Carrier Preflight refinados'}, items:[
    {t:'fix', en:'<b>Extraction modes in the Protocol accordion are now localized instead of exposing the internal Portuguese channel name in English.</b> Human-readable row values also use consistent sentence case.', pt:'<b>Os modos de extração do accordion Protocolo agora são traduzidos em vez de expor o nome interno do canal em português na interface em inglês.</b> Valores textuais das linhas também usam capitalização consistente.'},
    {t:'fix', en:'<b>Both Carrier Preflight action buttons now provide a visible hover response.</b>', pt:'<b>Os dois botões de ação do Carrier Preflight agora respondem visualmente ao passar o mouse.</b>'},
  ]},
  { ver:'v2.42.25', date:'2026-08-15', title:{en:'Protocol wording and password terminology made explicit',pt:'Texto do Protocolo e terminologia de senha padronizados'}, items:[
    {t:'fix', en:'<b>Protocol no longer claims that a recovered native payload used a supplied password when the message was actually plaintext.</b> Recovery wording is now neutral; Decode Status states separately whether the content was plaintext or decrypted.', pt:'<b>O Protocolo não afirma mais que um payload nativo recuperado usou uma senha informada quando a mensagem estava em texto puro.</b> O texto de recuperação agora é neutro; o Status da decodificação informa separadamente se o conteúdo era texto puro ou foi descriptografado.'},
    {t:'chg', en:'<b>User-facing credential terminology now consistently says password.</b> Encryption describes the hidden message/payload, while cryptographic key is reserved for the derived key itself or cipher-specific technical context.', pt:'<b>A terminologia visível de credencial agora usa senha de forma consistente.</b> Criptografia descreve a mensagem/payload oculto, enquanto chave criptográfica fica reservada à chave derivada ou a contexto técnico de cifra.'},
    {t:'chg', en:'<b>Carrier Preflight actions are shorter and stay side by side.</b>', pt:'<b>As ações do Carrier Preflight ficaram mais curtas e permanecem lado a lado.</b>'},
  ]},
  { ver:'v2.42.24', date:'2026-08-15', title:{en:'Embedding evidence no longer becomes a fake recovered message',pt:'Evidência de embedding não vira mais uma mensagem recuperada falsa'}, items:[
    {t:'fix', en:'<b>Strong LSB statistics no longer promote an arbitrary readable-looking byte island to a recovered message.</b> RS/WS/chi-square can support the conclusion that embedding occurred, but they do not prove that a particular string is the payload. Headerless low-confidence candidates are now kept separate from recovered content.', pt:'<b>Estatísticas fortes de LSB não promovem mais uma ilha arbitrária de bytes aparentemente legíveis a mensagem recuperada.</b> RS/WS/qui-quadrado podem sustentar a conclusão de que houve embedding, mas não provam que uma string específica é o payload. Candidatos sem header e de baixa confiança agora ficam separados de conteúdo recuperado.'},
    {t:'chg', en:'<b>When structural evidence is strong but no reliable message or known protocol is recovered, Protocol now reports LSB embedding evidence instead of a generic recovered-text protocol.</b> The candidate may still be visible as forensic evidence, but it is explicitly marked as unvalidated.', pt:'<b>Quando a evidência estrutural é forte, mas nenhuma mensagem confiável ou protocolo conhecido é recuperado, o Protocolo agora informa evidência de embedding LSB em vez de um protocolo genérico com texto recuperado.</b> O candidato ainda pode aparecer como evidência forense, mas fica explicitamente marcado como não validado.'},
  ]},
  { ver:'v2.42.23', date:'2026-08-15', title:{en:'Carrier Preflight warns before reusing a suspicious cover',pt:'Carrier Preflight avisa antes de reutilizar uma portadora suspeita'}, items:[
    {t:'add', en:'<b>The Encoder now performs a lightweight Carrier Preflight when a lossless cover is loaded.</b> If it finds an obvious existing STEGO·STUDIO header or coherent readable text in common pixel-LSB layouts, Encode is blocked until you choose another image or explicitly continue with the current carrier.', pt:'<b>O Encoder agora faz uma pré-verificação leve da portadora quando uma imagem sem perda é carregada.</b> Se encontrar um header STEGO·STUDIO evidente ou texto coerente legível em layouts comuns de LSB nos pixels, o Encode fica bloqueado até você escolher outra imagem ou confirmar que deseja continuar com a portadora atual.'},
    {t:'chg', en:'<b>A negative preflight result is presented only as “no obvious prior hidden content detected”, never as proof that the carrier is clean.</b> Password-concealed or unsupported hidden data can still exist.', pt:'<b>Um resultado negativo da pré-verificação é apresentado apenas como “nenhum conteúdo oculto anterior óbvio foi detectado”, nunca como prova de que a portadora está limpa.</b> Dados ocultos protegidos por senha ou fora dos padrões verificados ainda podem existir.'},
  ]},
  { ver:'v2.42.22', date:'2026-08-15', title:{en:'About This Project',pt:'Sobre este projeto'}, items:[
    {t:'add', en:'<b>Added About This Project to the in-app menu.</b> It explains the project scope and makes clear that STEGO·STUDIO is experimental rather than a certified forensic or security product.', pt:'<b>Adicionada a seção Sobre este projeto ao menu do aplicativo.</b> Ela explica o escopo do projeto e deixa claro que o STEGO·STUDIO é experimental, não um produto forense ou de segurança certificado.'},
  ]},
  { ver:'v2.42.20', date:'2026-08-15', title:{en:'Alternate-message validation feedback refined',pt:'Feedback de validação da mensagem alternativa refinado'}, items:[
    {t:'fix', en:'<b>The missing alternate-message warning now appears directly below the alternate password field that triggered it.</b> It disappears immediately when a non-blank alternate message begins.', pt:'<b>O aviso de mensagem alternativa ausente agora aparece diretamente abaixo do campo de senha alternativa que o disparou.</b> Ele desaparece imediatamente quando começa uma mensagem alternativa não vazia.'},
  ]},
  { ver:'v2.42.19', date:'2026-08-15', title:{en:'Safer alternate-layer setup',pt:'Configuração mais segura da camada alternativa'}, items:[
    {t:'fix', en:'<b>Enabling the alternate message can no longer silently produce a one-layer image.</b> Encode stays disabled until the alternate layer has a non-blank message and its own password, or the layer is turned off.', pt:'<b>Ativar a mensagem alternativa não pode mais gerar silenciosamente uma imagem com uma camada só.</b> O Encode permanece desabilitado até que a camada alternativa tenha uma mensagem não vazia e sua própria senha, ou seja desativada.'},
  ]},
  { ver:'v2.42.18', date:'2026-08-15', title:{en:'Enter shortcuts for Encode and Analyze',pt:'Atalhos de Enter para Encode e Analyze'}, items:[
    {t:'add', en:'<b>Pressing Enter in the Encoder password fields starts Encode when the real button is available.</b> Message textareas keep normal multiline behaviour.', pt:'<b>Pressionar Enter nos campos de senha do Encoder inicia o Encode quando o botão real está disponível.</b> As áreas de mensagem mantêm o comportamento normal de múltiplas linhas.'},
    {t:'add', en:'<b>Pressing Enter in the Analyzer/Decoder password field starts Analyze when available.</b> The shortcut respects disabled/busy state, key repeat and IME composition.', pt:'<b>Pressionar Enter no campo de senha do Analyzer/Decoder inicia o Analyze quando disponível.</b> O atalho respeita estado desabilitado/ocupado, repetição de tecla e composição por IME.'},
  ]},
  { ver:'v2.42.17', date:'2026-08-14', title:{en:'Exported reports now have an explicit public schema',pt:'Relatórios exportados agora têm um esquema público explícito'}, items:[
    {t:'chg', en:'<b>Export JSON now passes through an explicit allowlist before it leaves the Analyzer.</b> Internal working fields are no longer inherited automatically by the public report, making the exported schema more stable and preventing accidental internal state from appearing in future reports.', pt:'<b>O Exportar JSON agora passa por uma lista explícita de campos permitidos antes de sair do Analyzer.</b> Campos internos de trabalho não são mais herdados automaticamente pelo relatório público, tornando o esquema exportado mais estável e evitando que estado interno apareça acidentalmente em relatórios futuros.'},
  ]},
  { ver:'v2.42.16', date:'2026-08-14', title:{en:'2.42 closure: evidence strength no longer drops when evidence grows',pt:'Fechamento 2.42: a força da evidência não cai quando a evidência aumenta'}, items:[
    {t:'fix', en:'<b>Adding an active header match can no longer make Threat weaker than the same image with only its passive header.</b> The visible label still follows the most specific protocol state, while strong-evidence gating now follows the raw evidence strength independently.', pt:'<b>Adicionar uma correspondência ativa de header não pode mais deixar o Threat mais fraco do que a mesma imagem com apenas o header passivo.</b> O rótulo visível continua seguindo o estado de protocolo mais específico, enquanto o portão de evidência forte agora segue a força bruta de forma independente.'},
  ]},
  { ver:'v2.42.15', date:'2026-08-14', title:{en:'Final 2.42 hardening: one evidence state, honest robust JPEG errors',pt:'Fechamento do hardening 2.42: uma evidência única e erros honestos no JPEG robusto'}, items:[
    {t:'fix', en:'<b>Threat, Protocol, the explanatory note and the offline-limit note now resolve the same native evidence state.</b> Mixed passive/active header cases can no longer describe the same finding with different labels.', pt:'<b>Threat, Protocolo, a nota explicativa e a nota de limitação offline agora resolvem o mesmo estado de evidência nativa.</b> Casos mistos de header passivo/ativo não podem mais descrever o mesmo achado com rótulos diferentes.'},
    {t:'fix', en:'<b>Confirmed sturdier-mode JPEG evidence is no longer erased when the inner encrypted or compressed content cannot be opened.</b> The report keeps a confirmed locked/content-error state instead of falling through to “nothing found”.', pt:'<b>Evidência confirmada do modo JPEG resistente não é mais apagada quando o conteúdo interno cifrado ou comprimido não pode ser aberto.</b> O relatório mantém um estado confirmado de conteúdo bloqueado/ilegível em vez de cair em “nada encontrado”.'},
    {t:'fix', en:'<b>Password feedback now resets deterministically and no longer depends on colour alone.</b> Repeated flashes share one timer, Clear removes the state, and the key icon plus the visible hint text change together with the orange outline.', pt:'<b>O aviso de senha agora é limpo de forma determinística e não depende somente de cor.</b> Flashes repetidos compartilham um único timer, Limpar remove o estado, e o ícone da chave mais o texto visível mudam junto com o contorno laranja.'},
  ]},
  { ver:'v2.42.14', date:'2026-08-14', title:{en:'Wrong-key highlight now frames the whole password field',pt:'Destaque de chave incorreta agora contorna o campo inteiro'}, items:[
    {t:'fix', en:'<b>The wrong-key flash now highlights the password control as one complete field.</b> The effect used to be applied to the inner input, whose parent clips overflow; that left only two vertical orange lines visible. The flash now targets the outer key-field wrapper, producing the intended full rectangular outline without changing decoder logic.', pt:'<b>O destaque de chave incorreta agora envolve o controle de senha como um campo único.</b> O efeito era aplicado ao input interno, cujo contêiner recorta o overflow; por isso apareciam apenas duas linhas verticais laranja. O flash agora é aplicado ao contêiner externo do campo, produzindo o contorno retangular completo sem alterar a lógica do Decoder.'},
  ]},
  { ver:'v2.42.13', date:'2026-08-14', title:{en:'One evidence order across the Analyzer',pt:'Uma ordem de evidência em todo o Analyzer'}, items:[
    {t:'fix', en:'<b>Wrong-key feedback is now provisional everywhere a valid extraction may still happen later.</b> Three header-path failures still flashed the key field before the alternate layer and third-party engines had finished. With a supplied key they now wait for the same final gate as the generic decoder; missing-key prompts remain immediate.', pt:'<b>O aviso de chave incorreta agora é provisório em todo caminho no qual uma extração válida ainda pode acontecer depois.</b> Três falhas na rota do header ainda faziam o campo de chave piscar antes de a camada alternativa e os motores de terceiros terminarem. Com chave informada, agora aguardam o mesmo portão final do decodificador genérico; avisos de chave ausente continuam imediatos.'},
    {t:'fix', en:'<b>Threat and Protocol now describe the strongest native evidence with the same precedence.</b> When a passive header and an authenticated extraction coexisted, Protocol said “extracted” while Threat mentioned only the header. The score was unchanged, but the wording diverged. Authenticated extraction now wins in both.', pt:'<b>Threat e Protocolo agora descrevem a evidência nativa mais forte com a mesma precedência.</b> Quando um header passivo e uma extração autenticada coexistiam, Protocolo dizia “extraído” enquanto Threat mencionava apenas o header. O score era o mesmo, mas o texto divergia. Extração autenticada agora vence nos dois.'},
    {t:'fix', en:'<b>An authenticated extraction no longer hides the payload size when a public header also exposed it.</b> The route-neutral recovery text stays intact, with the already-public byte count appended when available.', pt:'<b>Uma extração autenticada não esconde mais o tamanho do payload quando um header público também o revelou.</b> O texto neutro de recuperação continua intacto, com a contagem de bytes já pública acrescentada quando disponível.'},
    {t:'fix', en:'<b>One live English quick-guide sentence still referred to the removed Pro server.</b> It now matches the Portuguese text and the current offline product: adaptive methods are not reliably detected by this build.', pt:'<b>Uma frase viva do guia rápido em inglês ainda citava o servidor Pro removido.</b> Agora ela corresponde ao português e ao produto offline atual: métodos adaptativos não são detectados com confiabilidade por esta build.'},
  ]},
  { ver:'v2.42.12', date:'2026-08-14', title:{en:'Closing two remaining layer distinguishers',pt:'Fechando dois distinguidores restantes entre as camadas'}, items:[
    {t:'fix', en:'<b>A valid alternate password no longer makes the key field flash as if the password were wrong.</b> The generic decoder used to give that warning before the alternate layer had its turn. The warning is now provisional and only appears after every applicable extraction route has failed.', pt:'<b>Uma senha alternativa válida não faz mais o campo de chave piscar como se a senha estivesse errada.</b> O decodificador genérico dava esse aviso antes de a camada alternativa ter sua chance. Agora o aviso é provisório e só aparece depois que todas as rotas de extração aplicáveis falham.'},
    {t:'fix', en:'<b>A message recovered by another tool can no longer inherit STEGO·STUDIO extraction status from a native header that matched earlier but failed to decode.</b> Header match and payload recovery are now kept as local operation facts until the final evidence state is resolved.', pt:'<b>Uma mensagem recuperada por outra ferramenta não pode mais herdar o estado de extração STEGO·STUDIO de um header nativo que havia casado antes, mas falhou ao decodificar.</b> Correspondência de header e recuperação de payload agora ficam como fatos locais da operação até a evidência final ser resolvida.'},
  ]},
  { ver:'v2.42.11', date:'2026-08-14', title:{en:'Two valid passwords no longer reveal which layer they opened',pt:'Duas senhas válidas não revelam mais qual camada abriram'}, items:[
    {t:'fix', en:'<b>The two-message mode could betray which password had opened which layer.</b> Both passwords still recovered their messages correctly, but only the main route was promoted to a confirmed STEGO·STUDIO extraction in the Analyzer. The alternate route is deliberately headerless and validates through AES-GCM, so its message appeared while Threat and Protocol stayed at the same level as a wrong password. A successful native recovery now becomes one public state regardless of the internal route, and the report does not publish a decoy/tail-layer marker.', pt:'<b>O modo de duas mensagens podia denunciar qual senha havia aberto qual camada.</b> As duas senhas continuavam recuperando suas mensagens corretamente, mas só a rota principal era promovida a extração confirmada do STEGO·STUDIO no Analyzer. A rota alternativa não tem header de propósito e valida pelo AES-GCM, então a mensagem aparecia enquanto Threat e Protocolo ficavam no mesmo nível de uma senha errada. Uma recuperação nativa bem-sucedida agora vira um único estado público independentemente da rota interna, e o relatório não publica marcador de decoy/camada de cauda.'},
    {t:'fix', en:'<b>A recovered alternate message no longer makes the protocol panel claim that a header was found.</b> That sentence was true for the main route and false for the alternate one. The panel now says only what both successful routes prove: a STEGO·STUDIO payload was recovered with the supplied password.', pt:'<b>Uma mensagem alternativa recuperada não faz mais o painel de protocolo afirmar que um header foi encontrado.</b> Essa frase era verdadeira para a rota principal e falsa para a alternativa. O painel agora diz apenas o que as duas rotas bem-sucedidas provam: um payload STEGO·STUDIO foi recuperado com a senha informada.'},
  ]},
  { ver:'v2.42.10', date:'2026-08-13', title:{en:'The interface locks during analysis on purpose now',pt:'A interface trava durante a análise de propósito agora'}, items:[
    {t:'chg', en:'<b>While an analysis runs, everything that could change it is now deliberately locked.</b> It already behaved that way, but only by accident: the work occupies the browser so thoroughly that clicks and pasted images were simply never noticed. That is not a promise — it would quietly disappear the day the analysis becomes smoother or moves to a background thread, and interaction would return without anyone choosing it. Loading an image, editing the password, clearing, and switching language now wait for the analysis to finish, and say so rather than appearing to ignore you.', pt:'<b>Enquanto uma análise roda, tudo que poderia alterá-la fica deliberadamente travado.</b> Já se comportava assim, mas por acidente: o trabalho ocupa o navegador de tal forma que cliques e imagens coladas simplesmente não eram percebidos. Isso não é uma promessa — sumiria no dia em que a análise ficasse mais fluida ou fosse para uma thread de fundo, e a interação voltaria sem ninguém ter escolhido. Carregar imagem, editar a senha, limpar e trocar de idioma agora aguardam a análise terminar, e dizem isso em vez de parecer que estão ignorando você.'},
    {t:'fix', en:'<b>Pasting an image with Ctrl+V followed a separate path that did not invalidate a running analysis.</b> Dragging a file in and pasting one were two copies of the same loading routine, and only the first had been taught to discard results in flight. There is now a single entry point that both use. Two smaller repairs travel with it: finishing an analysis no longer re-enables the Analyse button without checking whether an image is actually loaded, and re-analysing the same image now supersedes the previous report instead of sharing its identity.', pt:'<b>Colar uma imagem com Ctrl+V seguia um caminho separado que não invalidava a análise em andamento.</b> Arrastar um arquivo e colar um eram duas cópias da mesma rotina de carregamento, e só a primeira havia sido ensinada a descartar resultados em voo. Agora existe um ponto de entrada único que os dois usam. Dois reparos menores vêm junto: terminar uma análise não reabilita mais o botão Analisar sem conferir se há imagem carregada, e reanalisar a mesma imagem agora substitui o relatório anterior em vez de compartilhar a identidade dele.'},
  ]},
  { ver:'v2.42.9', date:'2026-08-13', title:{en:'Loading a new image mid-analysis showed the old one\u2019s results',pt:'Carregar imagem nova no meio da análise mostrava o resultado da antiga'}, items:[
    {t:'fix', en:'<b>If you loaded a second image while the first was still being analysed, the preview changed but the results that appeared belonged to the previous image.</b> An analysis takes several seconds and reads the current image repeatedly along the way, so swapping the image underneath it left the two halves describing different files. Each analysis now works from a copy taken when it started, and checks before showing anything whether it is still the current one — if not, it finishes quietly and shows nothing. Changing the language mid-analysis could bring the old results back the same way, and no longer does.', pt:'<b>Se você carregasse uma segunda imagem enquanto a primeira ainda era analisada, o preview mudava mas os resultados que apareciam eram da imagem anterior.</b> Uma análise leva alguns segundos e consulta a imagem atual várias vezes no caminho, então trocar a imagem por baixo dela deixava as duas metades descrevendo arquivos diferentes. Cada análise agora trabalha a partir de uma cópia tirada quando começou, e confere antes de exibir qualquer coisa se ainda é a corrente — se não for, termina em silêncio e não mostra nada. Trocar o idioma no meio da análise trazia os resultados antigos de volta pelo mesmo caminho, e não traz mais.'},
    {t:'fix', en:'<b>A file that could not be read was being reported as a file with no camera metadata.</b> Those are different things, and the second one feeds the origin classifier — so a read failure was quietly becoming evidence about the image. The report now distinguishes not read from read and empty.', pt:'<b>Um arquivo que não pôde ser lido era reportado como um arquivo sem metadados de câmera.</b> São coisas diferentes, e a segunda alimenta o classificador de origem — então uma falha de leitura virava, em silêncio, evidência sobre a imagem. O relatório agora distingue não lido de lido e vazio.'},
  ]},
  { ver:'v2.42.8', date:'2026-08-13', title:{en:'A frozen progress bar and a note that argued with itself',pt:'Uma barra travada e uma nota que discordava de si mesma'}, items:[
    {t:'fix', en:'<b>Analysing a second time could leave the progress bar stuck forever with nothing in the console.</b> Reading the file was wrapped in a promise that waited only for success — if the read failed, no error was raised, nothing was logged, and the wait simply never ended. That is why the failure looked like a freeze rather than a fault. File reading now reports failure, cancellation and silence alike, gives up after a minute rather than waiting indefinitely, and a second analysis cannot start while one is still running.', pt:'<b>Analisar uma segunda vez podia deixar a barra de progresso travada para sempre, sem nada no console.</b> A leitura do arquivo estava embrulhada numa promessa que esperava apenas pelo sucesso — se a leitura falhasse, nenhum erro era levantado, nada era registrado, e a espera simplesmente não terminava. É por isso que a falha parecia um congelamento e não um defeito. A leitura de arquivo agora reporta falha, cancelamento e silêncio igualmente, desiste após um minuto em vez de esperar indefinidamente, e uma segunda análise não começa enquanto uma ainda está rodando.'},
    {t:'fix', en:'<b>The protocol panel showed the recovered message and, just below it, said no readable text had been recovered.</b> Three separate places describe the same finding — the threat tags, the panel heading, and its explanatory note — and each learned about confirmed extraction at a different time, so the last one was still describing the old state. All three now read the same state, so they no longer contradict each other.', pt:'<b>O painel de protocolo mostrava a mensagem recuperada e, logo abaixo, dizia que nenhum texto legível havia sido recuperado.</b> Três lugares distintos descrevem o mesmo achado — as tags de ameaça, o título do painel e a nota explicativa — e cada um aprendeu sobre extração confirmada em momento diferente, então o último ainda descrevia o estado antigo. Os três agora leem o mesmo estado, para que não se contradigam.'},
  ]},
  { ver:'v2.42.7', date:'2026-08-12', title:{en:'Two panels disagreeing about the same message',pt:'Dois painéis discordando sobre a mesma mensagem'}, items:[
    {t:'fix', en:'<b>With the right password, one panel said a payload had been extracted while the panel below called the protocol undetermined.</b> Both were describing the same file at the same moment. The Protocol panel only ever consulted the passive scan, which runs without your password and cannot see a payload whose header is hidden — so once the password revealed one, that panel had no idea and fell back to guessing. It now reads the same evidence the threat score does, ordered by strength, and distinguishes a header confirmed with your password from one merely spotted without it.', pt:'<b>Com a senha certa, um painel dizia que um payload havia sido extraído enquanto o painel logo abaixo chamava o protocolo de indeterminado.</b> Os dois descreviam o mesmo arquivo no mesmo instante. O painel Protocolo consultava apenas a varredura passiva, que roda sem a sua senha e não enxerga payload de cabeçalho escondido — então, quando a senha revelava um, aquele painel não sabia de nada e voltava a adivinhar. Agora ele lê a mesma evidência que o score de ameaça lê, ordenada por força, e distingue um cabeçalho confirmado com a sua senha de um apenas avistado sem ela.'},
  ]},
  { ver:'v2.42.6', date:'2026-08-12', title:{en:'Finding the header is not the same as reading the message',pt:'Achar o cabeçalho não é o mesmo que ler a mensagem'}, items:[
    {t:'fix', en:'<b>The report could announce an extracted payload when nothing had been read.</b> The previous version started counting an extraction the moment the hidden header was located, but six different outcomes still end with no message: a corrupted body failing its authentication check, an encrypted payload with no password given, decompression failing. In all of them you would have been told a payload was extracted while the screen showed nothing. There are now two distinct findings — a header was found, and a message was recovered — with the second recorded only after a message actually survives. The sturdier JPEG mode always drew this line; the ordinary path now does too.', pt:'<b>O relatório podia anunciar payload extraído quando nada havia sido lido.</b> A versão anterior passava a contar extração no instante em que o cabeçalho oculto era localizado, mas seis desfechos diferentes ainda terminam sem mensagem: um corpo corrompido reprovando na verificação de autenticidade, um payload cifrado sem senha informada, a descompressão falhando. Em todos eles você seria informado de que um payload foi extraído enquanto a tela não mostrava nada. Agora são dois achados distintos — um cabeçalho foi encontrado, e uma mensagem foi recuperada — e o segundo só é registrado depois que uma mensagem de fato sobrevive. O modo resistente do JPEG sempre traçou essa linha; o caminho comum agora também.'},
  ]},
  { ver:'v2.42.5', date:'2026-08-12', title:{en:'Two things the analysis was getting wrong',pt:'Duas coisas que a análise estava errando'}, items:[
    {t:'fix', en:'<b>Recovering a hidden message no longer leaves the threat score unchanged.</b> In lossless images the passive scan looks for a message without your password, so a payload whose header is masked stays invisible to it — and the score came out identical whether the password was right or wrong, even with the full message on screen. Actually reading a message is the strongest evidence there is, stronger than any statistic, and it now counts as such. The sturdier JPEG mode already did this; the ordinary path had been left out.', pt:'<b>Recuperar uma mensagem oculta não deixa mais o score de ameaça igual ao que era.</b> Em imagens sem perda a varredura passiva procura mensagem sem a sua senha, então um payload de cabeçalho mascarado permanece invisível para ela — e o score saía idêntico com senha certa ou errada, mesmo com a mensagem inteira na tela. Ler uma mensagem de fato é a evidência mais forte que existe, mais forte que qualquer estatística, e agora pesa como tal. O modo resistente do JPEG já fazia isso; o caminho comum tinha ficado de fora.'},
    {t:'fix', en:'<b>An image with no hidden message could reach the maximum threat score.</b> The tool knows that AI-generated files carry provenance data which produces statistical noise resembling steganography, and it has a rule to discount those signals. But the switch that turned the rule off was itself wired to two of those very signals, so on exactly the files the rule was written for, it never ran. A clean certified image scored 100 and announced a possible encrypted message. The switch now responds only to structural evidence — a header, an extracted payload, data past the end of the file — so a genuine hidden message still overrides the discount, while noise alone no longer does.', pt:'<b>Uma imagem sem mensagem oculta podia atingir o score máximo de ameaça.</b> A ferramenta sabe que arquivos gerados por IA carregam dados de proveniência que produzem ruído estatístico parecido com esteganografia, e tem uma regra para descontar esses sinais. Mas o interruptor que desligava a regra estava ligado a dois desses mesmos sinais, então justamente nos arquivos para os quais a regra foi escrita ela nunca rodava. Uma imagem certificada e limpa marcava 100 e anunciava possível mensagem cifrada. O interruptor agora responde só a evidência estrutural — um cabeçalho, um payload extraído, dados após o fim do arquivo — de modo que uma mensagem oculta real continua vencendo o desconto, e ruído sozinho não.'},
    {t:'fix', en:'<b>Two smaller repairs.</b> The exported report printed a placeholder instead of the image proportion it had already calculated. And the invisible element that catches a pasted image was marked as hidden from screen readers while still receiving keyboard focus, which leaves someone using one with no idea where they are.', pt:'<b>Dois reparos menores.</b> O relatório exportado imprimia um marcador de lugar em vez da proporção da imagem que ele já havia calculado. E o elemento invisível que captura uma imagem colada estava marcado como oculto para leitores de tela enquanto ainda recebia o foco do teclado, o que deixa quem usa um deles sem saber onde está.'},
  ]},
  { ver:'v2.42.4', date:'2026-08-11', title:{en:'The help was promising something the tool cannot do',pt:'A ajuda prometia algo que a ferramenta não faz'}, items:[
    {t:'fix', en:'<b>Steghide BMP files are not supported.</b> The previous help incorrectly implied they were, which could make a Steghide BMP appear clean when it was simply unreadable by this tool. The help now says JPEG only and clarifies that, among Steghide\'s many cipher choices, only the default is decrypted here; the others can be identified but not read.', pt:'<b>Arquivos Steghide em BMP não são suportados.</b> A ajuda anterior dava a entender incorretamente que eram, o que poderia fazer um BMP do Steghide parecer limpo quando na verdade a ferramenta apenas não conseguia lê-lo. A ajuda agora diz somente JPEG e esclarece que, entre as várias opções de cifra do Steghide, apenas a padrão é decifrada aqui; as demais podem ser identificadas, mas não lidas.'},
    {t:'chg', en:'<b>Status messages are now rendered as plain text.</b> Error text can include information derived from the file being examined, so the status line no longer treats that content as markup.', pt:'<b>As mensagens de status agora são renderizadas como texto simples.</b> O texto de erro pode incluir informações derivadas do arquivo analisado, então a linha de status não trata mais esse conteúdo como marcação.'},
  ]},
  { ver:'v2.42.3', date:'2026-08-11', title:{en:'Fewer doors, and an honest page about what this tool can read',pt:'Menos portas, e uma página honesta sobre o que a ferramenta consegue ler'}, items:[
    {t:'add', en:'<b>A page now states exactly what this tool can and cannot read from other steganography tools.</b> Saying "supports Steghide" would be misleading: Steghide can encrypt with eighteen algorithms across seven modes, and this decoder implements two of those combinations \u2014 which means even its default cipher fails in six of its seven modes. That is measured against the real program, not estimated. The page also records that OpenStego payloads written with its own encryption are identified but not decrypted, and that F5 is only ever guessed at, never extracted.', pt:'<b>Uma página agora diz exatamente o que esta ferramenta consegue e não consegue ler de outras ferramentas de esteganografia.</b> Dizer "suporta Steghide" seria enganoso: o Steghide cifra com dezoito algoritmos em sete modos, e este decodificador implementa duas dessas combinações \u2014 o que significa que mesmo a cifra padrão dele falha em seis dos sete modos. Isso foi medido contra o programa real, não estimado. A página também registra que payloads do OpenStego escritos com a criptografia dele são identificados mas não decifrados, e que o F5 é apenas suposto, nunca extraído.'},
  ]},
  { ver:'v2.42.1', date:'2026-08-11', title:{en:'Finishing what the last version started',pt:'Terminando o que a versão anterior começou'}, items:[
    {t:'fix', en:'<b>Four more file-derived fields are now rendered strictly as text.</b> The certificate signer, C2PA generator name/version, software quoted in AI notes and manifest signal list can no longer be interpreted as page markup.', pt:'<b>Mais quatro campos vindos do arquivo agora são renderizados estritamente como texto.</b> O signatário do certificado, nome/versão do gerador C2PA, software citado nas notas de IA e lista de sinais do manifesto não podem mais ser interpretados como marcação da página.'},
    {t:'chg', en:'<b>Two more places were still calling an unverified C2PA declaration "certified".</b> The last version corrected this wording in four texts and missed two, so the AI panel kept announcing certified synthetic origin while the panel beside it explained that no signature had been checked. Both now say the same thing.', pt:'<b>Mais dois lugares ainda chamavam de "certificada" uma declaração C2PA não verificada.</b> A versão anterior corrigiu esse texto em quatro pontos e deixou dois, então o painel de IA seguia anunciando origem sintética certificada enquanto o painel ao lado explicava que nenhuma assinatura fora conferida. Agora os dois dizem a mesma coisa.'},
    {t:'chg', en:'<b>The Pro mode was removed two versions ago, but the help text kept recommending it.</b> Several passages still told you to retry once the neural server was online, next to a promise that nothing is ever sent to a server. The help now describes the tool that exists. The claim that camera firmware cannot be forged is gone too \u2014 it was never true, and the code had already stopped relying on it.', pt:'<b>O modo Pro foi removido duas versões atrás, mas o texto de ajuda seguia recomendando-o.</b> Várias passagens ainda mandavam tentar de novo quando o servidor neural estivesse online, ao lado da promessa de que nada é enviado a servidor nenhum. A ajuda agora descreve a ferramenta que existe. A afirmação de que firmware de câmera não é forjável também saiu \u2014 nunca foi verdade, e o código já havia deixado de contar com ela.'},
    {t:'fix', en:'<b>A deliberately absurd PNG could take the tab down before showing an error.</b> Width and height are read from the file and were trusted straight into memory allocation, so a header claiming enormous dimensions, or a small file that decompresses into gigabytes, would exhaust memory first and explain later. Both are now bounded and fail with a readable message.', pt:'<b>Um PNG deliberadamente absurdo podia derrubar a aba antes de exibir qualquer erro.</b> Largura e altura são lidas do arquivo e iam direto para a alocação de memória, então um cabeçalho declarando dimensões enormes, ou um arquivo pequeno que descomprime em gigabytes, esgotava a memória primeiro e explicava depois. Os dois agora têm teto e falham com mensagem legível.'},
    {t:'fix', en:'<b>The offline guarantee allowed more than it claimed.</b> The rule\u2019s comment said only exact metadata addresses were permitted, but the pattern accepted any path on this site\u2019s own domain. It now matches a closed list of exact addresses. The direction of the choice matters: the tool\u2019s strongest promise should be checked by its strictest rule.', pt:'<b>A garantia offline permitia mais do que dizia permitir.</b> O comentário da regra afirmava que só endereços exatos de metadado passavam, mas o padrão aceitava qualquer caminho no domínio do próprio site. Agora ela casa uma lista fechada de endereços exatos. A direção da escolha importa: a promessa mais forte da ferramenta deve ser conferida pela sua regra mais estrita.'},
    {t:'chg', en:'<b>The random choice in LSB Matching now comes from the cryptographic generator.</b> Each altered pixel moves up or down by one, and that direction was drawn from the browser\u2019s ordinary random source \u2014 fast, but predictable, and the pattern of those directions is exactly what an analyst looks at.', pt:'<b>A escolha aleatória no LSB Matching agora vem do gerador criptográfico.</b> Cada pixel alterado sobe ou desce em um, e essa direção era sorteada pela fonte aleatória comum do navegador \u2014 rápida, mas previsível, e o padrão dessas direções é justamente o que um analista observa.'},
  ]},
  { ver:'v2.42.0', date:'2026-08-11', title:{en:'Treating the file as hostile, which is what it is',pt:'Tratando o arquivo como hostil, que é o que ele é'}, items:[
    {t:'fix', en:'<b>Text hidden inside an image could run as code on this page.</b> Camera and software fields are read straight out of the file and shown to you \u2014 but they were being handed to the page as markup instead of as text, so a field crafted to say <code>&lt;img src=x onerror=...&gt;</code> executed instead of being displayed. The whole point of this tool is opening images you do not trust, which made the flaw worse than it would be almost anywhere else. Everything drawn from a file is now escaped before it reaches page markup.', pt:'<b>Texto escondido dentro de uma imagem podia rodar como código nesta página.</b> Campos de câmera e software são lidos direto do arquivo e exibidos a você \u2014 mas eram entregues à página como marcação em vez de como texto, então um campo forjado para dizer <code>&lt;img src=x onerror=...&gt;</code> executava em vez de aparecer. O propósito inteiro desta ferramenta é abrir imagens em que você não confia, o que tornava a falha pior do que seria em quase qualquer outro lugar. Tudo que vem de arquivo agora é escapado antes de chegar à marcação da página.'},
    {t:'chg', en:'<b>The tool was calling something "confirmed" that it had never actually verified.</b> C2PA is a standard where an image\u2019s origin is signed cryptographically, and the Analyzer announced it as proof of AI origin. In truth it was only spotting the words \u2014 seventy characters of plain text in a comment were enough to produce a confirmed verdict with a named generator, no cryptography involved. It now requires the manifest to sit in the container the standard demands, and says plainly what it did: found the declaration, did not check the signature. Verifying signatures for real is a separate piece of work.', pt:'<b>A ferramenta chamava de "confirmado" algo que nunca havia verificado.</b> C2PA é um padrão em que a origem de uma imagem é assinada criptograficamente, e o Analyzer anunciava isso como prova de origem em IA. Na verdade ele só reconhecia as palavras \u2014 setenta caracteres de texto simples num comentário bastavam para produzir um veredito confirmado com gerador identificado, sem criptografia nenhuma. Agora exige que o manifesto esteja no contêiner que a norma determina, e diz com clareza o que fez: encontrou a declaração, não conferiu a assinatura. Verificar assinaturas de verdade é um trabalho à parte.'},
    {t:'chg', en:'<b>Camera metadata no longer settles the question of whether an image was generated.</b> The tool used to treat the presence of a camera brand as decisive, and told you that camera firmware cannot be forged \u2014 which is not true. Those fields are ordinary text that any program can write, and this tool now says so. They still count, because a real photo usually carries them, but they lower the score instead of capping it, and a very strong pixel signal is no longer erased by a line of text. Recognising a camera also now requires brand, model and the camera\u2019s own metadata block together, rather than any one of them.', pt:'<b>Metadados de câmera não encerram mais a questão de a imagem ter sido gerada.</b> A ferramenta tratava a presença de uma marca de câmera como decisiva, e dizia a você que firmware de câmera não é forjável \u2014 o que não é verdade. Esses campos são texto comum que qualquer programa escreve, e a ferramenta agora diz isso. Continuam contando, porque uma foto real costuma trazê-los, mas reduzem o score em vez de limitá-lo, e um sinal de pixel muito forte não é mais apagado por uma linha de texto. Reconhecer uma câmera passa a exigir marca, modelo e o bloco de metadados da própria câmera juntos, em vez de qualquer um deles.'},
  ]},
  { ver:'v2.41.0', date:'2026-08-11', title:{en:'The source is public, and the footer finally proves it',pt:'O código é público, e o rodapé finalmente comprova'}, items:[
    {t:'chg', en:'<b>The footer used to claim this was open source without offering any way to check.</b> It said so as plain text \u2014 no link, no license named, nowhere to go. That is precisely the kind of unbacked claim this tool treats as a bug anywhere else in its own interface, so it was overdue. The footer now names the license and the address where the source lives.', pt:'<b>O rodapé afirmava que isto era código aberto sem oferecer meio nenhum de conferir.</b> Dizia isso como texto puro \u2014 sem link, sem licença nomeada, sem lugar para ir. É exatamente o tipo de afirmação sem lastro que esta ferramenta trata como bug em qualquer outro ponto da própria interface, então já passava da hora. Agora o rodapé nomeia a licença e o endereço onde o código vive.'},
    {t:'add', en:'<b>The tool is now free software under GPL-3.0, and the full source is published.</b> You can read every line that runs on your machine, change it, and share it. If you distribute a modified version, that version has to stay free under the same terms \u2014 which is the point: a tool whose whole premise is that you can verify what it does would be undone by a derivative nobody can inspect. The copyright notice now travels inside the file itself, since the file is the distribution.', pt:'<b>A ferramenta agora é software livre sob GPL-3.0, e o código completo está publicado.</b> Você pode ler cada linha que roda na sua máquina, alterá-la e compartilhá-la. Se distribuir uma versão modificada, ela precisa continuar livre nos mesmos termos \u2014 e é esse o ponto: uma ferramenta cuja premissa inteira é você poder verificar o que ela faz seria desfeita por um derivado que ninguém pode inspecionar. O aviso de copyright agora viaja dentro do próprio arquivo, já que o arquivo é a distribuição.'},
  ]},
  { ver:'v2.40.0', date:'2026-08-11', title:{en:'Now the tool is offline all the way down',pt:'Agora a ferramenta é offline até o fim'}, items:[
    {t:'chg', en:'<b>The optional Pro mode was removed, and with it the last piece of the tool that ever contacted a server.</b> Pro sent your image to a machine running trained neural models, which could flag adaptive methods the browser cannot see. It was opt-in, it was labelled, and it worked \u2014 but it sat against everything else this tool claims to be. Everything now happens on your device, with no exceptions to explain. The neural analysis was a real capability and losing it is a real loss; it is simply not one this tool should have been carrying.', pt:'<b>O modo Pro opcional foi removido, e com ele a última parte da ferramenta que algum dia contatava um servidor.</b> O Pro enviava sua imagem para uma máquina com modelos neurais treinados, capazes de sinalizar métodos adaptativos que o navegador não enxerga. Era opcional, era rotulado, e funcionava \u2014 mas ia contra tudo o mais que esta ferramenta diz ser. Agora tudo acontece no seu dispositivo, sem exceções a explicar. A análise neural era uma capacidade real e perdê-la é uma perda real; apenas não era uma que esta ferramenta devia estar carregando.'},
    {t:'chg', en:'<b>The Limitations section now states the coverage gap directly.</b> Content-adaptive methods such as HILL or UNIWARD can evade the built-in statistical analysis, and the single-file build does not ship the specialised trained models normally used for that task. It also points to Aletheia for dedicated steganalysis and makes clear that a quiet result is not proof of absence.', pt:'<b>A seção Limitações passou a declarar diretamente a lacuna de cobertura.</b> Métodos adaptativos ao conteúdo como HILL ou UNIWARD podem escapar da análise estatística embutida, e a build de arquivo único não embarca os modelos treinados especializados normalmente usados para esse trabalho. A seção também aponta o Aletheia para esteganálise dedicada e deixa claro que um resultado silencioso não prova ausência.'},
    {t:'fix', en:'<b>The offline guarantee was checking itself with a rule that had a hole in it.</b> The build refuses to ship if the page depends on any external address, but the exception written for this site\u2019s own metadata was loose enough to match any subdomain \u2014 including the very server the Pro mode called. The build announced zero network dependencies while one was sitting in plain sight. The rule now matches only the exact metadata addresses.', pt:'<b>A garantia offline se conferia com uma regra furada.</b> O build recusa publicar se a página depender de qualquer endereço externo, mas a exceção escrita para os metadados do próprio site era solta o bastante para casar com qualquer subdomínio \u2014 inclusive o servidor que o modo Pro chamava. O build anunciava zero dependências de rede enquanto uma estava à vista. A regra agora casa apenas os endereços exatos de metadado.'},
    {t:'fix', en:'<b>Two warnings survived the removal that would otherwise have gone down with it.</b> The alerts for manipulative text and for decoded messages that look like executable scripts lived inside the Pro file, though neither was neural and neither ever needed a server. They now have a home of their own and are unaffected.', pt:'<b>Dois avisos sobreviveram à remoção que de outro modo teriam ido junto.</b> Os alertas de texto manipulador e de mensagem decodificada com cara de script executável moravam dentro do arquivo do Pro, embora nenhum fosse neural nem precisasse de servidor. Agora têm casa própria e seguem intactos.'},
  ]},
  { ver:'v2.39.0', date:'2026-08-11', title:{en:'When it cannot read the message, it can still name the tool',pt:'Quando não consegue ler a mensagem, ainda sabe nomear a ferramenta'}, items:[
    {t:'add', en:'<b>A new panel names the tool that hid the message, even when the message itself stays locked.</b> It appears only when every engine has failed \u2014 if the text came out, that is already the stronger proof and repeating it here would be noise. Two levels, kept deliberately far apart: <b>Confirmed</b> means Steghide\u2019s internal signature was actually read, which is proof rather than a guess, because that signature sits at positions derived from the password itself. <b>Indication</b> means something merely resembles a known tool. The two are told apart by icon, by the word itself, and by border style \u2014 never by colour alone.', pt:'<b>Um painel novo nomeia a ferramenta que escondeu a mensagem, mesmo quando a mensagem continua trancada.</b> Ele aparece só quando todos os motores falharam \u2014 se o texto saiu, essa já é a prova mais forte e repetir aqui seria ruído. Dois níveis, mantidos deliberadamente distantes: <b>Confirmado</b> significa que a assinatura interna do Steghide foi de fato lida, o que é prova e não palpite, porque essa assinatura fica em posições derivadas da própria senha. <b>Indício</b> significa que algo apenas se parece com uma ferramenta conhecida. Os dois se distinguem por ícone, pela palavra e pelo estilo da borda \u2014 nunca só por cor.'},
    {t:'chg', en:'<b>The tool now says exactly which cipher defeated it.</b> Steghide can encrypt with any of eighteen algorithms across seven modes; this decoder implements two of those combinations. Instead of falling silent on the rest, it now reports the precise pair \u2014 <code>blowfish/CBC</code>, <code>rijndael-128/CTR</code> \u2014 so you know whether to reach for another tool or whether the file is simply damaged.', pt:'<b>A ferramenta agora diz exatamente qual cifra a derrotou.</b> O Steghide pode cifrar com dezoito algoritmos em sete modos; este decodificador implementa duas dessas combinações. Em vez de silenciar diante das demais, ele passa a informar o par exato \u2014 <code>blowfish/CBC</code>, <code>rijndael-128/CTR</code> \u2014 para você saber se deve buscar outra ferramenta ou se o arquivo está simplesmente danificado.'},
    {t:'fix', en:'<b>A failed decompression no longer leaves an error hanging in the background.</b> When the extracted bytes were not valid compressed data, the tool recovered correctly but left an untended rejected promise behind, which the browser reports as an unhandled error. Nothing visible broke; the noise is simply gone now.', pt:'<b>Uma descompressão que falha não deixa mais um erro pendurado em segundo plano.</b> Quando os bytes extraídos não eram dados comprimidos válidos, a ferramenta se recuperava corretamente mas deixava para trás uma promessa rejeitada sem tratamento, que o navegador reporta como erro não capturado. Nada visível quebrava; o ruído apenas deixou de existir.'},
  ]},
  { ver:'v2.38.1', date:'2026-07-20', title:{en:'Two field fixes: needless resizing, and copy-paste',pt:'Dois consertos de campo: redimensionamento à toa e copiar-colar'}, items:[
    {t:'fix', en:'<b>Images already within the size limit are no longer resized.</b> The sturdier mode was cropping every image down to a multiple of 8 pixels — turning a 460×460 picture into 456×456 for no reason. The encoder already handles partial blocks at the edges, so the crop was needless. It now only applies when an image genuinely has to be shrunk to fit the 1080 px envelope.', pt:'<b>Imagens já dentro do limite de tamanho não são mais redimensionadas.</b> O modo resistente cortava toda imagem para um múltiplo de 8 pixels — transformando uma foto 460×460 em 456×456 sem motivo. O encoder já lida com blocos parciais nas bordas, então o corte era desnecessário. Agora ele só se aplica quando a imagem de fato precisa ser reduzida para caber no envelope de 1080 px.'},
    {t:'chg', en:'<b>Copying an image (Ctrl+C) destroys a sturdier-mode message; saving the file does not.</b> When you copy an image, the system re-encodes it on paste, and that extra recompression erases the payload — there is nothing the tool can do about it, because the damage happens before the image ever reaches it. The tool now says so: if it sees the statistical trace of a message it cannot read, it tells you to save the file and open that instead. The quick guide got the same warning.', pt:'<b>Copiar uma imagem (Ctrl+C) destrói uma mensagem do modo resistente; salvar o arquivo não.</b> Quando você copia uma imagem, o sistema a reencoda ao colar, e essa recompressão a mais apaga o payload — não há nada que a ferramenta possa fazer, porque o estrago acontece antes de a imagem chegar até ela. Agora a ferramenta avisa: se vê o indício estatístico de uma mensagem que não consegue ler, ela pede para você salvar o arquivo e abrir ele. O guia rápido recebeu o mesmo aviso.'},
  ]},
  { ver:'v2.38.0', date:'2026-07-20', title:{en:'The Analyzer can now spot the sturdier mode on its own',pt:'O Analyzer agora enxerga o modo resistente sozinho'}, items:[
    {t:'add', en:'<b>The tool can now flag its own sturdier mode in someone else\'s image — without the password and without extracting anything.</b> Hiding data in JPEG coefficients forces them onto a fixed grid, and zero is almost never a point on it, so the share of zeros in the affected frequencies collapses. That share alone proves nothing (clean images range from 14% to 74%), so it is compared against the neighbouring frequencies <b>of the same image</b>, which cancels out what the picture happens to contain.', pt:'<b>A ferramenta agora acusa o próprio modo resistente numa imagem de outra pessoa — sem a senha e sem extrair nada.</b> Esconder dados nos coeficientes do JPEG obriga cada um a cair numa grade fixa, e zero quase nunca é um ponto dela, então a proporção de zeros nas frequências afetadas desaba. Essa proporção sozinha não prova nada (imagens limpas vão de 14% a 74%), então ela é comparada com as frequências vizinhas <b>da mesma imagem</b>, o que cancela o que a foto por acaso contém.'},
    {t:'add', en:'<b>Calibrated against 46 clean images</b> — five covers at seven compression qualities each, plus ten real photos taken from WhatsApp, Facebook, Instagram and X. Not one was flagged. Every image filled to capacity was.', pt:'<b>Calibrado contra 46 imagens limpas</b> — cinco capas em sete qualidades de compressão cada, mais dez fotos reais colhidas do WhatsApp, do Facebook, do Instagram e do X. Nenhuma foi acusada. Todas as imagens cheias até a capacidade foram.'},
    {t:'chg', en:'<b>It only sees payloads that fill most of the capacity, and the tool says so.</b> At half the capacity it stays silent; below that the trace falls inside the natural variation between images. So this is a <b>trace</b>, never a confirmation — and silence from it is not a clean bill of health. A short message hidden this way will not be caught.', pt:'<b>Ele só enxerga payloads que ocupam quase toda a capacidade, e a ferramenta diz isso.</b> Com metade da capacidade ele fica calado; abaixo disso o rastro cai dentro da variação natural entre imagens. Portanto é <b>indício</b>, nunca confirmação — e o silêncio dele não é atestado de limpeza. Uma mensagem curta escondida assim não será pega.'},
    {t:'fix', en:'The quick guide was still describing a PNG-only tool. The worst of it told you to send images as a file and never as a photo — advice the sturdier image was built to make unnecessary. The whole guide was rewritten.', pt:'O guia rápido ainda descrevia uma ferramenta só-PNG. O pior deles mandava enviar as imagens como arquivo e nunca como foto — conselho que a imagem mais resistente foi feita para tornar desnecessário. O guia inteiro foi reescrito.'},
  ]},
  { ver:'v2.37.4', date:'2026-07-20', title:{en:'The alternative message warns you while you are writing it',pt:'A mensagem alternativa avisa enquanto você a escreve'}, items:[
    {t:'chg', en:'<b>The limit of the alternative message now appears in the form, not only after encoding.</b> It is written into the pixels, so it travels in the stealthier PNG and not in the sturdier JPG. Saying that only in the results panel meant saying it after the choice was already made — the note now sits right under the box where you type it, and says which of the two images to keep if plausible deniability is what you came for.', pt:'<b>O limite da mensagem alternativa agora aparece no formulário, não só depois de codificar.</b> Ela é escrita nos pixels, então viaja no PNG mais furtivo e não no JPG mais resistente. Dizer isso apenas no painel de resultado era dizer depois que a escolha já estava feita — a nota agora fica logo abaixo da caixa onde você a digita, e diz qual das duas imagens guardar se a negação plausível é o que te trouxe aqui.'},
  ]},
  { ver:'v2.37.3', date:'2026-07-20', title:{en:'Every text in the tool now matches what it actually does',pt:'Todos os textos da ferramenta agora batem com o que ela faz'}, items:[
    {t:'fix', en:'<b>The tool was still describing itself as PNG-only.</b> The terminal announced that a JPEG would be converted and saved as a PNG; the ticker claimed the output is always a lossless PNG; the note under the password field said the message sits in plaintext in the LSBs; and the how-it-works guide never mentioned the sturdier image at all. All of it has been rewritten. Since these promises were being made where a new user reads first, they are the ones that mattered most.', pt:'<b>A ferramenta ainda se descrevia como só-PNG.</b> O terminal anunciava que um JPEG seria convertido e salvo como PNG; o texto rolante afirmava que a saída é sempre um PNG sem perda; a nota sob o campo de senha dizia que a mensagem fica em texto puro nos LSBs; e o guia de como funciona não mencionava a imagem mais resistente em lugar nenhum. Tudo reescrito. Como essas promessas apareciam justamente onde um usuário novo lê primeiro, eram as que mais pesavam.'},
    {t:'add', en:'<b>The how-it-works guide gained a section on the two images</b>, explaining what each one trades, why the sturdier one shrinks the picture to 1080 px, why it spends room on error correction, and that all of it was measured on real posts rather than estimated. It also states plainly that the alternative message exists only in the PNG.', pt:'<b>O guia de como funciona ganhou uma seção sobre as duas imagens</b>, explicando o que cada uma troca, por que a mais resistente reduz a foto para 1080 px, por que gasta espaço com correção de erro, e que tudo isso foi medido em postagens reais, não estimado. Ela também diz com todas as letras que a mensagem alternativa existe apenas no PNG.'},
    {t:'fix', en:'The title of each output block was sitting too far from its image. The gap came from a border colour that does not exist in the palette: the browser threw the declaration away and kept the empty space it reserved.', pt:'O título de cada bloco de saída estava longe demais da imagem. O vão vinha de uma cor de borda que não existe na paleta: o navegador descartava a declaração e ficava com o espaço vazio que ela reservava.'},
  ]},
  { ver:'v2.37.2', date:'2026-07-20', title:{en:'Readable secondary text, and one rhythm for the panels',pt:'Texto secundário legível, e um ritmo só para os painéis'}, items:[
    {t:'fix', en:'<b>The secondary text was not dim — it was invisible.</b> The colour used for every explanatory note in the tool measured 1.87:1 against the panel background. The accepted floor for readable text is 4.5:1, so it was off by more than a factor of two. It has been raised to 4.84:1, keeping the same bluish tone: still clearly secondary, now actually readable. This affects notes everywhere in the tool, not only the new panels.', pt:'<b>O texto secundário não estava apagado — estava invisível.</b> A cor usada em toda nota explicativa da ferramenta media 1,87:1 contra o fundo dos painéis. O piso aceito para texto legível é 4,5:1, ou seja, errava por mais de duas vezes. Foi elevada para 4,84:1, mantendo o mesmo tom azulado: continua claramente secundária, agora de fato legível. Isso vale para as notas do programa inteiro, não só para os painéis novos.'},
    {t:'chg', en:'<b>All blocks in the two output columns now breathe the same amount.</b> The download button was touching its neighbours and the trade-off report was glued to the box above it, because one container in the middle of the column was not passing the spacing down. There is now a single spacing value shared by both columns.', pt:'<b>Todos os blocos das duas colunas de saída respiram igual agora.</b> O botão de download encostava nos vizinhos e o relatório de trocas ficava colado na caixa acima, porque um contêiner no meio da coluna não repassava o espaçamento. Agora há um valor único de respiro, compartilhado pelas duas colunas.'},
  ]},
  { ver:'v2.37.1', date:'2026-07-20', title:{en:'The Analyzer now sees what the Decoder reads',pt:'O Analyzer agora enxerga o que o Decoder lê'}, items:[
    {t:'fix', en:'<b>A recovered message no longer scores zero.</b> The Decoder was reading the sturdier-mode payload out of a JPEG and the threat score still said 0, because the score only ever looked at the LSB header. Pulling a real message out of an image is the strongest evidence there is — stronger than any statistic — and it now counts as such. A payload that only survived in part counts too, but as a <b>trace</b>, at half the weight: the header made it through and the body did not, and that distinction matters.', pt:'<b>Mensagem recuperada não pontua mais zero.</b> O Decoder lia o payload do modo resistente num JPEG e o score de ameaça continuava 0, porque o score só olhava o header do LSB. Extrair uma mensagem real de uma imagem é a evidência mais forte que existe — mais forte que qualquer estatística — e agora conta como tal. Um payload que sobreviveu só em parte também conta, mas como <b>indício</b>, com metade do peso: o cabeçalho passou e o corpo não, e essa distinção importa.'},
    {t:'chg', en:'<b>The two images now sit side by side</b>, each one self-contained: its own picture, its own download, its own numbers and its own report. Reading happens down each column; comparing happens across. The image-choosing tips moved below both, where they serve either one.', pt:'<b>As duas imagens agora ficam lado a lado</b>, cada uma autocontida: imagem, download, números e relatório próprios. A leitura acontece na vertical de cada coluna; a comparação, na horizontal. As dicas de escolha de imagem desceram para baixo das duas, onde servem a qualquer uma.'},
    {t:'chg', en:'The note about resizing shrank and moved inside the output-size box, next to the number it explains, instead of sitting apart as a paragraph of its own.', pt:'A nota sobre redimensionamento encolheu e foi para dentro do bloco de tamanho de saída, ao lado do número que ela explica, em vez de ficar solta como um parágrafo à parte.'},
    {t:'fix', en:'<b>The alternative message only ever existed in the PNG.</b> It is written into the pixels, and the sturdier image is built from the clean cover — so it never carried it. The tool was silent about that, which made it look like a failed extraction. Now the sturdier image says plainly that it carries the real message only.', pt:'<b>A mensagem alternativa só existia no PNG.</b> Ela é escrita nos pixels, e a imagem resistente é construída a partir da capa limpa — então ela nunca a carregou. A ferramenta ficava calada sobre isso, o que parecia extração falhada. Agora a imagem resistente diz com todas as letras que carrega apenas a mensagem real.'},
  ]},
  { ver:'v2.37.0', date:'2026-07-19', title:{en:'Two images out: one stealthier, one sturdier',pt:'Duas imagens na saída: uma mais furtiva, outra mais resistente'}, items:[
    {t:'add', en:'<b>The Encoder now gives you two images instead of one</b>, both carrying the same message. The <b>stealthier</b> one is the PNG you already knew — it hides better, but the message dies if you post it. The <b>sturdier</b> one is a JPG that survives being posted: it hides the message in the JPEG coefficients, where recompression cannot reach it.', pt:'<b>O Encoder agora entrega duas imagens em vez de uma</b>, as duas com a mesma mensagem. A <b>mais furtiva</b> é o PNG que você já conhecia — esconde melhor, mas a mensagem morre se você publicar. A <b>mais resistente</b> é um JPG que sobrevive à publicação: esconde a mensagem nos coeficientes do JPEG, onde a recompressão não alcança.'},
    {t:'add', en:'<b>Measured, not estimated.</b> Real images were posted to WhatsApp, X, Facebook and Instagram, downloaded back, and read. The message came back intact from all four. Everything the sturdier mode does is set by those measurements: it shrinks the image to 1080 px because above that the platforms resize it and nothing survives, and it uses enough redundancy to absorb the worst damage any of the four caused.', pt:'<b>Medido, não estimado.</b> Imagens reais foram postadas no WhatsApp, no X, no Facebook e no Instagram, baixadas de volta e lidas. A mensagem voltou íntegra das quatro. Tudo o que o modo mais resistente faz vem dessas medições: ele reduz a imagem para 1080 px porque acima disso as plataformas redimensionam e nada sobrevive, e usa redundância suficiente para absorver o pior estrago que qualquer uma das quatro causou.'},
    {t:'add', en:'<b>Neither version is the better one.</b> The sturdier image reports what it trades on two separate readings — how well it survives the channel, and how discreet it is — instead of a single score, precisely so the two are not compared on the same ruler. Someone hunting for steganography in JPEG coefficients will see the pattern in the sturdier image; they still cannot read it without the password.', pt:'<b>Nenhuma das duas é a melhor.</b> A imagem mais resistente informa o que ela troca em duas leituras separadas — o quanto sobrevive ao canal e o quanto é discreta — em vez de uma nota única, justamente para que as duas não sejam comparadas na mesma régua. Quem procurar por esteganografia nos coeficientes do JPEG vê o padrão na imagem mais resistente; ainda assim não consegue lê-lo sem a senha.'},
    {t:'add', en:'The Decoder reads the sturdier mode automatically. If the payload was damaged in transit, it says so — <b>"there is a message here, but it did not survive the trip"</b> — instead of the far less useful "nothing found".', pt:'O Decoder lê o modo mais resistente automaticamente. Se o payload se avariou no caminho, ele diz isso — <b>"há uma mensagem aqui, mas ela não sobreviveu ao caminho"</b> — em vez do bem menos útil "nada encontrado".'},
    {t:'chg', en:'When the message is too long for the sturdier version, it says so with the numbers — how much you need and how much fits — and points you to the PNG plus a channel that preserves files. It never generates a broken image.', pt:'Quando a mensagem é longa demais para a versão mais resistente, ela diz isso com os números — quanto você precisa e quanto cabe — e aponta para o PNG somado a um canal que preserva arquivos. Nunca gera uma imagem quebrada.'},
    {t:'fix', en:'Error correction refuses to guess. If the damage is beyond what it can repair, it reports failure rather than handing back a message that looks fine and is wrong.', pt:'A correção de erro se recusa a adivinhar. Se o estrago passa do que ela consegue reparar, ela reporta falha em vez de devolver uma mensagem que parece boa e está errada.'},
  ]},
  { ver:'v2.36.0', date:'2026-07-19', title:{en:'Progressive JPEG: the DCT reader finally opens it',pt:'JPEG progressivo: o leitor DCT finalmente abre'}, items:[
    {t:'add', en:'<b>Progressive JPEG (SOF2) is now read.</b> Until now the DCT coefficient reader refused these files, and that blind spot mattered: <b>Facebook and X publish progressive</b>. On those images the JPEG Analyzer showed nothing and the Decoder did not even attempt Steghide or OutGuess — on X in particular, which is the one platform that preserves payloads byte for byte.', pt:'<b>JPEG progressivo (SOF2) agora é lido.</b> Até aqui o leitor de coeficientes DCT recusava esses arquivos, e o ponto cego pesava: <b>Facebook e X publicam progressivo</b>. Nessas imagens o Analyzer-JPEG não mostrava nada e o Decoder nem tentava Steghide ou OutGuess — justamente no X, a única plataforma que preserva os payloads byte a byte.'},
    {t:'add', en:'The reader now accumulates the multiple scans a progressive file is built from, covering all four cases (DC first and refinement, AC first and refinement), plus EOB runs and successive approximation.', pt:'O leitor agora acumula os múltiplos scans que compõem um arquivo progressivo, cobrindo os quatro casos (DC primeira e refinamento, AC primeira e refinamento), mais EOB runs e aproximação sucessiva.'},
    {t:'fix', en:'Removed the texts that said progressive was unsupported — the friendly notice on the DCT panel and the honest-limits item in the help. They would now be lying.', pt:'Removidos os textos que diziam que progressivo não era suportado — o aviso amigável do painel DCT e o item dos limites honestos na ajuda. Eles passariam a mentir.'},
  ]},
  { ver:'v2.35.2', date:'2026-07-18', title:{en:'The platform notice stops crediting the wrong method',pt:'O aviso de plataforma para de creditar o método errado'}, items:[
    {t:'fix', en:'The platform notice had <b>"(identified by filename)"</b> written into it, from back when the filename was the only method. Even when the detection came from the file\'s structure, it kept crediting the name — and contradicted the line added in the previous version. It now lists only the methods that actually fired.', pt:'O aviso de plataforma tinha <b>"(identificado pelo nome do arquivo)"</b> escrito fixo, de quando o nome era o único método. Mesmo quando a detecção vinha da estrutura do arquivo, ele insistia em creditar o nome — e contradizia a linha acrescentada na versão anterior. Agora lista só os métodos que realmente dispararam.'},
    {t:'chg', en:'The notice was reorganised: first <b>what</b> was detected and <b>why it matters</b> (EXIF stripped, so the camera veto cannot apply and pixel signals inflate the synthetic score), then <b>how</b> it was detected.', pt:'O aviso foi reorganizado: primeiro <b>o que</b> foi detectado e <b>por que isso importa</b> (EXIF removido, então o veto de câmera não atua e os sinais de pixel inflam o score sintético), e só depois <b>como</b> foi detectado.'},
    {t:'chg', en:'On JPEG, the <b>Decode Status</b> line no longer repeats the note right above it. Instead of "LSB unavailable", it now says what actually matters: which engines were tried and what came of it.', pt:'Em JPEG, a linha <b>Decode Status</b> não repete mais a nota logo acima. Em vez de "LSB indisponível", agora diz o que interessa: quais motores foram tentados e no que deu.'},
  ]},
  { ver:'v2.35.1', date:'2026-07-18', title:{en:'Stops hiding the extraction result on JPEG',pt:'Para de esconder o resultado da extração em JPEG'}, items:[
    {t:'fix', en:'On a JPEG, the <b>Protocol</b> module showed only "STEGO·STUDIO protocol uses LSB — unavailable in JPEG" and nothing else. But the <b>Steghide</b> and <b>OutGuess</b> engines had been tried anyway, and their result was being thrown away. The <b>Decode Status</b> line now always appears, including when the tool\'s own protocol does not apply.', pt:'Num JPEG, o módulo <b>Protocolo</b> exibia apenas "Protocolo STEGO·STUDIO usa LSB — indisponível em JPEG" e mais nada. Mas os motores <b>Steghide</b> e <b>OutGuess</b> tinham sido tentados assim mesmo, e o resultado deles era descartado. A linha <b>Decode Status</b> agora aparece sempre, inclusive quando o protocolo próprio não se aplica.'},
    {t:'fix', en:'This also makes the note in the DCT-coefficients panel true: it points to that line, which until now simply did not exist on JPEG — the exact format where the note is shown.', pt:'Isso também torna verdadeira a nota do painel de coeficientes DCT: ela aponta para essa linha, que até agora não existia em JPEG — justamente o formato onde a nota aparece.'},
  ]},
  { ver:'v2.35.0', date:'2026-07-18', title:{en:'Recognises the platform by the file itself',pt:'Reconhece a plataforma pelo próprio arquivo'}, items:[
    {t:'add', en:'The tool can now tell that an image passed through <b>WhatsApp</b>, <b>Facebook</b> or <b>Instagram</b> by reading the file\'s own structure — the quantisation tables and how it was encoded. Until now this was guessed from the file name alone, which vanishes the moment someone renames or re-downloads the image.', pt:'A ferramenta agora reconhece que uma imagem passou por <b>WhatsApp</b>, <b>Facebook</b> ou <b>Instagram</b> lendo a estrutura do próprio arquivo — as tabelas de quantização e a forma como foi codificado. Até aqui isso era deduzido só pelo nome do arquivo, que desaparece assim que alguém renomeia ou rebaixa a imagem.'},
    {t:'chg', en:'The origin panel now says <b>where the evidence came from</b>: structure (survives renaming) or file name (fragile). Knowing how strong a signal is matters as much as the signal.', pt:'O painel de origem agora diz <b>de onde veio a evidência</b>: estrutura (sobrevive a renomeação) ou nome do arquivo (frágil). Saber a força de um sinal importa tanto quanto o sinal.'},
    {t:'chg', en:'The profiles come from real measurements, not assumptions. <b>X/Twitter was deliberately left out</b>: it does not recompress — it repackages the image losslessly, keeping the original tables. So it has no signature of its own, and claiming one would produce a false match on any untouched file from the same editor.', pt:'Os perfis vêm de medição real, não de suposição. O <b>X/Twitter ficou de fora de propósito</b>: ele não recomprime — reembala a imagem sem perda, mantendo as tabelas da origem. Não tem assinatura própria, e afirmar que tem produziria falso positivo em qualquer arquivo intocado do mesmo editor.'},
    {t:'fix', en:'The note in the DCT-coefficients panel pointed to a "decoding panel" that does not exist by that name. It now names the actual places on screen, and covers both cases — where the message shows up when something is found, and where the outcome shows up when nothing is.', pt:'A nota do painel de coeficientes DCT apontava para um "painel de decodificação" que não existe com esse nome. Agora ela nomeia os lugares reais da tela e cobre os dois casos — onde a mensagem aparece quando algo é encontrado, e onde fica o resultado quando não é.'},
  ]},
  { ver:'v2.34.0', date:'2026-07-18', title:{en:'Saying plainly what it does — and what it does not',pt:'Dizendo com clareza o que faz — e o que não faz'}, items:[
    {t:'add', en:'New help section: <b>The Decoder — what it reads, and what it doesn\'t</b>. It lists the tools that are actually read (STEGO·STUDIO\'s own protocol, OpenStego, Steghide, OutGuess), the ones that are not — <b>with the reason for each</b> — and the honest limits: no usable LSB in JPEG, progressive JPEG unsupported, and the DCT chi-square being a weak indicator rather than a detector.', pt:'Nova seção na ajuda: <b>O Decoder — o que ele lê, e o que não lê</b>. Lista as ferramentas que realmente são lidas (o protocolo do próprio STEGO·STUDIO, OpenStego, Steghide, OutGuess), as que não são — <b>com o motivo de cada uma</b> — e os limites honestos: LSB inaproveitável em JPEG, progressivo não suportado, e o chi-quadrado dos coeficientes DCT sendo indicador fraco, não detector.'},
    {t:'fix', en:'The help modal still said the tool had <b>two</b> functions, while the header right above it read ENCODER · ANALYZER · DECODER. The Decoder — the module that grew the most in recent versions — was missing from the tool\'s own description.', pt:'O modal de ajuda ainda dizia que a ferramenta tinha <b>duas</b> funções, enquanto o cabeçalho logo acima dizia ENCODER · ANALYZER · DECODER. O Decoder — o módulo que mais cresceu nas últimas versões — não aparecia na própria descrição da ferramenta.'},
    {t:'fix', en:'A scrolling-bar message claimed the deep investigator <i>"recovers messages from any tool"</i>. It does not: it sweeps for readable text when no known header is present. The overclaim was replaced by an accurate description, and messages covering the real capabilities were added.', pt:'Uma mensagem da barra rolante afirmava que o investigador profundo <i>"recupera mensagens de qualquer ferramenta"</i>. Ele não faz isso: ele varre em busca de texto legível quando não há cabeçalho conhecido. A afirmação exagerada foi substituída por uma descrição precisa, e foram acrescentadas mensagens sobre as capacidades reais.'},
    {t:'fix', en:'The DCT-coefficients panel told the reader to "use the Decoder" — in a tool with a single button that had already run it, and mentioning only Steghide. It now says plainly that the extraction was already attempted, with both engines, and where to find the result.', pt:'O painel de coeficientes DCT mandava "usar o Decoder" — num app de um botão só, que já o havia rodado, e citando apenas o Steghide. Agora diz com clareza que a extração já foi tentada, com os dois motores, e onde está o resultado.'},
    {t:'fix', en:'In the origin panel, the <i>synthetic</i> category could show a score with no signal explaining it, when the digital-graphic safeguard capped that score. It now states why the score exists and why it stopped there.', pt:'No painel de origem, a categoria <i>sintética</i> podia exibir um score sem nenhum sinal explicando, quando a proteção de gráfico digital limitava esse score. Agora ele diz por que o score existe e por que parou ali.'},
  ]},
  { ver:'v2.33.3', date:'2026-07-18', title:{en:'Faster still: one read per analysis',pt:'Mais rápido ainda: uma leitura por análise'}, items:[
    {t:'chg', en:'The previous version stopped the two Decoder engines from repeating the same heavy work. This one finishes the job: the Analyzer was <i>also</i> decoding the same JPEG separately. The image is now decoded <b>once per analysis</b> and the result is shared by everything that needs it — up to <b>43% faster</b> on large photos, on top of the previous gain.', pt:'A versão anterior impediu que os dois motores do Decoder repetissem o mesmo trabalho pesado. Esta termina o serviço: o Analyzer <i>também</i> decodificava o mesmo JPEG por conta própria. Agora a imagem é decodificada <b>uma vez por análise</b> e o resultado é compartilhado por tudo que precisa dele — até <b>43% mais rápido</b> em fotos grandes, somado ao ganho anterior.'},
  ]},
  { ver:'v2.33.2', date:'2026-07-18', title:{en:'Decoder is faster on JPEG',pt:'Decoder mais rápido em JPEG'}, items:[
    {t:'chg', en:'When reading a JPEG, the Decoder was doing the same heavy work twice: the Steghide engine decoded the image\'s DCT coefficients, found nothing, and the OutGuess engine decoded exactly the same thing all over again. It now decodes once and shares the result. Around <b>25% faster</b> on JPEG, and the gain is biggest on large photos — where the wait was most noticeable.', pt:'Ao ler um JPEG, o Decoder fazia o mesmo trabalho pesado duas vezes: o motor Steghide decodificava os coeficientes DCT da imagem, não achava nada, e o motor OutGuess decodificava exatamente a mesma coisa de novo. Agora decodifica uma vez e compartilha o resultado. Cerca de <b>25% mais rápido</b> em JPEG, com o maior ganho nas fotos grandes — justamente onde a espera incomodava mais.'},
  ]},
  { ver:'v2.33.1', date:'2026-07-18', title:{en:'A digital image is not an AI image',pt:'Imagem digital não é imagem de IA'}, items:[
    {t:'fix', en:'Rendered text, diagrams, flat art and exported screens saved as JPEG could be reported as <b>high probability of AI</b>. The signals behind that were real, but they only ever said "this is not a photograph" — none of them is specific to AI. The tool now recognises these as digital graphics, caps the AI score and classifies them under <b>digital art</b> instead.', pt:'Texto renderizado, diagramas, arte flat e telas exportadas em JPEG podiam ser reportados como <b>alta probabilidade de IA</b>. Os sinais por trás disso eram reais, mas eles só diziam "isto não é uma fotografia" — nenhum é específico de IA. A ferramenta agora reconhece esses casos como gráfico digital, limita o score de IA e classifica em <b>arte digital</b>.'},
    {t:'chg', en:'The previous safeguard only worked on PNG, because it required almost no noise — something JPEG compression destroys. The new one works on compressed images too.', pt:'A proteção anterior só funcionava em PNG, porque exigia ruído quase nulo — algo que a compressão JPEG destrói. A nova funciona também em imagens comprimidas.'},
    {t:'chg', en:'Hard evidence still wins: when a C2PA manifest or EXIF names an AI generator, the AI verdict stands.', pt:'Prova dura continua valendo: quando um manifesto C2PA ou o EXIF nomeiam um gerador de IA, o veredito de IA permanece.'},
  ]},
  { ver:'v2.33.0', date:'2026-07-18', title:{en:'Decoder now reads OutGuess',pt:'Decoder agora lê OutGuess'}, items:[
    {t:'add', en:'The Decoder can now recover messages hidden by <b>OutGuess</b> — the tool famously used by the <b>Cicada 3301</b> puzzle. It works with no password (OutGuess\'s default) or with the password when one was used.', pt:'O Decoder agora recupera mensagens escondidas pelo <b>OutGuess</b> — a ferramenta usada no famoso enigma do <b>Cicada 3301</b>. Funciona sem senha (o padrão do OutGuess) ou com a senha, quando houver.'},
    {t:'add', en:'With OpenStego, Steghide and OutGuess, the Decoder now covers the three most common third-party tools — a single place that recognises the format, identifies the tool and recovers the message.', pt:'Com OpenStego, Steghide e OutGuess, o Decoder passa a cobrir as três ferramentas de terceiro mais comuns — um lugar só que reconhece o formato, identifica a ferramenta e recupera a mensagem.'},
    {t:'fix', en:'OutGuess has an edge case where the last byte of a message is never actually embedded (it falls past the image capacity). When that happens the Decoder recovers the rest and says so plainly, instead of showing a corrupt character as if it were real.', pt:'O OutGuess tem um caso de borda em que o último byte da mensagem não chega a ser embutido (cai além da capacidade da imagem). Quando isso acontece, o Decoder recupera o resto e avisa com clareza, em vez de mostrar um caractere corrompido como se fosse real.'},
  ]},
  { ver:'v2.32.1', date:'2026-07-17', title:{en:'JPEG detection & progressive handling fixes',pt:'Correções de detecção JPEG e progressivo'}, items:[
    {t:'fix', en:'Image format is now detected by <b>file signature (magic bytes)</b>, not just extension or MIME type. Files like <b>.jfif</b>, .jpe, or JPEGs with a wrong/missing MIME are now correctly recognized and get full DCT + Steghide analysis.', pt:'O formato da imagem agora é detectado pela <b>assinatura do arquivo (magic bytes)</b>, não só pela extensão ou MIME. Arquivos como <b>.jfif</b>, .jpe, ou JPEGs com MIME errado/ausente agora são reconhecidos corretamente e recebem análise DCT + Steghide completa.'},
    {t:'fix', en:'<b>Progressive JPEGs</b> now show a clear, friendly message explaining that DCT analysis currently supports baseline JPEG (progressive is planned), instead of a confusing error. Strings, metadata and AI analysis still run.', pt:'<b>JPEGs progressivos</b> agora mostram uma mensagem clara e amigável explicando que a análise DCT hoje suporta JPEG baseline (progressivo está planejado), em vez de um erro confuso. Strings, metadados e análise de IA continuam rodando.'},
    {t:'fix', en:'The terminal no longer warns that JPEG is "unavailable" — it now correctly reflects that DCT-coefficient analysis, Steghide extraction, AI and metadata all work for JPEG.', pt:'O terminal não avisa mais que JPEG está "indisponível" — agora reflete corretamente que análise de coeficientes DCT, extração de Steghide, IA e metadados funcionam para JPEG.'},
  ]},
  { ver:'v2.32.0', date:'2026-07-17', title:{en:'Analyzer now inspects JPEG DCT coefficients',pt:'Analyzer agora inspeciona coeficientes DCT do JPEG'}, items:[
    {t:'add', en:'For <b>JPEG</b> images, the Analyzer no longer just says "unavailable" — it now reads the actual quantized <b>DCT coefficients</b> and reports descriptive statistics (non-zero counts, distinct values, distribution across frequency bands) plus a first-order chi-square check.', pt:'Para imagens <b>JPEG</b>, o Analyzer não diz mais apenas "indisponível" — agora lê os <b>coeficientes DCT</b> quantizados de verdade e reporta estatísticas descritivas (contagem de não-zeros, valores distintos, distribuição por banda de frequência) mais um teste qui-quadrado de primeira ordem.'},
    {t:'add', en:'The chi-square result is labeled <b>honestly</b>: it catches naive high-rate LSB embedding (like Jsteg), but not tools that spread a small payload (Steghide, OutGuess, F5). The Analyzer states plainly that absence of a signal does not mean the image is clean — and points to the Decoder for a real Steghide extraction.', pt:'O resultado do qui-quadrado é rotulado com <b>honestidade</b>: pega embedding LSB ingênuo de alta taxa (como Jsteg), mas não ferramentas que espalham um payload pequeno (Steghide, OutGuess, F5). O Analyzer diz claramente que ausência de sinal não significa imagem limpa — e aponta para o Decoder para uma extração real do Steghide.'},
  ]},
  { ver:'v2.31.0', date:'2026-07-17', title:{en:'Decoder now reads Steghide (incl. JPEG/DCT)',pt:'Decoder agora lê Steghide (incl. JPEG/DCT)'}, items:[
    {t:'add', en:'The Decoder can now recover messages hidden by <b>Steghide</b> — the popular steganography tool. This includes Steghide in <b>JPEG</b> images, which hide data in DCT coefficients rather than pixels, a domain the Analyzer previously couldn\'t reach at all.', pt:'O Decoder agora recupera mensagens escondidas pelo <b>Steghide</b> — a popular ferramenta de esteganografia. Isso inclui Steghide em imagens <b>JPEG</b>, que escondem dados nos coeficientes DCT em vez de pixels, um domínio que o Analyzer antes não alcançava.'},
    {t:'add', en:'Steghide encrypts by default with <b>AES-256</b>; the Decoder handles this transparently — provide the password and the message is recovered, filename and all. Without a password, Steghide files made without one are read automatically.', pt:'O Steghide cifra por padrão com <b>AES-256</b>; o Decoder lida com isso de forma transparente — informe a senha e a mensagem é recuperada, com nome de arquivo e tudo. Sem senha, arquivos Steghide feitos sem senha são lidos automaticamente.'},
    {t:'add', en:'Under the hood, this introduces a shared <b>JPEG/DCT engine</b> that reads quantized DCT coefficients directly in the browser — the foundation for upcoming JPEG steganalysis and robust-mode embedding.', pt:'Nos bastidores, isso introduz um <b>motor JPEG/DCT compartilhado</b> que lê coeficientes DCT quantizados direto no navegador — a base para a futura esteganálise em JPEG e o modo robusto de embutir.'},
  ]},
  { ver:'v2.30.0', date:'2026-07-16', title:{en:'Decoder now reads OpenStego images',pt:'Decoder agora lê imagens do OpenStego'}, items:[
    {t:'add', en:'The Decoder can now recover messages hidden by <b>OpenStego</b> (RandomLSB), not just STEGO·STUDIO\'s own format. Images with no password are read automatically; password-protected ones are recovered when you provide the password. This is the first of several third-party engines planned.', pt:'O Decoder agora recupera mensagens escondidas pelo <b>OpenStego</b> (RandomLSB), não só o formato do próprio STEGO·STUDIO. Imagens sem senha são lidas automaticamente; as protegidas por senha são recuperadas quando você informa a senha. É o primeiro de vários motores de terceiros planejados.'},
    {t:'add', en:'When an OpenStego image uses its optional AES encryption, the Decoder identifies the source honestly and tells you to open it in OpenStego with the password, instead of pretending to extract it.', pt:'Quando uma imagem OpenStego usa a cifra AES opcional, o Decoder identifica a origem com honestidade e orienta a abri-la no OpenStego com a senha, em vez de fingir que extraiu.'},
  ]},
  { ver:'v2.29.1', date:'2026-07-16', title:{en:'Plausible deniability — UI polish',pt:'Negação plausível — ajustes de UI'}, items:[
    {t:'chg', en:'The "protection" field now reads "plaintext (no password)" when no key is set, making it clearer that a message without a password is trivially recoverable.', pt:'O campo "proteção" agora mostra "texto puro (sem senha)" quando não há chave, deixando claro que uma mensagem sem senha é trivialmente recuperável.'},
    {t:'fix', en:'When the second message is enabled and filled but has no password, the Hide button stays disabled with an inline alert (the alternate message is always encrypted, so it requires its own password). The terminal message, if reached, now reads "alternate password required".', pt:'Quando a segunda mensagem está ligada e preenchida mas sem senha, o botão Ocultar fica desabilitado com um alerta (a mensagem alternativa é sempre cifrada, então exige senha própria). A mensagem do terminal, se alcançada, agora diz "senha alternativa obrigatória".'},
  ]},
  { ver:'v2.29.0', date:'2026-07-15', title:{en:'Plausible deniability: a second, hidden message',pt:'Negação plausível: uma segunda mensagem oculta'}, items:[
    {t:'add', en:'The encoder can now embed a <b>second, independent message</b> in the same image, unlocked by a different password. If someone forces you to reveal a password, you hand over the alternate one — it reveals a harmless message, while your real message stays protected and <b>undetectable even to someone holding this tool\'s source code</b>. The two layers never overlap; each decodes only with its own password.', pt:'O encoder agora embute uma <b>segunda mensagem independente</b> na mesma imagem, aberta por uma senha diferente. Se alguém forçar você a revelar uma senha, você entrega a alternativa — ela revela uma mensagem inofensiva, enquanto sua mensagem real permanece protegida e <b>indetectável mesmo para quem tem o código-fonte desta ferramenta</b>. As duas camadas nunca se sobrepõem; cada uma decodifica só com a sua senha.'},
    {t:'add', en:'The real message keeps full STC stealth; the alternate message is stored separately and validated by AES-GCM — no marker betrays that a second layer exists.', pt:'A mensagem real mantém a furtividade STC completa; a mensagem alternativa é guardada à parte e validada por AES-GCM — nenhum marcador denuncia que existe uma segunda camada.'},
  ]},
  { ver:'v2.28.3', date:'2026-07-04', title:{en:'Tips moved into a second box in the right column',pt:'Dicas viram um segundo quadro na coluna direita'}, items:[
    {t:'chg', en:'The "Choosing an image" tips moved from a full-width band into a <b>second box in the right column</b>, below the stealth report — same style, filling the empty space so the two columns balance in height. Single-column list (no more 4-column spread).', pt:'As dicas "Como escolher a imagem" saíram da faixa de largura total e viraram um <b>segundo quadro na coluna direita</b>, abaixo do relatório de furtividade — mesmo estilo, preenchendo o espaço vazio para as duas colunas equilibrarem em altura. Lista de coluna única (sem mais o espalhamento em 4 colunas).'},
  ]},
  { ver:'v2.28.2', date:'2026-07-04', title:{en:'Encoder layout rebalanced',pt:'Layout do encoder reequilibrado'}, items:[
    {t:'chg', en:'Reworked the encoder output so the two columns balance: the <b>map button and legend moved under the image</b> (where the map appears), the tips became a <b>full-width band below</b> with a separator, the caveat now sits right under the verdict, the image is larger, and the spacing around the download button was fixed.', pt:'Refiz a saída do encoder para as duas colunas equilibrarem: o <b>botão do mapa e a legenda desceram para baixo da imagem</b> (onde o mapa aparece), as dicas viraram uma <b>faixa de largura total embaixo</b> com separador, a nota agora fica logo abaixo do veredito, a imagem ficou maior, e o espaçamento em volta do botão de download foi corrigido.'},
    {t:'chg', en:'The map legend now reads "less detectable → more detectable" (clearer than "clean → leaks") in <b>both</b> the encoder and the analyzer. The encoder map button reads "Show stealth map".', pt:'A legenda do mapa agora diz "menos detectável → mais detectável" (mais claro que "limpo → vaza") <b>nos dois</b>, encoder e analyzer. O botão do mapa no encoder diz "Ver mapa de furtividade".'},
  ]},
  { ver:'v2.28.1', date:'2026-07-04', title:{en:'Encoder output in two columns; map as an overlay',pt:'Saída do encoder em duas colunas; mapa como overlay'}, items:[
    {t:'chg', en:'The encoder output was reorganized into <b>two columns</b> (image + download + stats on the left, stealth report on the right) — no more stretched empty space, and the download button sits at the top, reachable without scrolling.', pt:'A saída do encoder foi reorganizada em <b>duas colunas</b> (imagem + download + infos à esquerda, relatório de furtividade à direita) — sem mais espaço vazio esticado, e o botão de download fica no topo, alcançável sem rolar.'},
    {t:'chg', en:'The leak map is now an <b>overlay on the generated image</b> (like the Analyzer), shown by a button — instead of a cramped inline grid. That frees the right column for full bullet-point tips, and the map is only computed on demand (lighter encode). The verdict moved up to right below the two bars.', pt:'O mapa de vazamento agora é um <b>overlay sobre a imagem gerada</b> (como no Analyzer), acionado por um botão — em vez de uma grade inline espremida. Isso libera a coluna direita para as dicas em bullets completos, e o mapa só é calculado sob demanda (encode mais leve). O veredito subiu para logo abaixo das duas barras.'},
    {t:'chg', en:'In the Analyzer, the leak map now turns on automatically when you open the module (computed then, not before), with the button still there to toggle it off/on.', pt:'No Analyzer, o mapa de vazamento agora liga sozinho ao abrir o módulo (calculado nesse momento, não antes), com o botão ainda ali para desligar/religar.'},
  ]},
  { ver:'v2.28.0', date:'2026-07-04', title:{en:'Leak panel: bigger image, legend, and split tips',pt:'Painel de vazamento: imagem maior, legenda e dicas separadas'}, items:[
    {t:'chg', en:'The Analyzer leak map moved from the tiny drop preview into its own results module, with a <b>larger image</b>, the overlay, and a <b>legend</b> (clean → more signal). On desktop it is two columns (image + reading); on mobile it stacks.', pt:'O mapa de vazamento do Analyzer saiu da miniatura minúscula do drop e virou um módulo próprio nos resultados, com <b>imagem maior</b>, o overlay e uma <b>legenda</b> (limpo → mais sinal). No desktop são duas colunas (imagem + leitura); no celular empilha.'},
    {t:'add', en:'Context-aware tips: the <b>Encoder</b> shows "Choosing an image" (avoid homogeneous images, prefer texture, smaller message in a bigger image, use the original) — advice for someone hiding a message. The <b>Analyzer</b> shows "How to read this map" — forensic interpretation for someone hunting one.', pt:'Dicas conscientes do contexto: o <b>Encoder</b> mostra "Como escolher a imagem" (evitar imagens homogêneas, preferir textura, mensagem menor em imagem maior, usar o original) — conselho pra quem esconde. O <b>Analyzer</b> mostra "Como ler este mapa" — interpretação forense pra quem procura.'},
    {t:'chg', en:'Terminology: "detection floor" → "detection threshold" ("piso" → "limite de detecção"), since "floor" wrongly suggested a minimum to exceed. The encoder map now shares the same cyan visual language as the Analyzer overlay, with a matching legend.', pt:'Terminologia: "piso de detecção" → "limite de detecção", já que "piso" sugeria por engano um mínimo a superar. O mapa do encoder agora usa a mesma linguagem visual ciano do overlay do Analyzer, com legenda igual.'},
  ]},
  { ver:'v2.27.1', date:'2026-07-04', title:{en:'"Working…" indicator so the encoder never looks frozen',pt:'Indicador "Trabalhando…" pra o encoder nunca parecer travado'}, items:[
    {t:'fix', en:'After encoding, the tool runs the stealth analysis on the main thread, which briefly froze the UI (and the terminal) — over a second of apparent lock reads as "broken". Now the <b>Encode button</b> shows a spinning "Working…" state the moment you click. The spinner animates on the compositor thread, so it <b>keeps moving even while the analysis blocks JavaScript</b> — clear "it is working" feedback, not frozen.', pt:'Após codificar, a ferramenta roda a análise de furtividade na thread principal, o que congelava a UI (e o terminal) por um instante — mais de um segundo de aparente trava passa a impressão de "quebrou". Agora o <b>botão de Encode</b> mostra um estado giratório "Trabalhando…" no momento do clique. O spinner anima na thread de composição, então <b>continua girando mesmo enquanto a análise bloqueia o JavaScript</b> — feedback claro de "está trabalhando", não travado.'},
    {t:'fix', en:'The indicator lives on the button itself — ideal on mobile, where scrolling down to Encode pushes the terminal off-screen. Respects prefers-reduced-motion.', pt:'O indicador fica no próprio botão — ideal no celular, onde descer até o Encode empurra o terminal pra fora da tela. Respeita prefers-reduced-motion.'},
  ]},
  { ver:'v2.27.0', date:'2026-07-04', title:{en:'Leak map overlay in the Analyzer',pt:'Overlay do mapa de vazamento no Analyzer'}, items:[
    {t:'add', en:'The Analyzer can now overlay a <b>leak map</b> directly on any image you load: a "Show leak map" toggle highlights the regions where the RS signal is strongest, aligned to the image (letterboxing handled). Clean regions stay transparent so the picture shows through; leaky regions get a cyan glow (colorblind-safe brightness cue). Computed on demand — no cost unless you open it.', pt:'O Analyzer agora sobrepõe um <b>mapa de vazamento</b> direto em qualquer imagem que você carrega: um botão "Ver mapa de vazamento" destaca as regiões onde o sinal RS é mais forte, alinhado à imagem (letterbox tratado). Regiões limpas ficam transparentes (a imagem aparece); regiões que vazaram ganham um brilho ciano (pista de brilho, acessível ao daltonismo). Calculado sob demanda — sem custo se você não abrir.'},
  ]},
  { ver:'v2.26.0', date:'2026-07-03', title:{en:'Leak map: see where the signal is strongest',pt:'Mapa de vazamento: veja onde o sinal é mais forte'}, items:[
    {t:'add', en:'The output stealth report now includes a grayscale <b>leak map</b> — a grid where brighter cells show where the RS signal is strongest across the image, so you can see which regions gave the payload away (smooth areas leak, textured areas hide). Luminance scale, colorblind-safe. Reuses the RS detector per grid cell.', pt:'O relatório de furtividade agora inclui um <b>mapa de vazamento</b> em escala de cinza — uma grade onde células mais claras mostram onde o sinal RS é mais forte na imagem, pra você ver quais regiões entregaram a mensagem (áreas lisas vazam, áreas com textura escondem). Escala de luminância, acessível ao daltonismo. Reaproveita o detector RS por célula da grade.'},
  ]},
  { ver:'v2.25.0', date:'2026-07-03', title:{en:'The encoder now grades its own stealth',pt:'O encoder agora avalia a própria furtividade'}, items:[
    {t:'add', en:'<b>Output stealth report:</b> after encoding, the tool runs its own statistical arsenal (RS/WS) on the image it just produced and tells you how detectable it came out — estimated RS/WS rate plus a plain-language verdict (below the detection threshold / weak signal / detectable). It uses the same thresholds as the Analyzer, so the encoder never claims "stealthy" where the Analyzer would say "detected".', pt:'<b>Relatório de furtividade da saída:</b> após codificar, a ferramenta roda o próprio arsenal estatístico (RS/WS) na imagem que acabou de gerar e te diz quão detectável ela ficou — taxa RS/WS estimada mais um veredito em linguagem clara (abaixo do limite de detecção / sinal fraco / detectável). Usa os mesmos limiares do Analyzer, então o encoder nunca diz "furtivo" onde o Analyzer diria "detectado".'},
    {t:'add', en:'It runs automatically in the background (the image and stats appear instantly; the verdict fills in a moment later) and states honestly that it measures <i>our</i> output with <i>our</i> arsenal — not a guarantee of undetectability against every tool. This closes the encode→detect→improve loop right inside the app.', pt:'Roda automaticamente em segundo plano (a imagem e as infos aparecem na hora; o veredito preenche logo depois) e diz honestamente que mede a <i>nossa</i> saída com o <i>nosso</i> arsenal — não é garantia de indetectabilidade contra toda ferramenta. Fecha o ciclo codificar→detectar→melhorar dentro do próprio app.'},
  ]},
  { ver:'v2.24.0', date:'2026-07-03', title:{en:'Modular source + build pipeline + true offline',pt:'Fonte modular + pipeline de build + offline de verdade'}, items:[
    {t:'chg', en:'The published app remains one standalone HTML file, and the build now verifies that it contains no runtime network dependency.', pt:'O app publicado continua sendo um único HTML autônomo, e o build passou a verificar que ele não contém dependência de rede em runtime.'},
    {t:'add', en:'Truly offline fonts: the three UI typefaces (IBM Plex Mono, IBM Plex Sans, Bebas Neue) are now embedded directly in the file instead of being fetched from Google Fonts. Open the HTML with no connection at all and it looks exactly the same — including the monospace terminal. The build now hard-fails if any network dependency slips back in.', pt:'Fontes realmente offline: as três tipografias da UI (IBM Plex Mono, IBM Plex Sans, Bebas Neue) agora vêm embutidas no arquivo em vez de buscadas no Google Fonts. Abra o HTML sem nenhuma conexão e ele fica idêntico — inclusive o terminal monoespaçado. O build agora falha duro se qualquer dependência de rede voltar a entrar.'},
    {t:'chg', en:'All inline onclick handlers were migrated to addEventListener (wired once on load, with delegation for the dynamic forensic accordion). Behaviour is identical; the markup is now clean and ready for the modular source scopes.', pt:'Todos os handlers onclick inline foram migrados para addEventListener (conectados uma vez no load, com delegação para o accordion forense dinâmico). O comportamento é idêntico; a marcação ficou limpa e pronta para os escopos do fonte modular.'},
    {t:'chg', en:'No change to runtime behaviour, UI, capacity or detection: you still download one HTML file and run it with no server. HILL and STC are now separate modules, making future work on adaptive costs and syndrome-trellis coding safer to edit in isolation.', pt:'Sem mudança em comportamento de runtime, UI, capacidade ou detecção: você continua baixando um único HTML e rodando sem servidor. HILL e STC agora são módulos separados, tornando o trabalho futuro em custos adaptativos e codificação syndrome-trellis mais seguro de editar isoladamente.'},
  ]},
  { ver:'v2.23.1', date:'2026-07-02', title:{en:'Documentation fixes + i18n cleanup',pt:'Correções de documentação + limpeza de i18n'}, items:[
    {t:'fix', en:'Corrected the outdated "only lossless formats work for encoding" claim in the How-it-works modal and the info ticker: since the universal-carrier change (v2.18.2), any browser-decodable image (JPEG included) is accepted as a carrier and always saved as a fresh lossless PNG — lossless matters for the output, not the input.', pt:'Corrigida a afirmação desatualizada de que "só formatos sem perda servem para codificar" no modal Como funciona e no ticker: desde o aceite universal de portadora (v2.18.2), qualquer imagem que o navegador decodifica (inclusive JPEG) é aceita como portadora e sempre salva como um PNG novo sem perda — o lossless importa na saída, não na entrada.'},
    {t:'chg', en:'Rewrote the "Protection & Stealth" help section to match how the tool actually works: instead of three selectable modes (adaptive / STC / stealth-header), it now explains the two embedding paths the tool auto-selects (default STC-over-HILL stealth vs. RGB capacity) and the automatic password layers (AES-256-GCM, bit-order scrambling and hidden header).', pt:'Reescrita a seção de ajuda "Proteção e furtividade" para refletir como a ferramenta realmente funciona: em vez de três modos selecionáveis (adaptativo / STC / header furtivo), agora explica os dois caminhos de embedding que ela escolhe sozinha (furtivo padrão STC-sobre-HILL vs. capacidade RGB) e as camadas automáticas da senha (AES-256-GCM, embaralhamento da ordem dos bits e header oculto).'},
    {t:'chg', en:'The Limitations section now clarifies the optional Pro mode (Aletheia server): trained neural models can target adaptive/neural methods like HILL and SteganoGAN, as a separate, optional, still-probabilistic layer — the in-browser core stays statistical and offline.', pt:'A seção Limitações agora esclarece o modo Pro opcional (servidor Aletheia): modelos neurais treinados podem mirar métodos adaptativos/neurais como HILL e SteganoGAN, como camada separada, opcional e ainda probabilística — o núcleo no navegador segue estatístico e offline.'},
    {t:'fix', en:'The optional-key ticker message no longer implies any LSB extractor can read an un-keyed message; it now frames the key as encryption plus bit-order scrambling.', pt:'A mensagem do ticker sobre a chave opcional não sugere mais que qualquer extrator LSB lê uma mensagem sem chave; agora enquadra a chave como cifragem e embaralhamento da ordem dos bits.'},
    {t:'fix', en:'Removed an orphan i18n key (termNotSupported) that was never referenced.', pt:'Removida uma chave i18n órfã (termNotSupported) que nunca era referenciada.'},
    {t:'chg', en:'Renamed the capacity toggle from "Prioritize capacity" to "High Capacity Mode" (label plus every UI reference: hints, auto-switch notice, quick guide and help).', pt:'Renomeado o toggle de capacidade de "Priorizar capacidade" para "Modo de Alta Capacidade" (rótulo e todas as referências na UI: dicas, aviso de auto-troca, guia rápido e ajuda).'},
  ]},
  { ver:'v2.23.0', date:'2026-06-30', title:{en:'Argon2id key derivation (stronger KDF)',pt:'Derivação de chave com Argon2id (KDF mais forte)'}, items:[
    {t:'chg', en:'Password-based AES-256 keys are now derived with <b>Argon2id</b> (RFC 9106, m=64MiB t=3 p=1) instead of PBKDF2 — far more resistant to GPU/ASIC brute-force. The Argon2 WASM is inlined as base64, so the tool stays single-file and fully offline (no CDN).', pt:'As chaves AES-256 derivadas de senha agora usam <b>Argon2id</b> (RFC 9106, m=64MiB t=3 p=1) no lugar do PBKDF2 — muito mais resistente a brute-force por GPU/ASIC. O WASM do Argon2 é embutido em base64, então a ferramenta segue arquivo único e 100% offline (sem CDN).'},
    {t:'fix', en:'Backward compatible via a KDF version byte in the crypto envelope: new images use Argon2id (0x02); images encrypted before v2.23 (PBKDF2, 0x01) still decode. Wrong-password detection (AES-GCM) is unchanged.', pt:'Retrocompatível por um byte de versão de KDF no envelope cripto: imagens novas usam Argon2id (0x02); imagens cifradas antes da v2.23 (PBKDF2, 0x01) continuam decodificando. A detecção de senha errada (AES-GCM) é a mesma.'},
  ]},
  { ver:'v2.22.0', date:'2026-06-29', title:{en:'Canonical HILL cost map (better stealth placement)',pt:'Mapa de custo HILL canônico (melhor posicionamento furtivo)'}, items:[
    {t:'chg', en:'The adaptive/STC cost map now uses the canonical HILL formula (Li et al. 2014): the high-pass residual is smoothed by a 3×3 low-pass before the reciprocal, then spread by a 15×15 low-pass after it. This clusters the low-cost positions into textured regions — the property that makes HILL resist structural and neural steganalysis — instead of the previous single 3×3 pass over 1/|R|. Implemented with an O(n) separable box blur.', pt:'O mapa de custo do adaptativo/STC passa a usar a fórmula HILL canônica (Li et al. 2014): o resíduo passa-alta é suavizado por um passa-baixa 3×3 antes do inverso, e espalhado por um passa-baixa 15×15 depois. Isso agrupa as posições de menor custo nas regiões texturizadas — a propriedade que faz o HILL resistir à steganálise estrutural e neural — em vez da única passada 3×3 sobre 1/|R| de antes. Implementado com box-blur separável O(n).'},
    {t:'fix', en:'Backward compatibility preserved via a format flag (FLAG_HILLV2): new adaptive images use the V2 map; adaptive images made before v2.22 (no flag) still decode with the original cost map. STC is unaffected (its decode is syndrome-based, cost-independent), so all STC images decode regardless.', pt:'Retrocompatibilidade preservada por flag de formato (FLAG_HILLV2): imagens adaptativas novas usam o mapa V2; imagens adaptativas feitas antes da v2.22 (sem a flag) ainda decodificam com o mapa de custo original. O STC não é afetado (decode por síndrome, independente de custo), então todas as imagens STC decodificam normalmente.'},
  ]},
  { ver:'v2.21.0', date:'2026-06-29', title:{en:'HEIC detection + clear warning',pt:'Detecção de HEIC + aviso claro'}, items:[
    {t:'add', en:'HEIC/HEIF (Apple) files are now detected by their ftyp signature and produce a clear message ("convert to PNG or JPEG") in both the encoder and decoder, instead of failing silently — the browser cannot decode HEIC (except Safari). AVIF is intentionally left out, since modern browsers decode it fine. A generic message also covers any other image that fails to decode.', pt:'Arquivos HEIC/HEIF (Apple) agora são detectados pela assinatura ftyp e geram uma mensagem clara ("converta para PNG ou JPEG") no encoder e no decoder, em vez de falhar em silêncio — o navegador não decodifica HEIC (exceto Safari). O AVIF é deixado de fora de propósito, já que navegadores modernos o decodificam normalmente. Uma mensagem genérica também cobre qualquer outra imagem que falhe ao decodificar.'},
  ]},
  { ver:'v2.20.0', date:'2026-06-28', title:{en:'In-tool changelog restored',pt:'Changelog no app restaurado'}, items:[
    {t:'add', en:'The version history modal is back in the tool (gear → "Version history"), in the original format, listing every semver release (v2.10+) with pre-semver versions marked "Legacy" below a divider.', pt:'O modal de histórico de versões voltou ao app (engrenagem → "Histórico de versões"), no formato original, listando cada release semver (v2.10+) com as versões pré-semver marcadas como "Legacy" abaixo de um divisor.'},
  ]},
  { ver:'v2.19.2', date:'2026-06-28', title:{en:'C2PA false-positive calibration + UI tweaks',pt:'Calibração de falso-positivo C2PA + ajustes de UI'}, items:[
    {t:'chg', en:'<b>C2PA "downgrade & explain"</b>: when an image is C2PA-certified as AI-generated and there is no hard stego evidence (STEGO header, data after EOF, structural LSBR, RS≥25% or real hidden text), the signals that C2PA content itself produces — manifest/SVG strings, SynthID LSB anomaly, neural firing — no longer inflate the threat. A real message embedded in a C2PA image still flags (hard evidence overrides the suppression).', pt:'<b>C2PA "rebaixar e explicar"</b>: quando a imagem é certificada por C2PA como gerada por IA e não há evidência dura de stego (header STEGO, dado após EOF, LSBR estrutural, RS≥25% ou texto oculto real), os sinais que o próprio conteúdo C2PA gera — strings do manifesto/SVG, anomalia LSB do SynthID, disparo neural — deixam de inflar o threat. Uma mensagem real embutida numa imagem C2PA continua acusando (a evidência dura ignora a supressão).'},
    {t:'chg', en:'C2PA fields now read inline (LABEL: value); the encoder drop hint no longer lists formats.', pt:'Campos C2PA agora aparecem inline (RÓTULO: valor); a dica de drop do encoder não lista mais formatos.'},
  ]},
  { ver:'v2.19.0', date:'2026-06-28', title:{en:'Neural false-positive veto (flat/vector covers)',pt:'Veto de falso-positivo neural (covers chapados/vetoriais)'}, items:[
    {t:'chg', en:'The HILL neural detector fires ~0.99 on flat vector art even with no message (a cover-type artifact proven by clean baselines). Such signals are now marked inconclusive and stop inflating the threat; real detections on textured covers are preserved.', pt:'O detector neural HILL dispara ~0,99 em arte vetorial chapada mesmo sem mensagem (artefato de tipo de cover, provado por baseline limpo). Esses sinais agora são marcados como inconclusivos e param de inflar o threat; detecções reais em covers texturizados são preservadas.'},
  ]},
  { ver:'v2.18.2', date:'2026-06-28', title:{en:'Encoder accepts any image (converts to PNG) + state-bug fix',pt:'Encoder aceita qualquer imagem (converte p/ PNG) + conserto de bug'}, items:[
    {t:'chg', en:'The encoder now accepts any decodable image as carrier; non-lossless input is converted to a NEW PNG on output (the message lives in the converted pixels, so lossy input is safe).', pt:'O encoder agora aceita qualquer imagem decodificável como portadora; entrada não-lossless é convertida para um NOVO PNG na saída (a mensagem vive nos pixels convertidos, então entrada lossy é segura).'},
    {t:'fix', en:'Fixed a state bug where typing/clearing the password re-enabled the encode button on a previously blocked format.', pt:'Corrigido um bug de estado em que digitar/apagar a senha reabilitava o botão de codificar num formato antes bloqueado.'},
  ]},
  { ver:'v2.17.0', date:'2026-06-28', title:{en:'C2PA manifest parsing — highlighted fields + readable summary',pt:'Parsing do manifesto C2PA — campos destacados + resumo legível'}, items:[
    {t:'add', en:'When a C2PA manifest is present, the key fields are parsed and highlighted (Signer, Generator, Version), with a readable .txt summary alongside the raw .c2pa.', pt:'Quando há manifesto C2PA, os campos-chave são lidos e destacados (Signatário, Gerador, Versão), com um resumo .txt legível ao lado do .c2pa cru.'},
    {t:'fix', en:'digitalSourceType now reads correctly (trainedAlgorithmicMedia) via the IPTC URL anchor.', pt:'digitalSourceType agora é lido corretamente (trainedAlgorithmicMedia) ancorado na URL IPTC.'},
  ]},
  { ver:'v2.16.0', date:'2026-06-28', title:{en:'C2PA asset extraction (watermark SVG + manifest)',pt:'Extração de assets C2PA (watermark SVG + manifesto)'}, items:[
    {t:'add', en:'Carves the C2PA watermark SVG and JUMBF manifest from the file bytes, with a sanitized SVG preview and downloads for both.', pt:'Recorta o watermark SVG e o manifesto JUMBF do C2PA a partir dos bytes do arquivo, com preview SVG sanitizado e downloads dos dois.'},
  ]},
  { ver:'v2.15.0', date:'2026-06-27', title:{en:'STC (Syndrome-Trellis Codes) — cost-aware embedding',pt:'STC (Syndrome-Trellis Codes) — embedding consciente de custo'}, items:[
    {t:'add', en:'The message body is now embedded via STC: a Viterbi search picks the minimum-HILL-cost change set satisfying H·y=m; decode is by syndrome (cost-independent, robust). STC is the new default stealth mode.', pt:'O corpo da mensagem passa a ser embutido por STC: uma busca Viterbi escolhe o conjunto de alterações de menor custo HILL que satisfaz H·y=m; o decode é por síndrome (independente de custo, robusto). STC é o novo modo de furtividade padrão.'},
    {t:'chg', en:'~40% fewer pixels changed for the same message vs LSB-matching, concentrated in texture.', pt:'~40% menos pixels alterados para a mesma mensagem vs LSB-matching, concentrados em textura.'},
  ]},
  { ver:'v2.14.0', date:'2026-06-27', title:{en:'Pure-JS pixel I/O (anti-farbling)',pt:'I/O de pixels em JS puro (anti-farbling)'}, items:[
    {t:'fix', en:'Tool images failed online (https) but worked offline: canvas anti-fingerprinting (Brave Shields "farbling") injected ±1 noise into getImageData, flipping LSBs and breaking AES decryption. Pixels are now read/written via a pure-JS PNG codec, outside the 2D canvas — immune to farbling, ICC color management and alpha premultiplication.', pt:'Imagens da ferramenta falhavam online (https) mas funcionavam offline: a proteção anti-fingerprint do canvas (Brave Shields "farbling") injetava ruído de ±1 no getImageData, virando LSBs e quebrando a decifragem AES. Os pixels agora são lidos/escritos por um codec PNG em JS puro, fora do canvas 2D — imune a farbling, gerenciamento de cor ICC e premultiplicação de alfa.'},
  ]},
  { ver:'v2.13.1 – v2.13.9', date:'2026-06-23 → 2026-06-26', title:{en:'Encoder patch series: opaque-pixel embedding + detection calibration',pt:'Série de patches do Encoder: embedding em pixels opacos + calibração da detecção'}, items:[
    {t:'fix', en:'<b>Critical alpha bug</b>: the canvas zeroes the RGB of transparent pixels (alpha premultiplication), destroying a header written on a transparent pixel. Embedding now uses <b>only opaque pixels</b> (alpha==255); the alpha channel is never touched, so transparency and appearance are fully preserved.', pt:'<b>Bug crítico do alfa</b>: o canvas zera o RGB de pixels transparentes (premultiplicação de alfa), destruindo um header escrito em pixel transparente. O embedding passou a usar <b>apenas pixels opacos</b> (alpha==255); o alfa nunca é tocado, então transparência e aparência são 100% preservadas.'},
    {t:'chg', en:'Detection calibrated against clean baselines: WS gated on flat covers (RS-primary), even/odd bias suppressed on quantized palettes, vector-art veto in the AI panel. Clean cover 35→0 (false positive removed); small message + password 35→0 (matches clean = stealth proven).', pt:'Detecção calibrada com baseline limpo: WS bloqueado em cover chapado (RS-primária), viés par/ímpar suprimido em paleta quantizada, veto de arte vetorial no painel de IA. Cover limpo 35→0 (FP zerado); mensagem pequena + senha 35→0 (idêntica ao limpo = furtividade comprovada).'},
    {t:'add', en:'Reversible capacity auto-switch (a too-large message turns capacity on by itself + amber warning, reverts if shortened) and a poor-cover stealth hint.', pt:'Auto-switch de capacidade reversível (mensagem grande demais liga a capacidade sozinha + aviso âmbar, volta se encurtar) e dica de cover ruim para furtividade.'},
  ]},
  { ver:'v2.13.0', date:'2026-06-23', title:{en:'Encoder reorganized: stealth by default',pt:'Encoder reorganizado: furtividade por padrão'}, items:[
    {t:'chg', en:'From 4 controls to 1 optional ("Prioritize capacity", off by default). The encoder auto-selects the stealthiest mode that fits (Adaptive → Standard → RGB); the stealth header is automatic whenever a password is set. Fully backward compatible.', pt:'De 4 controles para 1 opcional ("Priorizar capacidade", desligado por padrão). O encoder escolhe sozinho o modo mais furtivo que couber (Adaptativo → Padrão → RGB); o header furtivo é automático sempre que há senha. Totalmente retrocompatível.'},
  ]},
  { ver:'v2.12.1', date:'2026-06-22', title:{en:'Stegomalware detection',pt:'Detecção de stegomalware'}, items:[
    {t:'add', en:'A module flags when the decoded hidden message looks like a script or executable (PowerShell/IEX, download-and-run, reverse shells, obfuscated JS, MZ/ELF headers). It runs only on successfully extracted content, with a dedicated alert banner and a contribution to the threat score.', pt:'Um módulo sinaliza quando a mensagem oculta decodificada tem cara de script ou executável (PowerShell/IEX, baixar-e-executar, reverse shells, JS ofuscado, cabeçalhos MZ/ELF). Roda só sobre conteúdo extraído com sucesso, com banner de alerta dedicado e contribuição ao threat score.'},
  ]},
  { ver:'v2.12.0', date:'2026-06-22', title:{en:'Automatic payload compression',pt:'Compressão automática do payload'}, items:[
    {t:'add', en:'The message body is compressed with deflate-raw before encryption (only when the result is actually smaller), increasing useful capacity. Flagged by FLAG_COMPRESSED; fully backward compatible.', pt:'O corpo da mensagem é comprimido com deflate-raw antes da cifragem (só usa o resultado se for menor de fato), aumentando a capacidade útil. Sinalizado por FLAG_COMPRESSED; totalmente retrocompatível.'},
  ]},
  { ver:'v2.11.8', date:'2026-06-22', title:{en:'Password strength meter',pt:'Medidor de força de senha'}, items:[
    {t:'add', en:'A real-time strength indicator (Weak / Medium / Strong / Excellent) below the encoder password field, using a light in-house entropy heuristic (no zxcvbn, keeping the single file).', pt:'Indicador de força em tempo real (Fraca / Média / Forte / Excelente) abaixo do campo de senha do encoder, com heurística de entropia própria e leve (sem zxcvbn, preservando o arquivo único).'},
  ]},
  { ver:'v2.11.7', date:'2026-06-21', title:{en:'C2PA detection hardening',pt:'Blindagem da detecção de C2PA'}, items:[
    {t:'fix', en:'parseC2PA still scanned the whole file (including pixels) in spots; the certificate date and software name are now read only with real C2PA evidence, and SVG-watermark detection requires a viewBox near the &lt;svg&gt; to avoid chance matches in pixel noise.', pt:'A parseC2PA ainda varria o arquivo inteiro (incluindo pixels) em alguns pontos; a data do certificado e o nome do software agora só são lidos com evidência C2PA real, e a detecção de SVG-watermark exige um viewBox perto do &lt;svg&gt; para evitar casamentos por acaso no ruído dos pixels.'},
  ]},
  { ver:'v2.11.6', date:'2026-06-21', title:{en:'Detectability (max-fill) warning',pt:'Aviso de detectabilidade (max-fill)'}, items:[
    {t:'add', en:'A warning when the message fills more than ~25% (caution) or >50% (high) of capacity, even if it fits — heavy embedding is the biggest tell for statistical/neural steganalysis.', pt:'Aviso quando a mensagem ocupa mais de ~25% (atenção) ou >50% (alto) da capacidade, mesmo cabendo — embedding pesado é o maior delator para a steganálise estatística/neural.'},
  ]},
  { ver:'v2.11.5', date:'2026-06-21', title:{en:'C2PA false-positive fix',pt:'Correção de falso positivo de C2PA'}, items:[
    {t:'fix', en:'parseC2PA "confirmed" an AI generator just by matching its name in the raw bytes (including pixels) — short tokens like "grok" appeared by chance in binary noise. The generator is now identified only with real C2PA evidence.', pt:'A parseC2PA "confirmava" um gerador de IA só por casar o nome nos bytes brutos (incluindo pixels) — tokens curtos como "grok" apareciam por acaso no ruído binário. O gerador agora só é identificado com evidência C2PA real.'},
  ]},
  { ver:'v2.11.4', date:'2026-06-21', title:{en:'Pro Mode authentication (frontend)',pt:'Autenticação do Modo Pro (frontend)'}, items:[
    {t:'add', en:'The frontend sends an X-API-Key header on every /analyze call; not a secret (client-side), but it blocks bots and scanners that do not send the key.', pt:'O frontend envia o header X-API-Key em toda chamada ao /analyze; não é segredo (client-side), mas barra bots e scanners que não enviam a chave.'},
  ]},
  { ver:'v2.11.3', date:'2026-06-20', title:{en:'SEO on the new domain + encoder guide reorder',pt:'SEO no domínio novo + reordenação do guia do Encoder'}, items:[
    {t:'fix', en:'URL tags (canonical, og:url, og:image, JSON-LD) pointed to the old domain; now stegostudio.com. Added robots.txt and sitemap.xml.', pt:'Tags de URL (canonical, og:url, og:image, JSON-LD) apontavam para o domínio antigo; agora stegostudio.com. Adicionados robots.txt e sitemap.xml.'},
    {t:'chg', en:'Encoder guide step order: load → choose embedding mode → message → key → generate.', pt:'Ordem dos passos do guia do Encoder: carregar → escolher modo de embedding → mensagem → chave → gerar.'},
  ]},
  { ver:'v2.11.2', date:'2026-06-20', title:{en:'Updated quick guides',pt:'Guias rápidos atualizados'}, items:[
    {t:'add', en:'Encoder/Decoder guides now cover the embedding modes and stealth mode; leftover "XOR" text replaced with AES-256.', pt:'Guias do Encoder/Decoder agora cobrem os modos de embedding e o modo furtivo; texto "XOR" remanescente trocado por AES-256.'},
  ]},
  { ver:'v2.11.1', date:'2026-06-20', title:{en:'UX & layout polish',pt:'Refino de UX e layout'}, items:[
    {t:'chg', en:'Smooth auto-scroll to the generated image on encode; uniform spacing between result blocks.', pt:'Scroll automático suave até a imagem gerada ao codificar; espaçamento uniforme entre os blocos do resultado.'},
  ]},
  { ver:'v2.11', date:'2026-06-20', title:{en:'Stealth mode (password-encrypted header)',pt:'Modo furtivo (header cifrado por senha)'}, items:[
    {t:'add', en:'Stealth mode encrypts the message header (MAGIC + mode + size) with a password-derived keystream — the "STEGO" signature other tools detect disappears. Without the password the header is indistinguishable from noise; the right password makes MAGIC reappear and self-validate. Requires a password.', pt:'O modo furtivo cifra o cabeçalho da mensagem (MAGIC + modo + tamanho) com um keystream derivado da senha — a assinatura "STEGO" que outras ferramentas detectam some. Sem a senha o header é indistinguível de ruído; com a senha certa o MAGIC reaparece e se auto-valida. Exige senha.'},
    {t:'chg', en:'Adaptive mode renamed from "(stealth)" to "(anti-detection)" to avoid ambiguity with the new stealth mode.', pt:'Modo adaptativo renomeado de "(furtivo)" para "(anti-detecção)" para evitar ambiguidade com o novo modo furtivo.'},
  ]},
  { ver:'v2.10', date:'2026-06-19/20', title:{en:'Adaptive embedding (HILL-cost anti-detection)',pt:'Embedding adaptativo (anti-detecção por custo HILL)'}, items:[
    {t:'add', en:'Adaptive mode hides the message in texture/noise regions using a HILL cost map, where changes are nearly invisible to structural analysis (RS/WS). The decoder recomputes the same cost map (over the top 7 bits) to find the exact positions. Combines with AES and password scrambling.', pt:'O modo adaptativo esconde a mensagem em regiões de textura/ruído usando um mapa de custo HILL, onde as alterações são quase invisíveis à análise estrutural (RS/WS). O decoder recalcula o mesmo mapa (sobre os 7 bits superiores) e acha as mesmas posições. Combina com AES e embaralhamento por senha.'},
    {t:'chg', en:'Changelog removed from the site (kept as a document) — restored in v2.20.0.', pt:'Changelog retirado do site (mantido como documento) — restaurado na v2.20.0.'},
  ]},
];
const CHANGELOG_LEGACY = [
  { ver:'v2.9.1', date:'2026-06-19', title:{en:'UI polish: encoder key clear, table border, adversarial highlight',pt:'Refino de UI: limpar senha no encoder, borda da tabela, destaque adversarial'}, items:[
    {t:'add', en:'<b>Clear button on the Encoder key</b>: an "x" clears the encoding key (shown only when text is present), matching the Decoder. The encoder key is kept across attempts (not auto-cleared on image change).', pt:'<b>Botão limpar na senha do Encoder</b>: um "x" limpa a chave de codificação (visível só quando há texto), igual ao Decoder. A chave do encoder é mantida entre tentativas (não é limpa ao trocar de imagem).'},
    {t:'fix', en:'<b>Indicators table top border</b>: now that the table is visually separated from the scores, its top edge is closed again (full border + rounded corners).', pt:'<b>Borda superior da tabela de indicadores</b>: agora que a tabela está separada dos scores, o topo dela volta a ser fechado (borda completa + cantos arredondados).'},
    {t:'chg', en:'Adversarial warning: the found string is now highlighted (its own boxed background, larger type), with the reason as a smaller label above.', pt:'Aviso adversarial: a string encontrada agora é destacada (fundo próprio em caixa, fonte maior), com o motivo como rótulo menor acima.'},
  ]},
  { ver:'v2.9.0', date:'2026-06-19', title:{en:'Header-independent message extraction (statistics authorize display)',pt:'Extração de mensagem sem header (estatística autoriza a exibição)'}, items:[
    {t:'add', en:'<b>Messages without a tool header are now displayed</b>: when LSB statistics (RS/WS/chi-square) confirm embedding, any coherent text recovered by deep scan is shown as a real message — even short, even with low printable ratio, even without a STEGO/JOI header. The proof that it is a message comes from the statistics, not from the text being long or fully readable.', pt:'<b>Mensagens sem header de ferramenta agora são exibidas</b>: quando a estatística dos LSBs (RS/WS/qui-quadrado) confirma embedding, qualquer texto coeso recuperado pelo deep scan é mostrado como mensagem real — mesmo curto, mesmo com printable baixo, mesmo sem header STEGO/JOI. A prova de que é mensagem vem da estatística, não de o texto ser longo ou totalmente legível.'},
    {t:'add', en:'<b>Resistant to fragmentation</b>: because statistical detection (not text length) authorizes display, splitting a message into tiny pieces does not evade detection — each embedded fragment lights up the LSB statistics. The recovered text may include some surrounding noise, which the user can easily tell apart from the real message.', pt:'<b>Resistente à fragmentação</b>: como é a detecção estatística (não o tamanho do texto) que autoriza a exibição, dividir a mensagem em pedaços minúsculos não escapa à detecção — cada fragmento embutido acende a estatística dos LSBs. O texto recuperado pode incluir algum ruído ao redor, que o usuário distingue facilmente da mensagem real.'},
  ]},
  { ver:'v2.8.2', date:'2026-06-19', title:{en:'C2PA notice fix (offline-independent, below threat)',pt:'Correção do aviso C2PA (independente do offline, sob o threat)'}, items:[
    {t:'fix', en:'<b>C2PA false-positive notice now works offline</b>: it was tied to the neural section and only showed in Pro mode. It is now independent of the neural models and appears below the threat score whenever C2PA is confirmed — since C2PA is detected in the offline analysis, the notice shows with or without the Pro backend.', pt:'<b>Aviso de falso-positivo C2PA agora funciona offline</b>: estava preso à seção neural e só aparecia no modo Pro. Agora é independente dos modelos neurais e aparece abaixo do threat score sempre que o C2PA é confirmado — como o C2PA é detectado na análise offline, o aviso aparece com ou sem o backend Pro.'},
  ]},
  { ver:'v2.8.1', date:'2026-06-19', title:{en:'UX fixes batch',pt:'Lote de correções de UX'}, items:[
    {t:'add', en:'<b>C2PA false-positive notice</b>: when an image is certified AI-generated (C2PA) and the neural models fire, a note now explains the scores may be false positives (models are trained on real photos).', pt:'<b>Aviso de falso-positivo C2PA</b>: quando uma imagem é certificada como gerada por IA (C2PA) e os modelos neurais disparam, uma nota agora explica que os scores podem ser falsos positivos (os modelos são treinados em fotos reais).'},
    {t:'add', en:'<b>Decoder password: clear button</b>: an "x" clears the key (shown only when text is present), and the field is auto-cleared when a new image is loaded so a previous key cannot affect the next analysis.', pt:'<b>Senha do Decoder: botão limpar</b>: um "x" limpa a chave (visível só quando há texto), e o campo é limpo automaticamente ao carregar uma nova imagem para que uma chave anterior não afete a próxima análise.'},
    {t:'fix', en:'Clear/Clear Analysis dialog buttons (Confirm/Cancel) are now translated to English.', pt:'Os botões dos diálogos Limpar/Limpar Análise (Confirmar/Cancelar) agora são traduzidos para o inglês.'},
    {t:'fix', en:'Protocol accordion: "Recovered text" now matches the consolidated verdict instead of contradicting the decode status (shows "detected, not extractable" when the body was discarded as noise).', pt:'Accordion Protocolo: "Texto recuperado" agora condiz com o veredito consolidado em vez de contradizer o status de decode (mostra "detectado, não extraível" quando o corpo foi descartado como ruído).'},
  ]},
  { ver:'v2.8.0', date:'2026-06-19', title:{en:'Password-based position scrambling',pt:'Embaralhamento de posições por senha'}, items:[
    {t:'add', en:'<b>Position scrambling (PRNG)</b>: with a password, the order in which message bits are embedded is shuffled using a password-seeded PRNG (Fisher-Yates). Even someone who knows it is LSBM and extracts the bits in physical order gets a scrambled sequence — without the password there is no way to reassemble it.', pt:'<b>Embaralhamento de posições (PRNG)</b>: com senha, a ordem em que os bits da mensagem são embutidos é embaralhada por um PRNG semeado pela senha (Fisher-Yates). Mesmo quem sabe que é LSBM e extrai os bits na ordem física obtém uma sequência embaralhada — sem a senha não há como remontá-la.'},
    {t:'add', en:'<b>Defense in depth</b>: combined with AES-256-GCM, the password now protects on two layers — the content is encrypted AND its bit positions are scrambled. The header stays readable so the tool still detects that a (protected) message is present.', pt:'<b>Defesa em profundidade</b>: combinado com o AES-256-GCM, a senha agora protege em duas camadas — o conteúdo é cifrado E as posições dos bits são embaralhadas. O cabeçalho continua legível para a ferramenta ainda detectar que há uma mensagem (protegida) presente.'},
    {t:'chg', en:'Backward compatible: images without scrambling decode exactly as before.', pt:'Compatível com versões anteriores: imagens sem embaralhamento são decodificadas exatamente como antes.'},
  ]},
  { ver:'v2.7.0', date:'2026-06-18', title:{en:'AES-256-GCM encryption (replaces XOR)',pt:'Criptografia AES-256-GCM (substitui XOR)'}, items:[
    {t:'add', en:'<b>Real encryption</b>: the optional key now encrypts messages with AES-256-GCM (key derived via PBKDF2, 150k iterations) instead of the weak XOR cipher. Even if the bits are extracted, the content is unreadable without the password.', pt:'<b>Criptografia de verdade</b>: a chave opcional agora cifra mensagens com AES-256-GCM (chave derivada via PBKDF2, 150k iterações) em vez da cifra XOR fraca. Mesmo que os bits sejam extraídos, o conteúdo é ilegível sem a senha.'},
    {t:'add', en:'<b>Tamper detection</b>: GCM authenticates the data — a wrong password or any modification is detected and reported as an incorrect key.', pt:'<b>Detecção de adulteração</b>: o GCM autentica os dados — senha errada ou qualquer modificação é detectada e reportada como chave incorreta.'},
    {t:'chg', en:'Images encrypted with the old XOR cipher can still be decrypted (backward compatible).', pt:'Imagens cifradas com o XOR antigo ainda podem ser decifradas (compatível com versões anteriores).'},
  ]},
  { ver:'v2.6.0', date:'2026-06-18', title:{en:'Adversarial content detection',pt:'Detecção de conteúdo adversarial'}, items:[
    {t:'add', en:'<b>Adversarial content warning</b>: a new layer flags text embedded in the file that appears designed to manipulate analysts or AI systems — prompt-injection-style instructions and counter-forensic claims (e.g. "no hidden content"). It is additive and structural, not a fixed phrase list, so it catches variations and never suppresses what the tool already surfaces (C2PA data, URLs, etc. stay visible and unflagged).', pt:'<b>Aviso de conteúdo adversarial</b>: uma nova camada sinaliza texto embutido no arquivo que parece projetado para manipular analistas ou sistemas de IA — instruções em estilo prompt injection e afirmações contra-forenses (ex: "nenhum conteúdo oculto"). É aditiva e estrutural, não uma lista fixa de frases, então pega variações e nunca suprime o que a ferramenta já mostra (dados C2PA, URLs, etc. seguem visíveis e sem marcação).'},
    {t:'add', en:'Distinct security warning, separate from the steganography verdict — adversarial content manipulates the analyst; steganography hides data. The warning does not alter the threat score.', pt:'Aviso de segurança distinto, separado do veredito de esteganografia — conteúdo adversarial manipula o analista; esteganografia esconde dados. O aviso não altera o threat score.'},
  ]},
  { ver:'v2.5.10', date:'2026-06-18', title:{en:'Graded neural indication scale',pt:'Escala graduada de indício neural'}, items:[
    {t:'fix', en:'<b>Per-method interpretation now graded in 5 levels</b>: None (0%), Minimal (1-19%), Weak (20-40%), Moderate (41-84%), Strong (85-100%). Fixes wording that called a 20% probability "no sign" — only 0% is now "none".', pt:'<b>Interpretação por método agora graduada em 5 níveis</b>: Nenhum (0%), Mínimo (1-19%), Fraco (20-40%), Moderado (41-84%), Forte (85-100%). Corrige o texto que chamava 20% de "nenhum indício" — apenas 0% é "nenhum".'},
  ]},
  { ver:'v2.5.9', date:'2026-06-18', title:{en:'UI polish — exclusive accordions + clearer neural interpretation',pt:'Refino de UI — accordions exclusivos + interpretação neural mais clara'}, items:[
    {t:'chg', en:'<b>Exclusive accordions</b>: opening a forensic module or neural method now closes the others, so panels no longer pile up open.', pt:'<b>Accordions exclusivos</b>: abrir um módulo forense ou método neural agora fecha os outros, então os painéis não ficam mais todos abertos acumulados.'},
    {t:'fix', en:'<b>Accurate high-confidence interpretation</b>: the per-method explanation no longer claims structural attacks (RS/WS) can corroborate adaptive methods — for LSBM/HILL/etc. it now explains that structural attacks cannot detect them, so the neural model is the reliable detector.', pt:'<b>Interpretação de alta confiança precisa</b>: a explicação por método não afirma mais que ataques estruturais (RS/WS) podem corroborar métodos adaptativos — para LSBM/HILL/etc. agora explica que os ataques estruturais não os detectam, então o modelo neural é o detector confiável.'},
    {t:'chg', en:'Neural section footer now keeps the tap hint (left) and processing time (right) on the same line; the 0% interpretation wording was clarified.', pt:'O rodapé da seção neural agora mantém a dica de toque (esquerda) e o tempo de processamento (direita) na mesma linha; o texto da interpretação de 0% foi esclarecido.'},
  ]},
  { ver:'v2.5.8', date:'2026-06-18', title:{en:'Clickable neural bars (per-method interpretation)',pt:'Barras neurais clicáveis (interpretação por método)'}, items:[
    {t:'add', en:'<b>Clickable method bars</b>: each neural probability bar (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide) now expands on tap to explain what the method is and how to read its probability — turning raw numbers into investigative context.', pt:'<b>Barras de método clicáveis</b>: cada barra de probabilidade neural (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide) agora expande ao toque para explicar o que é o método e como ler sua probabilidade — transformando números crus em contexto investigativo.'},
  ]},
  { ver:'v2.5.7', date:'2026-06-18', title:{en:'UTF-8 island validation (fixes message detection)',pt:'Validação UTF-8 da ilha (corrige detecção de mensagem)'}, items:[
    {t:'fix', en:'<b>Well-formed UTF-8 validation</b>: the previous fix accepted any high byte, which made trailing binary garbage merge into the text island and caused some messages to stop being detected. The detector now validates proper UTF-8 sequences, so accented messages extract fully AND messages followed by binary noise are still detected.', pt:'<b>Validação de UTF-8 bem-formado</b>: a correção anterior aceitava qualquer byte alto, o que fazia o lixo binário da cauda se fundir à ilha de texto e fazia algumas mensagens deixarem de ser detectadas. O detector agora valida sequências UTF-8 corretas, então mensagens acentuadas extraem por completo E mensagens seguidas de ruído binário continuam sendo detectadas.'},
    {t:'fix', en:'<b>Trailing noise character trimmed</b>: a residual character from binary garlanding the message (e.g. "...DO.m") is now removed when it appears right after final punctuation.', pt:'<b>Caractere de ruído na cauda removido</b>: um caractere residual do lixo binário colado à mensagem (ex: "...DO.m") agora é removido quando aparece logo após pontuação final.'},
  ]},
  { ver:'v2.5.6', date:'2026-06-18', title:{en:'Message extraction fixes (accents + length byte)',pt:'Correções na extração de mensagem (acentos + byte de tamanho)'}, items:[
    {t:'fix', en:'<b>Accented messages no longer truncated</b>: the text-island detector broke on UTF-8 multibyte characters (á, é, ç, ã...), cutting messages mid-word. It now accepts UTF-8 continuation/lead bytes, so Portuguese/Spanish messages are extracted in full.', pt:'<b>Mensagens com acentos não são mais truncadas</b>: o detector de ilha de texto quebrava em caracteres multibyte UTF-8 (á, é, ç, ã...), cortando a mensagem no meio da palavra. Agora aceita bytes de continuação/início UTF-8, então mensagens em português/espanhol são extraídas por completo.'},
    {t:'fix', en:'<b>Stray length byte removed</b>: tool formats (JOI/STEGO) place a length byte right after the header that leaked as a phantom character at the start of the message (e.g. "QEsta..."). It is now stripped when a known tool header is present.', pt:'<b>Byte de tamanho residual removido</b>: formatos de ferramenta (JOI/STEGO) colocam um byte de tamanho logo após o header que vazava como caractere fantasma no início da mensagem (ex: "QEsta..."). Agora é removido quando há header de ferramenta conhecido.'},
    {t:'chg', en:'Captured message buffer raised from 120 to 1000 characters to avoid truncating longer messages.', pt:'Buffer de captura da mensagem aumentado de 120 para 1000 caracteres para evitar truncar mensagens mais longas.'},
  ]},
  { ver:'v2.5.5', date:'2026-06-18', title:{en:'Regression fixes — JOI headers + offline note',pt:'Correções de regressão — headers JOI + nota offline'}, items:[
    {t:'fix', en:'<b>Messages with third-party headers shown again</b>: LSB messages carrying a tool header (e.g. JOI_LSB1/2) were being suppressed as noise because only the native STEGO header was recognized. Any detected tool header now counts as a real message.', pt:'<b>Mensagens com headers de terceiros voltam a ser exibidas</b>: mensagens LSB com header de ferramenta (ex: JOI_LSB1/2) estavam sendo suprimidas como ruído porque só o header nativo STEGO era reconhecido. Qualquer header de ferramenta detectado agora conta como mensagem real.'},
    {t:'fix', en:'<b>Offline limitation note no longer shows when Pro is online</b>: a scope bug made the note appear even with the neural server connected.', pt:'<b>Nota de limitação offline não aparece mais com o Pro online</b>: um bug de escopo fazia a nota aparecer mesmo com o servidor neural conectado.'},
  ]},
  { ver:'v2.5.4', date:'2026-06-18', title:{en:'Offline limitation note',pt:'Nota de limitação do modo offline'}, items:[
    {t:'add', en:'<b>Offline limitation note</b>: when Pro mode is unavailable and there is partial suspicion, the tool now notes that offline analysis mainly catches LSB Replacement and structural anomalies, while LSB Matching and adaptive methods such as HILL may go unnoticed until the neural Pro mode is online. No scores are altered — this only communicates the offline detection limits.', pt:'<b>Nota de limitação do modo offline</b>: quando o modo Pro está indisponível e há suspeita parcial, a ferramenta agora informa que a análise offline detecta principalmente LSB Replacement e anomalias estruturais, enquanto LSB Matching e métodos adaptativos como HILL podem passar despercebidos até o modo Pro neural estar online. Nenhum score é alterado — apenas comunica os limites da detecção offline.'},
  ]},
  { ver:'v2.5.3', date:'2026-06-18', title:{en:'Verdict flow fixes + note placement',pt:'Correções no fluxo de veredito + posição da nota'}, items:[
    {t:'fix', en:'<b>Threat score now reflects neural detection</b>: the exported/displayed score was being computed before the neural phase finished, leaving real stego (e.g. a real photo with an external tool\'s message) underscored. The score is now recomputed after neural results arrive.', pt:'<b>Threat score agora reflete a detecção neural</b>: o score exibido/exportado era calculado antes da fase neural terminar, deixando stego real (ex: foto real com mensagem de outra ferramenta) subnotificado. O score agora é recalculado após os resultados neurais chegarem.'},
    {t:'fix', en:'<b>Noise no longer shown as a message offline</b>: verdict consolidation now runs even without the Pro server, so deep-scan noise is suppressed instead of being displayed as a hidden message.', pt:'<b>Ruído não é mais exibido como mensagem offline</b>: a consolidação do veredito agora roda mesmo sem o servidor Pro, então o ruído de deep scan é suprimido em vez de exibido como mensagem oculta.'},
    {t:'chg', en:'The "steganography can look synthetic" note moved from the threat score to the <b>origin section</b>, and is also shown inside the Origin Probability module.', pt:'A nota "esteganografia pode parecer sintética" foi movida do threat score para a <b>seção de origem</b>, e também é exibida dentro do módulo Probabilidade de Origem.'},
  ]},
  { ver:'v2.5.2', date:'2026-06-17', title:{en:'Neural calibration — fewer false positives',pt:'Calibração neural — menos falsos positivos'}, items:[
    {t:'fix', en:'<b>Neural false positives reduced</b>: AI/synthetic images were triggering the spatial models (LSBR/LSBM/HILL) at ~100% even with no hidden message. The neural signal is now distrusted on AI images and requires corroboration to raise the threat score.', pt:'<b>Falsos positivos neurais reduzidos</b>: imagens de IA/sintéticas disparavam os modelos espaciais (LSBR/LSBM/HILL) a ~100% mesmo sem mensagem oculta. O sinal neural agora é desconfiado em imagens de IA e exige corroboração para elevar o threat score.'},
    {t:'fix', en:'<b>OutGuess artifact filtered</b>: the OutGuess model was firing at 100% on plain JPEGs (compression artifact). An isolated OutGuess signal without structural corroboration is now ignored.', pt:'<b>Artefato do OutGuess filtrado</b>: o modelo OutGuess disparava a 100% em JPEGs comuns (artefato de compressão). Um sinal isolado de OutGuess sem corroboração estrutural agora é ignorado.'},
    {t:'chg', en:'Neural detection now contributes to the threat score only with structural corroboration (RS/WS, header, or readable text), with contained weights to avoid score inflation.', pt:'A detecção neural agora contribui para o threat score apenas com corroboração estrutural (RS/WS, header ou texto legível), com pesos contidos para evitar inflação do score.'},
  ]},
  { ver:'v2.5.1', date:'2026-06-17', title:{en:'Honest verdict consolidation + threat recalibration',pt:'Consolidação de veredito honesto + recalibração de ameaça'}, items:[
    {t:'fix', en:'<b>No more noise shown as a message</b>: when neural models detect steganography but sequential extraction only yields noise, the tool now says so honestly instead of displaying the noise as if it were the hidden message.', pt:'<b>Fim do ruído exibido como mensagem</b>: quando os modelos neurais detectam esteganografia mas a extração sequencial só produz ruído, a ferramenta agora diz isso honestamente em vez de mostrar o ruído como se fosse a mensagem oculta.'},
    {t:'chg', en:'<b>Threat score recalibrated</b>: signals that indicate synthetic/AI origin (low sensor noise, rare color clusters) no longer inflate the steganography threat score on their own — they only count when corroborated by real stego evidence.', pt:'<b>Threat score recalibrado</b>: sinais que indicam origem sintética/IA (ruído de sensor baixo, clusters de cor rara) não inflam mais sozinhos o score de ameaça de esteganografia — só contam quando corroborados por evidência real de stego.'},
    {t:'add', en:'<b>Neural detection now feeds the threat score</b> intelligently: high-confidence neural detection reinforces the score; partial confidence contributes moderately.', pt:'<b>Detecção neural agora alimenta o threat score</b> de forma inteligente: detecção neural de alta confiança reforça o score; confiança parcial contribui moderadamente.'},
    {t:'add', en:'<b>Interpretive note</b> when neural and structural (RS/WS) signals disagree — indicating a likely adaptive or LSB-matching method that requires the original key to extract.', pt:'<b>Nota interpretativa</b> quando os sinais neural e estrutural (RS/WS) discordam — indicando provável método adaptativo ou LSB matching que exige a chave original para extrair.'},
  ]},
  { ver:'v2.5', date:'2026-06-16', title:{en:'Neural analysis via Pro backend',pt:'Análise neural via backend Pro'}, items:[
    {t:'add', en:'<b>Neural analysis (Pro)</b>: when the server is available, images are analyzed by 6 EfficientNet B0 models trained on ALASKA2 (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide).', pt:'<b>Análise neural (Pro)</b>: quando o servidor está disponível, as imagens são analisadas por 6 modelos EfficientNet B0 treinados no ALASKA2 (LSBR, LSBM, HILL, SteganoGAN, OutGuess, StegHide).'},
    {t:'add', en:'New <b>neural results section</b> below the Threat Score, with a probability bar per method and a consolidated verdict.', pt:'Nova <b>seção de resultados neurais</b> abaixo do Threat Score, com uma barra de probabilidade por método e um veredito consolidado.'},
    {t:'add', en:'<b>Live terminal status</b>: announces Pro mode when the server is online and shows the methods being processed during analysis.', pt:'<b>Status ao vivo no terminal</b>: anuncia o modo Pro quando o servidor está online e mostra os métodos sendo processados durante a análise.'},
    {t:'chg', en:'Analysis stays 100% functional offline: the neural layer is additive and degrades gracefully if the server is unavailable.', pt:'A análise continua 100% funcional offline: a camada neural é aditiva e degrada graciosamente se o servidor estiver indisponível.'},
  ]},
  { ver:'v2.4', date:'2026-06-15', title:{en:'High-capacity RGB encoder + neural detection',pt:'Encoder RGB de alta capacidade + detecção neural'}, items:[
    {t:'add', en:'<b>High-capacity (RGB) mode</b> in the encoder: spreads the message across all 3 color channels, tripling capacity (~3 bits/pixel).', pt:'<b>Modo alta capacidade (RGB)</b> no encoder: espalha a mensagem pelos 3 canais de cor, triplicando a capacidade (~3 bits/pixel).'},
    {t:'add', en:'<b>Neural embedding heuristic</b> in the analyzer: flags the GAN-like signature of methods such as SteganoGAN. Shown honestly as a suspicion, not proof.', pt:'<b>Heurística de embedding neural</b> no analisador: sinaliza a assinatura tipo GAN de métodos como o SteganoGAN. Mostrada honestamente como suspeita, não prova.'},
    {t:'chg', en:'Encoder header now records the mode, so decoding stays automatic and old images still decode.', pt:'O header do encoder agora registra o modo, então a decodificação continua automática e imagens antigas ainda decodificam.'},
    {t:'add', en:'Help modal: notes on the RGB mode and on the neural heuristic.', pt:'Modal de ajuda: notas sobre o modo RGB e sobre a heurística neural.'},
  ]},
  { ver:'v2.3', date:'2026-06-15', title:{en:'LSB Matching encoder + structural attacks',pt:'Encoder LSB Matching + ataques estruturais'}, items:[
    {t:'chg', en:'Encoder switched from LSB Replacement to <b>LSB Matching (LSBM)</b>, far harder to detect statistically.', pt:'Encoder trocou LSB Replacement por <b>LSB Matching (LSBM)</b>, muito mais difícil de detectar estatisticamente.'},
    {t:'add', en:'<b>RS and WS structural attacks</b> that specifically detect LSB Replacement (OpenStego, OpenPuff) and estimate embedding rate.', pt:'<b>Ataques estruturais RS e WS</b> que detectam especificamente o LSB Replacement (OpenStego, OpenPuff) e estimam a taxa de embedding.'},
    {t:'fix', en:'Translation: "Signing CA" and chrominance detail fragments now localize correctly.', pt:'Tradução: "CA signatária" e fragmentos de detalhe de crominância agora localizam corretamente.'},
  ]},
  { ver:'v2.22', date:'2026-06-14', title:{en:'SEO + public release',pt:'SEO + versão pública'}, items:[
    {t:'add', en:'<b>robots.txt</b> and <b>sitemap.xml</b> with bilingual hreflang; Google Search Console verification.', pt:'<b>robots.txt</b> e <b>sitemap.xml</b> com hreflang bilíngue; verificação no Google Search Console.'},
    {t:'chg', en:'Decoder quick-guide reordered for a clearer flow.', pt:'Guia rápido do Decoder reordenado para um fluxo mais claro.'},
  ]},
  { ver:'v2.21', date:'2026-06-13', title:{en:'Full bilingual interface (EN/PT)',pt:'Interface bilíngue completa (EN/PT)'}, items:[
    {t:'add', en:'Complete <b>EN/PT internationalization</b> of the whole interface, with live language switching that re-renders results.', pt:'<b>Internacionalização EN/PT</b> completa de toda a interface, com troca de idioma ao vivo que re-renderiza os resultados.'},
    {t:'add', en:'Settings <b>gear dropdown</b> holding help and the language switch; help now reachable on mobile.', pt:'<b>Dropdown de engrenagem</b> com a ajuda e o seletor de idioma; ajuda agora acessível no mobile.'},
    {t:'chg', en:'AI-origin verdict and heuristic notes reorganized and translated.', pt:'Veredito de origem por IA e notas de heurística reorganizados e traduzidos.'},
    {t:'fix', en:'Fixed "Undefined" in Origin Probability scores; terminal and accordion glitches on language switch.', pt:'Corrigido "Undefined" nos scores de Probabilidade de Origem; falhas do terminal e do accordion ao trocar idioma.'},
  ]},
  { ver:'v2.20', date:'2026-06-12', title:{en:'Origin Probability classifier (4 categories)',pt:'Classificador de Probabilidade de Origem (4 categorias)'}, items:[
    {t:'add', en:'<b>4-category origin classifier</b>: Photo, Screenshot, Digital Art, AI — each with its own score and most-likely verdict.', pt:'<b>Classificador de origem em 4 categorias</b>: Foto, Screenshot, Arte Digital, IA — cada uma com seu score e veredito de origem mais provável.'},
    {t:'add', en:'<b>Social-media pipeline detector</b> (WhatsApp, Facebook, Instagram recompression) plus screenshot and digital-art detectors.', pt:'<b>Detector de pipeline de rede social</b> (recompressão de WhatsApp, Facebook, Instagram) e detectores de screenshot e arte digital.'},
    {t:'chg', en:'Calibrated thresholds against 21 real photos to cut false positives on photography.', pt:'Limiares calibrados contra 21 fotos reais para reduzir falsos positivos em fotografia.'},
  ]},
  { ver:'v2.18', date:'2026-06-11', title:{en:'Deep LSB text investigator',pt:'Investigador profundo de texto LSB'}, items:[
    {t:'add', en:'<b>Sliding-window investigator</b> that scans all LSB extraction modes for the longest readable text, working with any encoder.', pt:'<b>Investigador de janela deslizante</b> que varre todos os modos de extração LSB pela maior sequência de texto legível, funcionando com qualquer codificador.'},
  ]},
  { ver:'v2.15', date:'2026-06-11', title:{en:'C2PA module + expanded EXIF',pt:'Módulo C2PA + EXIF expandido'}, items:[
    {t:'add', en:'<b>C2PA / Content Credentials parser</b>: reads the manifest and identifies 15+ known AI generators and signing authorities.', pt:'<b>Parser C2PA / Content Credentials</b>: lê o manifesto e identifica 15+ geradores de IA conhecidos e autoridades certificadoras.'},
    {t:'add', en:'<b>Expanded EXIF</b>: AI software detection, real-camera identification, GPS and certificate data.', pt:'<b>EXIF expandido</b>: detecção de software de IA, identificação de câmera real, GPS e dados de certificado.'},
  ]},
  { ver:'v2.12', date:'2026-06-10', title:{en:'Chrominance, DCT and gradient analysis',pt:'Análise de crominância, DCT e gradientes'}, items:[
    {t:'add', en:'<b>Chrominance (YCbCr)</b>, <b>DCT block uniformity</b> and <b>gradient</b> modules to spot synthetic-image traits.', pt:'Módulos de <b>crominância (YCbCr)</b>, <b>uniformidade de blocos DCT</b> e <b>gradientes</b> para identificar traços de imagem sintética.'},
  ]},
  { ver:'v2.09', date:'2026-06-10', title:{en:'First synthetic-origin scoring',pt:'Primeira pontuação de origem sintética'}, items:[
    {t:'add', en:'<b>AI score (0–100)</b> from generator-typical dimensions, missing camera EXIF, absent sensor noise and uniform regional entropy.', pt:'<b>Score de IA (0–100)</b> a partir de dimensões típicas de geradores, ausência de EXIF de câmera, ausência de ruído de sensor e entropia regional uniforme.'},
  ]},
  { ver:'v2.0', date:'2026-06-09', title:{en:'Encoder added → renamed STEGO·STUDIO',pt:'Encoder adicionado → renomeado STEGO·STUDIO'}, items:[
    {t:'add', en:'<b>LSB encoder</b>: hides messages in the blue channel with an optional XOR cipher. The tool becomes read+write and is renamed <b>STEGO·STUDIO</b>.', pt:'<b>Encoder LSB</b>: esconde mensagens no canal azul com cifra XOR opcional. A ferramenta passa a ler+escrever e é renomeada <b>STEGO·STUDIO</b>.'},
    {t:'add', en:'Two-tab interface: Encoder and Analyzer·Decoder.', pt:'Interface em duas abas: Encoder e Analyzer·Decoder.'},
  ]},
  { ver:'v1.0', date:'2026-06-08', title:{en:'STEGO·SCAN — initial prototype',pt:'STEGO·SCAN — protótipo inicial'}, items:[
    {t:'add', en:'First forensic analyzer with 8 modules (metadata, hidden strings, LSB chi-square, OCR/QR, frequency, entropy, color anomalies) and an AI narrative report.', pt:'Primeiro analisador forense com 8 módulos (metadados, strings ocultas, chi-quadrado LSB, OCR/QR, frequência, entropia, anomalias de cor) e um relatório narrativo por IA.'},
    {t:'add', en:'Weighted Threat Score and the dark cyberpunk interface.', pt:'Threat Score ponderado e a interface dark cyberpunk.'},
  ]},
];

function renderChangelog() {
  const tagLabel = { add:t('clTagAdded'), chg:t('clTagChanged'), fix:t('clTagFixed') };
  const renderEntry = (entry, legacy) => {
    const items = entry.items.map(it =>
      `<li class="cl-li"><span class="cl-tag ${it.t}">${tagLabel[it.t]}</span><span>${LANG==='pt'?it.pt:it.en}</span></li>`
    ).join('');
    return `<div class="cl-entry">
      <div class="cl-head"><span class="cl-ver">${entry.ver}${legacy?' — Legacy':''}</span><span class="cl-date">${entry.date}</span>
      <span class="cl-title">${LANG==='pt'?entry.title.pt:entry.title.en}</span></div>
      <ul class="cl-list">${items}</ul>
    </div>`;
  };
  let html = CHANGELOG.map(e => renderEntry(e, false)).join('');
  html += `<div class="cl-entry" style="text-align:center;padding:18px 0 14px"><span style="font-family:var(--mono);font-size:0.62rem;color:var(--dim);letter-spacing:0.5px;line-height:1.6">— ${t('clLegacyDivider')} —</span></div>`;
  html += CHANGELOG_LEGACY.map(e => renderEntry(e, true)).join('');
  document.getElementById('changelog-content').innerHTML = html;
}
function showChangelogModal() {
  renderChangelog();
  document.getElementById('changelog-overlay').classList.add('visible');
}
function hideChangelogModal() {
  document.getElementById('changelog-overlay').classList.remove('visible');
}

function showAboutModal() {
  document.getElementById('about-overlay').classList.add('visible');
}
function hideAboutModal() {
  document.getElementById('about-overlay').classList.remove('visible');
}

// ── Menu de configurações (engrenagem) ──
function toggleSettingsMenu(e) {
  if (e) e.stopPropagation();
  const dd = document.getElementById('settings-dropdown');
  const gear = document.getElementById('settings-gear');
  const isOpen = dd.classList.toggle('open');
  gear.classList.toggle('open', isOpen);
}
function closeSettingsMenu() {
  const dd = document.getElementById('settings-dropdown');
  const gear = document.getElementById('settings-gear');
  if (dd) dd.classList.remove('open');
  if (gear) gear.classList.remove('open');
}


// ── QoL de teclado: ENTER aciona a ação primária do campo de senha ──
// Mantém exatamente o mesmo gate do botão: se ele estiver disabled/aria-disabled,
// ENTER não faz nada. `isComposing`/keyCode 229 evita disparar no meio de IME e
// `repeat` impede múltiplos cliques ao segurar a tecla. Campos de mensagem são
// textarea e NÃO entram aqui — ENTER continua criando nova linha normalmente.
function bindEnterToEnabledAction(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if (!input || !button) return;
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.repeat || e.isComposing || e.keyCode === 229) return;
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    button.click();
  });
}
bindEnterToEnabledAction('enc-key', 'btn-encode');
bindEnterToEnabledAction('enc-decoy-key', 'btn-encode');
bindEnterToEnabledAction('dec-key', 'btn-analyze');
// Fecha ao clicar fora do menu
document.addEventListener('click', (e) => {
  const menu = document.querySelector('.settings-menu');
  if (menu && !menu.contains(e.target)) closeSettingsMenu();
});

function showModal(icon, title, msg, warn, onConfirm) {
  document.getElementById('modal-icon').textContent = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-msg').textContent = msg;
  document.getElementById('modal-warn').textContent = warn;
  // Botões traduzidos (estavam fixos em PT no HTML)
  document.getElementById('modal-cancel').textContent = t('modalCancel');
  document.getElementById('modal-confirm').textContent = t('modalConfirm');
  document.getElementById('modal-overlay').classList.add('visible');
  modalCallback = onConfirm;
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('visible');
  modalCallback = null;
});

document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('visible');
  if (modalCallback) { modalCallback(); modalCallback = null; }
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('visible');
    modalCallback = null;
  }
});

// ── LIMPAR ENCODE ──
document.getElementById('btn-clear-enc').addEventListener('click', () => {
  const hasOutput = document.getElementById('enc-dl').classList.contains('visible');
  showModal(
    '🗑️',
    t('dlgClearEncoderTitle'),
    t('dlgClearEncoderBody'),
    hasOutput
      ? t('dlgClearEncoderWarn')
      : t('dlgClearEncoderSafe'),
    () => {
      encID = null; encW = 0; encH = 0; encOutURL = null; encFormatOk = false;
      document.getElementById('enc-prev').src = '';
      document.getElementById('enc-pw').style.display = 'none';
      document.getElementById('enc-hint').style.display = 'flex';
      document.getElementById('enc-msg').value = '';
      document.getElementById('enc-key').value = '';
      const mc=document.getElementById('enc-maxcap'); if(mc){ mc.checked=false; mc.disabled=false; }
      encMaxcapManual=false;
      const mn=document.getElementById('enc-mode-note'); if(mn) mn.style.display='none';
      const an=document.getElementById('enc-alpha-note'); if(an) an.style.display='none';
      const ct=document.getElementById('enc-cover-tip'); if(ct) ct.style.display='none';
      if (typeof resetCarrierPreflight === 'function') resetCarrierPreflight();
      document.getElementById('enc-file').value = '';
      resetEncOutputs();   // mesma limpeza usada ao clicar em codificar
      resetStatus('enc-status');
      document.getElementById('cap-used').textContent = '0';
      document.getElementById('cap-total').textContent = '—';
      document.getElementById('cap-fill').style.width = '0%';
      document.getElementById('enc-fill-warn').style.display = 'none';
      document.getElementById('enc-key-warn').style.display = 'none';
      document.getElementById('enc-pw-strength').style.display = 'none';
      document.getElementById('enc-key-hint').style.display = 'block';
      // reset dos campos da isca (negação plausível)
      const dt=document.getElementById('enc-decoy-toggle'); if(dt) dt.checked=false;
      const df=document.getElementById('enc-decoy-fields'); if(df) df.style.display='none';
      const dh=document.getElementById('enc-decoy-hint'); if(dh) dh.style.display='none';
      const dm=document.getElementById('enc-decoy-msg'); if(dm) dm.value='';
      const dk=document.getElementById('enc-decoy-key'); if(dk) dk.value='';
      const dw=document.getElementById('enc-decoy-samekey-warn'); if(dw) dw.style.display='none';
      const dnm=document.getElementById('enc-decoy-needmsg-warn'); if(dnm) dnm.style.display='none';
      const dnk=document.getElementById('enc-decoy-needkey-warn'); if(dnk) dnk.style.display='none';
      const ds=document.getElementById('enc-decoy-pw-strength'); if(ds) ds.style.display='none';
      const dkc=document.getElementById('enc-decoy-key-clear'); if(dkc) dkc.style.display='none';
      checkEncReady(false);
    }
  );
});

// ── NEGAÇÃO PLAUSÍVEL: toggle da segunda mensagem (isca) ──
(() => {
  const toggle = document.getElementById('enc-decoy-toggle');
  if (!toggle) return;
  const fields = document.getElementById('enc-decoy-fields');
  const hint = document.getElementById('enc-decoy-hint');
  const decoyKey = document.getElementById('enc-decoy-key');
  const decoyMsg = document.getElementById('enc-decoy-msg');
  const decoyKeyClear = document.getElementById('enc-decoy-key-clear');
  const sameWarn = document.getElementById('enc-decoy-samekey-warn');

  toggle.addEventListener('change', () => {
    const on = toggle.checked;
    if (fields) fields.style.display = on ? 'block' : 'none';
    if (hint) hint.style.display = on ? 'block' : 'none';
    if (typeof updateCap === 'function') updateCap(); // recalcula capacidade (soma/tira a isca)
    if (typeof checkEncReady === 'function') checkEncReady(); // re-avalia o gate do botão
  });

  // Aviso em tempo real se a senha da isca == senha real (precisam diferir).
  const checkSameKey = () => {
    const realKey = document.getElementById('enc-key')?.value || '';
    const dKey = decoyKey?.value || '';
    if (sameWarn) sameWarn.style.display = (dKey.length > 0 && dKey === realKey) ? 'block' : 'none';
    if (decoyKeyClear) decoyKeyClear.style.display = dKey.length > 0 ? 'block' : 'none';
  };
  if (decoyKey) decoyKey.addEventListener('input', () => {
    checkSameKey();
    if (typeof updateDecoyPwStrength === 'function') updateDecoyPwStrength();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
  document.getElementById('enc-key')?.addEventListener('input', () => {
    checkSameKey();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
  if (decoyKeyClear) decoyKeyClear.addEventListener('click', () => {
    if (decoyKey) decoyKey.value = '';
    checkSameKey();
    if (typeof updateDecoyPwStrength === 'function') updateDecoyPwStrength();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
  // A isca conta para a capacidade usada e afeta o gate do botão.
  if (decoyMsg) decoyMsg.addEventListener('input', () => {
    if (typeof updateCap === 'function') updateCap();
    if (typeof checkEncReady === 'function') checkEncReady();
  });
})();

// ── LIMPAR ANALYZER ──
document.getElementById('btn-clear-dec').addEventListener('click', () => {
  const hasResults = document.getElementById('results-area').classList.contains('visible');
  showModal(
    '🗑️',
    t('dlgClearAnalysisTitle'),
    t('dlgClearAnalysisBody'),
    hasResults
      ? t('dlgClearAnalysisWarn')
      : t('dlgClearAnalysisSafe'),
    () => {
      bumpAnalysisGeneration();   // limpar também invalida análise em voo
      decID = null; decFile = null; decFmt = null; lastReport = null; lastRenderArgs = null;
      if(typeof lastRecoveredFile!=='undefined') lastRecoveredFile=null;
      document.getElementById('dec-prev').src = '';
      document.getElementById('dec-pw').style.display = 'none';
      document.getElementById('dec-hint').style.display = 'flex';
      document.getElementById('dec-file').value = '';
      const dk = document.getElementById('dec-key');
      dk.value = ''; clearKeyFlash();
      resetStatus('dec-status');
      document.getElementById('results-area').classList.remove('visible');
      document.getElementById('export-wrap').classList.remove('visible');
      document.getElementById('dec-placeholder').style.display = 'block';
      document.getElementById('modules-wrap').textContent = '';
      document.getElementById('decoded-box').classList.remove('visible');
      document.getElementById('threat-num').textContent = '—';
      document.getElementById('threat-level').textContent = '—';
      document.getElementById('threat-flags').textContent = '';
      ['orig-foto','orig-screen','orig-art','orig-synth'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.textContent='—';
      });
      ['orig-foto-bar','orig-screen-bar','orig-art-bar','orig-synth-bar'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.style.height='0%';
      });
      document.querySelectorAll('.origin-cell.top').forEach(c=>c.classList.remove('top'));
      checkDecReady(false);
    }
  );
});
let tabSwitchGeneration = 0;
let mobileSwipeAbortForTabSwitch = null;
function switchTab(t, options) {
  options = options || {};
  // Navegação explícita vence imediatamente qualquer preview/settle de swipe.
  // O commit interno do próprio swipe passa fromSwipe para não cancelar a si mesmo.
  if (!options.fromSwipe && typeof mobileSwipeAbortForTabSwitch === 'function') {
    mobileSwipeAbortForTabSwitch();
  }
  tabSwitchGeneration++;
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(e => e.classList.remove('active'));
  document.querySelector('.tab.'+t).classList.add('active');
  document.getElementById('panel-'+t).classList.add('active');
  document.getElementById('paste-anchor').focus({preventScroll:true});

  // Trocar de aba é somente navegação: o terminal mantém exatamente o estado
  // que já tinha. Reiniciar a digitação aqui causava re-renderizações repetidas do terminal e
  // trabalho desnecessário justamente durante swipes repetidos no celular.
}


// ── Swipe móvel interativo entre as duas áreas principais ──────────────────
// No mobile, o painel acompanha o dedo. A troca só vira estado real quando o
// gesto é concluído; se o usuário recuar ou soltar cedo, ambos os painéis
// retornam às posições de origem. O scroll vertical continua nativo até a
// intenção horizontal ficar clara; só então o touchmove é bloqueado para que
// o painel permaneça fisicamente preso ao dedo.
const MOBILE_TAB_SWIPE = Object.freeze({
  maxWidth: 700,
  edge: 32,
  lockX: 8,
  dominance: 1.20,
  verticalCancel: 12,
  minCommitX: 85,
  commitRatio: 0.28,
  maxCommitX: 180,
  flickMinX: 55,
  flickVelocity: 0.45, // px/ms — gesto curto e rápido, estilo feed/galeria
  settleMs: 210,
  clickSuppressX: 14,
});

function mobileSwipeBlockedTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  // O gesto deve poder nascer sobre quase todo o painel. Bloqueamos somente
  // superfícies cujo próprio gesto horizontal precisa vencer (slider/edição ativa)
  // ou um controle nativo que abre UI do sistema. Tap sem arrasto continua normal.
  if (target.closest('input[type="range"], select, option, [contenteditable]:not([contenteditable="false"])')) return true;
  const editable = target.closest('input:not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
  return !!(editable && document.activeElement === editable);
}

function mobileSwipeDirection(tab) {
  if (tab === 'enc') return -1;
  if (tab === 'dec') return 1;
  return 0;
}

function evaluateMobileSwipeMotion(startX, startY, x, y, startTab, viewportWidth, locked, cancelled) {
  if (cancelled || !Number.isFinite(viewportWidth) || viewportWidth <= 0 || viewportWidth > MOBILE_TAB_SWIPE.maxWidth) {
    return {state:'cancelled', offsetX:0};
  }
  if (startX <= MOBILE_TAB_SWIPE.edge || startX >= viewportWidth - MOBILE_TAB_SWIPE.edge) {
    return {state:'cancelled', offsetX:0};
  }
  const direction = mobileSwipeDirection(startTab);
  if (!direction) return {state:'cancelled', offsetX:0};

  const dx = x - startX;
  const dy = y - startY;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (!locked) {
    if (ay >= MOBILE_TAB_SWIPE.verticalCancel && ay > ax) return {state:'cancelled', offsetX:0};
    if (ax < MOBILE_TAB_SWIPE.lockX || ax < ay * MOBILE_TAB_SWIPE.dominance) return {state:'pending', offsetX:0};
    // Não há wrap: mover inicialmente para o lado sem aba vizinha não bloqueia
    // o scroll nem o gesto; o usuário ainda pode voltar e cruzar a origem.
    if (Math.sign(dx) !== direction) return {state:'pending', offsetX:0};
  }

  let offsetX = dx;
  if (direction < 0) offsetX = Math.min(0, dx);
  else offsetX = Math.max(0, dx);
  offsetX = Math.max(-viewportWidth, Math.min(viewportWidth, offsetX));
  return {state:'locked', offsetX};
}

function shouldCommitMobileSwipe(offsetX, panelWidth, elapsedMs=Infinity) {
  if (!Number.isFinite(panelWidth) || panelWidth <= 0) return false;
  const distance = Math.abs(offsetX);
  const threshold = Math.min(
    MOBILE_TAB_SWIPE.maxCommitX,
    Math.max(MOBILE_TAB_SWIPE.minCommitX, panelWidth * MOBILE_TAB_SWIPE.commitRatio)
  );
  if (distance >= threshold) return true;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return false;
  return distance >= MOBILE_TAB_SWIPE.flickMinX &&
         (distance / elapsedMs) >= MOBILE_TAB_SWIPE.flickVelocity;
}

function bindMobileTabSwipe() {
  const panels = Array.from(document.querySelectorAll('.panel'));
  if (panels.length < 2) return;
  let gesture = null;
  let settling = false;
  let settlingGesture = null;
  let settleTimer = null;

  function activeTabName() {
    const active = document.querySelector('.tab.active');
    if (!active) return null;
    if (active.classList.contains('enc')) return 'enc';
    if (active.classList.contains('dec')) return 'dec';
    return null;
  }

  function panelFor(tab) { return document.getElementById('panel-'+tab); }
  function otherTab(tab) { return tab === 'enc' ? 'dec' : 'enc'; }
  function viewportWidth() {
    return (window.visualViewport && window.visualViewport.width) ||
           document.documentElement.clientWidth || window.innerWidth || 0;
  }
  function raf(fn) { return typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(fn) : fn(); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function clearPreviewPanel(panel) {
    if (!panel) return;
    panel.classList.remove('swipe-preview','swipe-animating');
    panel.style.transform = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.zIndex = '';
    panel.style.pointerEvents = '';
    panel.style.transitionDuration = '';
    if (panel.dataset.swipeAriaHidden === 'absent') panel.removeAttribute('aria-hidden');
    else if (panel.dataset.swipeAriaHidden != null) panel.setAttribute('aria-hidden', panel.dataset.swipeAriaHidden);
    delete panel.dataset.swipeAriaHidden;
  }

  function clearCurrentPanel(panel) {
    if (!panel) return;
    panel.classList.remove('swipe-current','swipe-animating');
    panel.style.transform = '';
    panel.style.willChange = '';
    panel.style.transitionDuration = '';
  }

  function cleanupPanels(g) {
    if (!g) return;
    clearCurrentPanel(g.currentPanel);
    clearPreviewPanel(g.nextPanel);
  }

  function preparePanels(g) {
    if (g.prepared) return true;
    const current = panelFor(g.tab);
    const next = panelFor(g.nextTab);
    if (!current || !next) return false;
    const rect = current.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    g.currentPanel = current;
    g.nextPanel = next;
    g.panelWidth = rect.width;
    g.prepared = true;

    current.classList.add('swipe-current');
    current.style.willChange = 'transform';

    next.dataset.swipeAriaHidden = next.hasAttribute('aria-hidden') ? (next.getAttribute('aria-hidden') || '') : 'absent';
    next.setAttribute('aria-hidden','true');
    next.classList.add('swipe-preview');
    next.style.top = rect.top+'px';
    next.style.left = rect.left+'px';
    next.style.width = rect.width+'px';
    next.style.height = rect.height+'px';
    next.style.zIndex = '20';
    next.style.pointerEvents = 'none';

    const offscreen = -g.direction * g.panelWidth;
    current.style.transform = 'translate3d(0,0,0)';
    next.style.transform = `translate3d(${offscreen}px,0,0)`;
    return true;
  }

  function renderOffset(g, offsetX) {
    if (!g || !g.prepared) return;
    const clamped = g.direction < 0 ? Math.min(0, offsetX) : Math.max(0, offsetX);
    g.offsetX = Math.max(-g.panelWidth, Math.min(g.panelWidth, clamped));
    const nextX = g.offsetX - g.direction * g.panelWidth;
    g.currentPanel.style.transform = `translate3d(${g.offsetX}px,0,0)`;
    g.nextPanel.style.transform = `translate3d(${nextX}px,0,0)`;
  }

  function finishSettle(g, commit) {
    if (settlingGesture !== g) return;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    try {
      if (commit && tabSwitchGeneration === g.tabGeneration &&
          activeTabName() === g.tab && viewportWidth() === g.viewportWidth) {
        switchTab(g.nextTab, {fromSwipe:true});
      }
    } finally {
      cleanupPanels(g);
      settlingGesture = null;
      settling = false;
    }
  }

  function abortForExplicitTabSwitch() {
    const g = gesture || settlingGesture;
    gesture = null;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (g) cleanupPanels(g);
    settlingGesture = null;
    settling = false;
  }
  mobileSwipeAbortForTabSwitch = abortForExplicitTabSwitch;

  function settle(g, commit) {
    if (!g) return;
    if (!g.prepared) { gesture = null; return; }
    // Click suppression is armed once from touchend using the final horizontal
    // displacement. Keeping it there also covers wrong-direction drags and
    // avoids two independent guards for the same synthetic-click property.
    gesture = null;
    settling = true;
    settlingGesture = g;
    const duration = reducedMotion() ? 0 : MOBILE_TAB_SWIPE.settleMs;
    g.currentPanel.style.transitionDuration = duration+'ms';
    g.nextPanel.style.transitionDuration = duration+'ms';
    g.currentPanel.classList.add('swipe-animating');
    g.nextPanel.classList.add('swipe-animating');
    const targetCurrent = commit ? g.direction * g.panelWidth : 0;
    const targetNext = commit ? 0 : -g.direction * g.panelWidth;
    raf(() => {
      if (settlingGesture !== g) return;
      g.currentPanel.style.transform = `translate3d(${targetCurrent}px,0,0)`;
      g.nextPanel.style.transform = `translate3d(${targetNext}px,0,0)`;
      if (duration === 0) finishSettle(g, commit);
      else settleTimer = setTimeout(() => finishSettle(g, commit), duration + 40);
    });
  }

  function cancelGesture(animate=true) {
    const g = gesture;
    gesture = null;
    if (!g) return;
    if (g.prepared && animate) settle(g, false);
    else cleanupPanels(g);
  }

  function begin(e) {
    if (settling || !e.touches || e.touches.length !== 1 || mobileSwipeBlockedTarget(e.target)) { gesture = null; return; }
    const p = e.touches[0];
    const width = viewportWidth();
    const tab = activeTabName();
    if (!tab || width <= 0 || width > MOBILE_TAB_SWIPE.maxWidth ||
        p.clientX <= MOBILE_TAB_SWIPE.edge || p.clientX >= width - MOBILE_TAB_SWIPE.edge) {
      gesture = null;
      return;
    }
    gesture = {
      x:p.clientX, y:p.clientY, lastX:p.clientX, lastY:p.clientY,
      startTime:Number.isFinite(e.timeStamp) ? e.timeStamp : NaN,
      touchId:p.identifier, tab, nextTab:otherTab(tab), direction:mobileSwipeDirection(tab),
      viewportWidth:width, tabGeneration:tabSwitchGeneration,
      locked:false, cancelled:false, prepared:false, offsetX:0
    };
  }

  function move(e) {
    if (!gesture) return;
    if (!e.touches || e.touches.length !== 1) { cancelGesture(true); return; }
    const g = gesture;
    if (tabSwitchGeneration !== g.tabGeneration || activeTabName() !== g.tab || viewportWidth() !== g.viewportWidth) {
      cancelGesture(true); return;
    }
    const p = e.touches[0];
    if (p.identifier !== g.touchId) { cancelGesture(true); return; }
    g.lastX = p.clientX; g.lastY = p.clientY;
    const state = evaluateMobileSwipeMotion(g.x,g.y,p.clientX,p.clientY,g.tab,g.viewportWidth,g.locked,g.cancelled);
    if (state.state === 'cancelled') { g.cancelled = true; cancelGesture(true); return; }
    if (state.state !== 'locked') {
      // Movimento horizontal inequívoco para o lado sem aba vizinha não troca
      // painel, mas também não deve virar click sintético no controle de origem.
      // Cancelamos somente essa sequência horizontal; vertical continua nativo.
      const dx = p.clientX - g.x, dy = p.clientY - g.y;
      if (Math.abs(dx) >= MOBILE_TAB_SWIPE.lockX &&
          Math.abs(dx) >= Math.abs(dy) * MOBILE_TAB_SWIPE.dominance && e.cancelable) {
        e.preventDefault();
      }
      return;
    }
    if (!g.locked) {
      // Se o navegador já tornou o evento não-cancelável, ele assumiu a
      // sequência (normalmente scroll). Nesse caso não iniciamos um arrasto
      // visual tardio que poderia disputar a rolagem nativa.
      if (!e.cancelable) { cancelGesture(false); return; }
      g.locked = true;
      if (!preparePanels(g)) { cancelGesture(false); return; }
    }
    // Só depois da intenção horizontal estar inequívoca. Até aqui o scroll
    // vertical permaneceu 100% sob controle nativo do navegador.
    if (e.cancelable) e.preventDefault();
    renderOffset(g, state.offsetX);
  }

  function end(e) {
    if (!gesture) return;
    const g = gesture;
    if (tabSwitchGeneration !== g.tabGeneration || activeTabName() !== g.tab || viewportWidth() !== g.viewportWidth) {
      cancelGesture(true); return;
    }
    if (!e.changedTouches || e.changedTouches.length !== 1) { cancelGesture(true); return; }
    const p = e.changedTouches[0];
    if (p.identifier !== g.touchId) { cancelGesture(true); return; }
    g.lastX = p.clientX; g.lastY = p.clientY;
    // Sem janela temporal: o próprio gesto horizontal cancela somente o click
    // sintético desta sequência. Um tap seguinte fica disponível imediatamente.
    const endDx = p.clientX - g.x, endDy = p.clientY - g.y;
    if (Math.abs(endDx) >= MOBILE_TAB_SWIPE.clickSuppressX &&
        Math.abs(endDx) > Math.abs(endDy) && e.cancelable) {
      e.preventDefault();
    }

    // Sempre usamos a coordenada final real. O último touchmove pode ter sido
    // entregue antes de o dedo completar (ou desfazer) alguns pixels do gesto.
    const state = evaluateMobileSwipeMotion(g.x,g.y,p.clientX,p.clientY,g.tab,g.viewportWidth,g.locked,g.cancelled);
    if (state.state !== 'locked') { cancelGesture(g.prepared); return; }
    if (!g.locked) {
      if (!preparePanels(g)) { cancelGesture(false); return; }
      g.locked = true;
    }
    renderOffset(g, state.offsetX);
    const elapsedMs = Number.isFinite(e.timeStamp) && Number.isFinite(g.startTime)
      ? Math.max(1, e.timeStamp - g.startTime) : Infinity;
    const commit = shouldCommitMobileSwipe(g.offsetX, g.panelWidth, elapsedMs);
    settle(g, commit);
  }

  function cancel() { cancelGesture(true); }
  function onResize() {
    if (gesture && viewportWidth() !== gesture.viewportWidth) cancelGesture(true);
  }

  panels.forEach(panel => {
    panel.addEventListener('touchstart', begin, {passive:true});
    panel.addEventListener('touchmove', move, {passive:false});
    panel.addEventListener('touchend', end, {passive:false});
    panel.addEventListener('touchcancel', cancel, {passive:true});
  });
  window.addEventListener('resize', onResize, {passive:true});
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', onResize, {passive:true});
  }
}

