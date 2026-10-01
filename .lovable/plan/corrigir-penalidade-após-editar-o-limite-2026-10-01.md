# Corrigir penalidade após editar o limite

- No Histórico e em Ocorrências, determinar qual registro atingiu a penalidade pelo limite atual da vigência e pelo total de “Não fez” do filho, independentemente da tarefa. Assim, aumentar o limite retira a indicação antiga quando ainda não foi atingido.
- Na edição da vigência, deixar a validação do limite com a mensagem em português do aplicativo, sem depender do aviso nativo do navegador em inglês.
- Verificar os estados após aumentar e tentar reduzir o limite, sem alterar os registros existentes.

## Detalhes técnicos

- Usar a ordem de cadastro dos registros (ID) para identificar o registro que cruza o limite atual; manter os dados registrados e recalcular apenas a apresentação.
- Remover restrições nativas de mínimo/máximo dos campos numéricos de vigência; preservar as validações já existentes em português antes de salvar.
