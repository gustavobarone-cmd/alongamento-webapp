# Alongamentos (Web App)

Web app simples para montar **sessões de alongamento**:
- Usuário escolhe **Pré-treino** (dinâmico) ou **Pós-treino** (estático)
- Escolhe **tempo total**
- O app monta uma sequência aleatória que cabe no tempo
- Cada alongamento: **30s**
- Intervalo entre alongamentos: **5s**
- O app **fala o nome** do alongamento ao iniciar e mostra o **vídeo do YouTube**

## Arquivos
- `index.html`
- `styles.css`
- `app.js`
- `stretches_bank_v1.json` (banco de alongamentos)

## Como rodar localmente
> Importante: abrir o `index.html` direto (file://) pode bloquear o `fetch`. Rode um servidor simples.

### Opção A: Python
```bash
python -m http.server 5173
```
Abra: `http://localhost:5173`

### Opção B: Node (http-server)
```bash
npx http-server -p 5173
```

## Hospedar no GitHub Pages
1. Crie um repositório no GitHub
2. Faça upload desses arquivos na raiz
3. Vá em **Settings → Pages**
4. Em **Build and deployment**, escolha **Deploy from a branch**
5. Selecione `main` e `/ (root)`
6. Salve. O link do site vai aparecer ali.

## Vídeos no YouTube
No arquivo `stretches_bank_v1.json`, para cada alongamento, preencha:

```json
"video": { "provider": "youtube", "youtubeId": "SEU_ID_AQUI" }
```

Se não tiver `youtubeId`, o app mostra um botão para pesquisar no YouTube usando `searchQuery`.
