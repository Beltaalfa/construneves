# Guia de aparência e template — Hub Nortempresarial

Arquivo de referência **só para cópia** de aparência em outro projeto (Next.js + Tailwind). Não inclui lógica de negócio.

---

## 1. Stack visual

| Item | Versão / pacote |
|------|------------------|
| Framework | Next.js (App Router) |
| CSS | Tailwind CSS 4 (`@import "tailwindcss"` no `globals.css`) |
| Fontes | **Geist** e **Geist Mono** (`next/font/google`) |
| Ícones | `@tabler/icons-react` (stroke 2, tamanho 18–24 no layout) |
| Toasts | `sonner` (`richColors`, `position="top-right"`, `closeButton`) |

---

## 2. Modo e base

- `<html lang="pt-BR" className="dark">`
- `<body className="… antialiased bg-black text-zinc-100 min-h-screen">`
- **Viewport / PWA:** `themeColor: #0a0a0a`

### Variáveis CSS (`:root` + `@theme`)

```css
:root {
  --background: #000000;
  --foreground: #ededed;
  --muted: #a1a1aa;
  --border: #27272a;
  --accent: #3b82f6;
  --card: #0a0a0a;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

* { border-color: var(--border); }

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), system-ui, sans-serif;
}
```

### Scrollbar (WebKit)

- Largura/altura: `8px`
- Track: transparente
- Thumb: `#27272a`, hover `#3f3f46`, `border-radius: 4px`

### Fontes no `layout` raiz

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// <html className={`${geistSans.variable} ${geistMono.variable} dark`}> …
```

---

## 3. Paleta Tailwind (uso real no projeto)

- **Fundo principal:** `bg-black`
- **Texto principal:** `text-zinc-100`
- **Texto secundário / labels:** `text-zinc-300`, `text-zinc-400`, `text-zinc-500`
- **Bordas:** `border-zinc-700`, `border-zinc-800`
- **Superfícies / cards:** `bg-zinc-900`, `bg-zinc-900/30`, `bg-zinc-900/50`, `bg-zinc-800`, `bg-zinc-800/30`, `bg-zinc-800/50`
- **Hover em lista / linhas:** `hover:bg-zinc-800/30`, `hover:bg-zinc-800/50`
- **Acento (links, foco, botão primário):** `blue-500`, `blue-600` (`ring-blue-500/50`, `focus:ring-blue-500/50`)
- **Erro:** `text-red-400`, `bg-red-500/10`, `border-red-500/20`, `border-red-500/30`
- **Atenção / ação secundária “perigosa mas não delete”:** `text-amber-400` em botões secundários quando aplicável

---

## 4. Botão (`Button`)

Variantes (classes principais):

| Variante | Classes |
|----------|---------|
| **primary** | `bg-blue-600 hover:bg-blue-500 text-white border-transparent` |
| **secondary** | `bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700` |
| **ghost** | `bg-transparent hover:bg-zinc-800/50 text-zinc-300 border-transparent` |
| **danger** | `bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30` |

Base comum:

```
inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg
text-sm font-medium transition-colors border border-transparent
disabled:opacity-50 disabled:cursor-not-allowed
```

Loading: `animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full`

---

## 5. Campo de texto (`Input`)

- Label: `block text-sm font-medium text-zinc-300 mb-1`
- Input: `w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500`
- Erro no input: `border-red-500/50 focus:ring-red-500/50`
- Texto de erro: `mt-1 text-sm text-red-400`

---

## 6. Modal

- Overlay: `fixed inset-0 z-50 … bg-black/70 backdrop-blur-sm`
- Painel: `relative w-full … max-h-[calc(100vh-1.5rem)] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl`
- Max width: `sm: max-w-md`, `md: max-w-lg`, `lg: max-w-2xl`, `xl: max-w-4xl`
- Cabeçalho: `px-4 sm:px-6 py-4 border-b border-zinc-800`, título `text-lg font-semibold text-zinc-100`
- Botão fechar: `p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800`
- Corpo: `px-4 sm:px-6 py-4`

---

## 7. Login (padrão de card)

- Página: `min-h-screen flex items-center justify-center bg-black px-4`
- Card do formulário: `space-y-4 p-6 rounded-xl border border-zinc-800 bg-zinc-900/30`
- Título do card: `text-lg font-semibold text-zinc-100 mb-4`
- Alerta de erro: `p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm`
- Logo: tipicamente `/logo-north-branco.png` com altura ~`h-32 sm:h-40 w-auto object-contain`

---

## 8. Layout com sidebar

- Container: `min-h-screen flex`
- Sidebar: `fixed left-0 top-0 z-40 h-screen w-64 max-w-[85vw] flex flex-col border-r border-zinc-800 bg-black`
- Mobile: `translate-x` com overlay `fixed inset-0 z-30 bg-black/60 lg:hidden`
- Item de menu: `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors`
  - Ativo: `bg-zinc-800 text-white`
  - Inativo: `text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200`
- Ícone no item: wrapper `[&>svg]:size-5 [&>svg]:stroke-[2]`
- Área principal: `flex-1 min-h-screen flex flex-col lg:ml-64 w-full min-w-0`
- Header da área: `h-14 lg:h-16 shrink-0 flex items-center gap-3 px-4 lg:px-6`
- Conteúdo: `flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto`

---

## 9. Helpdesk (sub-layout sem sidebar full)

- Header: `h-14 shrink-0 border-b border-zinc-800 flex items-center justify-between px-3 sm:px-4 lg:px-8`
- Link “voltar”: `text-sm text-zinc-400 hover:text-zinc-200`
- Main: `flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto`

---

## 10. Tabelas (padrão comum)

- Wrapper: `overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30` ou `rounded-lg border border-zinc-800`
- `<thead>`: `border-b border-zinc-700/50` ou `border-zinc-800`, células cabeçalho `text-left font-medium text-zinc-400`
- Linhas: `border-b border-zinc-700/30`, hover em linhas clicáveis `hover:bg-zinc-800/30`
- Badges de status: `inline-flex rounded px-2 py-0.5 text-xs font-medium bg-zinc-700/50 text-zinc-300`

---

## 11. Formulários densos (ex.: helpdesk)

- Borda de seção / bloco: `rounded-lg border-2 border-zinc-600 bg-zinc-800/50 p-4 space-y-4`
- Labels de formulário: `text-sm font-medium text-zinc-400` ou `text-xs font-medium text-zinc-400`
- Textarea: `w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100`
- Select nativo ou campos equivalentes: mesma linha visual do `Input` (`bg-zinc-900/50`, `border-zinc-700`)

---

## 12. Toasts

```tsx
import { Toaster } from "sonner";

