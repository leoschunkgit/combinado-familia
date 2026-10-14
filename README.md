# Combinado Família

Aplicação para gestão de tarefas, vigências, atribuições, ocorrências, bônus, penalidades, acompanhamento familiar e administração do sistema.

## Ambientes

- DEV: Supabase `ewljvqwuxwhhxdxqezhn`
- PRD: Supabase `radwzkgpgdcwyjcpfcqw`
- Domínio público: `https://www.combinadofamilia.app.br`

## Desenvolvimento local

Requisitos: Node.js e npm.

```sh
git clone <este-repositorio>
cd combinado-familia
npm install
npm run dev
```

## Builds

- `npm run dev` -> DEV
- `npm run build` -> PRD
- `npm run build:app` -> app nativo PRD
- `npm run build:app:dev` -> app nativo DEV

A configuração de build usa Vite + TanStack Start diretamente, sem dependência da Lovable.
