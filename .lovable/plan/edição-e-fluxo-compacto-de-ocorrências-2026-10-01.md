# Edição e fluxo compacto de ocorrências

## O que será alterado

- Adicionar ação de editar em cada filho, tarefa e vigência, reutilizando os formulários atuais e salvando as mudanças na lista.
- Adicionar edição de atribuição, permitindo trocar a vigência, o filho e as tarefas vinculadas.
- Trocar o seletor único de tarefa em Atribuições por uma lista de seleção múltipla com opção “Selecionar todas”.
- Evitar atribuições duplicadas e preservar os registros de ocorrências existentes ao editar vínculos.
- Compactar a aba Ocorrências: o botão “Não fez” ficará ao lado do nome da tarefa; o campo de data e hora sairá da lista.
- Ao clicar em “Não fez”, abrir um modal com data e hora limitadas ao período da vigência, além das ações de confirmar ou cancelar.

## Comportamento esperado

- A edição abre com os valores atuais e pode ser cancelada sem alterações.
- Atribuições com ocorrências não serão apagadas silenciosamente durante uma edição; somente vínculos sem histórico poderão ser removidos pela troca da seleção.
- “Selecionar todas” marca ou desmarca todas as tarefas disponíveis.
- As datas já registradas continuam visíveis junto à tarefa; apenas o campo para uma nova data passa para o modal.
- Depois de salvar, as listas são atualizadas imediatamente e os erros continuam integralmente em português.

## Detalhes técnicos

- Usar os controles e modais já existentes no projeto.
- Manter as regras atuais de isolamento por família e de limite de ocorrências por filho e vigência.
- Atualizar somente os registros envolvidos, sem mudança no banco de dados.
- Validar compilação e os principais fluxos em telas desktop e celular.
