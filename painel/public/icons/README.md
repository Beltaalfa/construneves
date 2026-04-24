# Ícones PWA (Painel Construneves)

**Fonte oficial (substituir o ficheiro e reexecutar o script):** `public/pwa-icon-fonte-800.png`  
(export quadrado, preferencialmente **800×800**; podes actualizar a partir de `construneves/Design sem nome.png` na raiz do projecto: `cp "../Design sem nome.png" public/pwa-icon-fonte-800.png`).

- Os PNGs PWA usam **centro geométrico** (`overlay=(W-w)/2:(H-h)/2`) e escala **420 px** no quadrado 512 (e 158 no 192) com margem para o propósito *maskable* do Android. Fundo **`#0a0a0a`**, alinhado ao `theme_color` do manifest.
- `apple-touch-icon`, `openGraph` / `twitter` e `src/app/icon.png` derivam do 512.

## Regenerar (a partir de `construneves/painel`)

```bash
cd /var/www/construneves/painel
SRC=public/pwa-icon-fonte-800.png

ffmpeg -y -f lavfi -i color=0x0a0a0a:s=512x512 -i "$SRC" \
  -filter_complex "[1:v]format=rgba,scale=420:420:force_original_aspect_ratio=decrease,pad=420:420:(ow-iw)/2:(oh-ih)/2:0x0a0a0a,setsar=1:1[fg];[0:v][fg]overlay=(W-w)/2:(H-h)/2:format=auto" \
  -frames:v 1 public/icons/icon-512.png

ffmpeg -y -f lavfi -i color=0x0a0a0a:s=192x192 -i "$SRC" \
  -filter_complex "[1:v]format=rgba,scale=158:158:force_original_aspect_ratio=decrease,pad=158:158:(ow-iw)/2:(oh-ih)/2:0x0a0a0a,setsar=1:1[fg];[0:v][fg]overlay=(W-w)/2:(H-h)/2:format=auto" \
  -frames:v 1 public/icons/icon-192.png

ffmpeg -y -i public/icons/icon-512.png -vf scale=180:180 public/apple-touch-icon.png
ffmpeg -y -i public/icons/icon-512.png -vf scale=32:32 src/app/icon.png
```

Se quiseres o logótipo **mais pequeno** dentro do quadrado (mais ar no *maskable*), baixa `420` / `158` (ex. `400` e `150`).
