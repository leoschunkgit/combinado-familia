# Corrigir tela em branco em Atribuições

## Objetivo
Restaurar a tela de Atribuições eliminando o erro do carregamento compartilhado.

## Implementação
- Mover o estado e o hook de carregamento para um módulo compartilhado estável, evitando que o carregamento dividido das páginas crie contextos React diferentes.
- Manter um único provedor envolvendo todas as páginas autenticadas.
- Corrigir os caracteres literais inválidos atualmente presentes na definição do layout autenticado.
- Atualizar as páginas que usam o hook para importá-lo do módulo compartilhado.

## Validação
- Confirmar que o projeto compila sem erros.
- Abrir `/atribuicoes` com uma sessão autenticada e verificar que a página aparece sem erro no navegador.