<Toaster richColors position="top-right" closeButton />
```

---

## 13. Ícones Tabler (convenção)

- Sidebar / header: `size={20}` ou `24`, `strokeWidth={2}`
- Dentro de botões pequenos: `size={14}`–`18`
- Modal fechar: `IconX size={20} strokeWidth={2}`

---

## 14. Arquivos de origem no repositório

| Recurso | Caminho |
|---------|---------|
| Tokens + scrollbar | `src/app/globals.css` |
| Layout raiz + fontes | `src/app/layout.tsx` |
| Botão | `src/components/ui/Button.tsx` |
| Input | `src/components/ui/Input.tsx` |
| Modal | `src/components/ui/Modal.tsx` |
| Tabela genérica | `src/components/ui/Table.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Layout página com sidebar | `src/components/layout/LayoutWithSidebar.tsx` |
| Login | `src/app/login/page.tsx` |

---

## 15. `package.json` (dependências visuais relevantes)

```json
{
  "@tabler/icons-react": "^3.x",
  "next": "16.x",
  "react": "19.x",
  "sonner": "^2.x",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4"
}
```

PostCSS típico do projeto: apenas `@tailwindcss/postcss` no pipeline (Tailwind v4).

---

*Documento gerado a partir do Hub em `/hub` — copie variáveis, classes e estruturas acima para alinhar outro projeto ao mesmo visual dark “tipo Vercel / zinc”. Não é necessário manter o nome “North” nem as logos ao reutilizar o template.*
