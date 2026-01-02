# Alongamento WebApp • v6 completo (GitHub Pages)

Este pacote junta as ideias do seu **v5** (banco com 146 alongamentos + vídeo) com as melhorias que você pediu:
- Contagem regressiva **só quando faltar 5s** (5→1)
- No fim fala: **“Alongamento concluído”**
- Inputs/Selects com **fundo branco e texto preto**
- Banco selecionável + personalizados + export/import + histórico + PWA

## Arquivos
- `index.html` (UI com abas)
- `styles.css`
- `app.js`
- `stretches_bank_v1.json` (banco original com 146 itens)
- `manifest.json`, `sw.js`, `assets/icon.svg` (PWA)
- `tools/fill_youtube_ids.py` e `youtube_links_template.csv` (opcional, do seu v5)

## Funções do app (resumo)
### Sessão
- Escolhe **Pré** ou **Pós**
- Escolhe tempo total, tempo por alongamento e intervalo
- Gera sequência aleatória que cabe no tempo
- Player com:
  - Iniciar / Pausar / Anterior / Próximo / Encerrar
  - Vídeo do YouTube (se tiver `youtubeId`), senão busca pelo `searchQuery`
  - Regressiva 5→1 apenas nos últimos 5 segundos
  - Beep (opcional) e voz (opcional)
  - Copiar sessão (texto)

### Banco
- Buscar e filtrar
- Selecionar/desmarcar itens que entram na geração
- Adicionar **personalizados** (inclusive marcar `Lados: Um lado (E/D)`)

### Histórico & Dados
- Histórico automático ao concluir sessão
- Exportar / Importar JSON
- Salvar sessão / Carregar sessão salva

## Alternância Esquerda/Direita (quando precisar)
No `stretches_bank_v1.json`, você pode adicionar em qualquer item:
```json
"sides": "LR"
```
Aí o app consegue alternar E/D ou fazer em pares (E depois D), dependendo de **Modo de lado** na aba Sessão.

## GitHub Pages
Suba tudo na raiz do repo e ative em **Settings → Pages** (branch main / root).
