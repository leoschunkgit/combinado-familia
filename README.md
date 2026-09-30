# Combinado

Preciso desenvolver um app com base nas telas e no diagrama de classes fornecidos nos anexos:

1. Cadastro de Usuário Pai (Nome, Email, CPF, Senha)
2. Cadastro de Filho (Nome, Email, Celular associado ao Pai)
3. Cadastro de Vigência (Data início, Data fim, Penalidade, Quantidade de ocorrências)
4. Cadastro de Tarefas (Nome)
5. Associação de Filho à Tarefa dentro de uma Vigência
6. Consulta e registro de ocorrências (filtro por vigência, filho e tarefa, com checkboxes de marcação de cumprimento e botão 'não fez')

Seguir a estrutura relacional do diagrama de classes (T_USUARIO_PAI, T_FILHO, T_VIGENCIA, T_TAREFA, T_FILHO_TAREFA) com uma interface moderna, intuitiva e responsiva.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/440cb1e7-2220-460c-bca9-5a47fdd241d1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
