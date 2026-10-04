# Validação final do app

Este checklist deve ser usado antes de publicar qualquer versão Android/iOS.

## 1. Web — validar antes de empacotar

### Autenticação
- [ ] Login com usuário existente
- [ ] Login redireciona para /inicio
- [ ] Cadastro de novo responsável
- [ ] Confirmação de email
- [ ] Recuperação de senha
- [ ] Redefinição de senha
- [ ] Logout

### Dados principais
- [ ] Cadastrar filho
- [ ] Editar filho
- [ ] Cadastrar tarefa
- [ ] Cadastrar vigência
- [ ] Editar vigência
- [ ] Finalizar vigência ativa
- [ ] Criar atribuição
- [ ] Editar atribuição permitida
- [ ] Bloqueios por vigência finalizada funcionando

### Ocorrências
- [ ] Marcar “Fez”
- [ ] Marcar “Não fez”
- [ ] Editar bonificação
- [ ] Trocar “Fez” por “Não fez”
- [ ] Trocar “Não fez” por “Fez”
- [ ] Desfazer registro
- [ ] Limites e penalidades respeitados
- [ ] Regras de mesada preservadas
- [ ] Datas dentro da vigência

### Painel público do filho
- [ ] Gerar link
- [ ] Copiar link
- [ ] Compartilhar link
- [ ] Abrir link
- [ ] Link antigo deixa de funcionar após regenerar
- [ ] Link desativado deixa de funcionar
- [ ] Painel é somente leitura
- [ ] Dados atualizam após mudança feita pelo responsável

### Relatório
- [ ] Filtros de vigência e filho
- [ ] “Fez” aparece corretamente
- [ ] “Não fez” aparece corretamente
- [ ] Penalidade/mesada corretas
- [ ] PDF web é gerado corretamente

## 2. Build do app

- [x] npm install (validado no GitHub Actions)
- [x] npm run build:app (validado no GitHub Actions)
- [x] Confirmar .output/public/index.html (validado no GitHub Actions)
- [x] Gerar Android: npm run app:add:android (validado no GitHub Actions)
- [ ] Gerar iOS: npm run app:add:ios (Mac)
- [x] npm run app:assets (validado no GitHub Actions)
- [x] npm run app:sync:android (validado no GitHub Actions)
- [ ] npm run app:sync:ios

## 3. Android — aparelho real

- [x] APK de debug compilado com sucesso via Gradle no GitHub Actions
- [x] AAB de debug compilado com sucesso via Gradle no GitHub Actions
- [x] AAB de release sem assinatura de produção gerado com sucesso no GitHub Actions
- [x] Pipeline de assinatura de release validado com chave temporária no GitHub Actions

### Inicialização
- [ ] Abre sem tela branca
- [ ] Nome e ícone corretos
- [ ] Splash correto
- [ ] Safe area correta
- [ ] Status bar legível

### Navegação
- [ ] Menu abre/fecha
- [ ] Botão/gesto Voltar volta uma tela
- [ ] Voltar fecha modal antes de sair
- [ ] App só encerra quando não há histórico

### Teclado e formulários
- [ ] Teclado não cobre campo ativo
- [ ] Email abre teclado adequado
- [ ] Número/valor abre teclado adequado
- [ ] Data/hora abre seletor corretamente
- [ ] Modais continuam utilizáveis com teclado aberto

### Recursos nativos
- [ ] Copiar link
- [ ] Compartilhar link
- [ ] Abrir link externo
- [ ] Gerar PDF
- [ ] Salvar/compartilhar PDF
- [ ] Voltar do segundo plano atualiza os dados

### App Links
- [ ] /acompanhar/:token abre o app
- [ ] /redefinir-senha abre o app
- [ ] Sem app instalado, link abre no navegador
- [ ] Link de host não autorizado é ignorado

### Segurança
- [x] Revisar AndroidManifest.xml (validado no GitHub Actions)
- [x] Sem câmera (validado no GitHub Actions)
- [x] Sem localização (validado no GitHub Actions)
- [x] Sem microfone (validado no GitHub Actions)
- [x] Sem contatos (validado no GitHub Actions)
- [x] Sem acesso desnecessário a fotos/arquivos (validado no GitHub Actions)
- [ ] Keystore fora do repositório

## 4. iPhone — aparelho real/TestFlight

### Inicialização
- [ ] Abre sem tela branca
- [ ] Nome e ícone corretos
- [ ] Splash correto
- [ ] Safe area correta em aparelhos com notch/Dynamic Island
- [ ] Status bar correta

### Navegação e teclado
- [ ] Navegação interna normal
- [ ] Gestos do iOS não quebram o app
- [ ] Teclado não cobre os campos
- [ ] Inputs e data/hora funcionam corretamente

### Recursos nativos
- [ ] Compartilhar link
- [ ] Copiar link
- [ ] Abrir link externo
- [ ] Gerar e compartilhar PDF

### Universal Links
- [ ] /acompanhar/:token abre o app
- [ ] /redefinir-senha abre o app
- [ ] Sem app instalado, abre no Safari

### Privacidade
- [ ] Privacy Manifest preenchido
- [ ] Associated Domains configurado
- [ ] Info.plist sem permissões desnecessárias
- [ ] TestFlight aprovado antes da publicação final

## 5. Publicação

### Google Play
- [x] App ID confirmado: app.combinadofamilia (validado no GitHub Actions)
- [ ] Criar keystore de produção no computador pessoal
- [ ] Guardar keystore e senhas fora do repositório/GitHub
- [ ] Fazer backup seguro do keystore
- [ ] Obter SHA-256 da chave de assinatura
- [ ] Finalizar assetlinks.json com o SHA-256 real
- [ ] Gerar AAB de release assinado
- [x] Versão e versionCode base validados no GitHub Actions
- [x] Rascunho de política de privacidade preparado
- [x] URL pública da Política de Privacidade criada e validada no build: https://www.combinadofamilia.app/politica-de-privacidade
- [ ] Política de privacidade final revisada (contato + exclusão de conta/dados)
- [x] Guia de Data Safety preparado
- [ ] Data Safety preenchido no Google Play Console
- [x] Checklist de screenshots preparado
- [ ] Screenshots finais produzidos e enviados
- [x] Descrição curta/completa e categoria preparadas
- [ ] Textos finais revisados e enviados ao Google Play
- [ ] Teste interno concluído
- [ ] Publicação no Google Play concluída

### App Store
- [ ] Bundle ID confirmado
- [ ] Team ID confirmado
- [ ] Certificados/assinatura corretos
- [ ] Privacy Nutrition Labels preenchidos
- [ ] Screenshots
- [ ] Descrição
- [ ] TestFlight concluído
- [ ] Revisão da App Store enviada

## Regra de ouro

Não publicar uma nova versão nativa sem repetir pelo menos:
- login;
- ocorrências;
- painel do filho;
- deep link;
- relatório/PDF;
- navegação mobile;
- teste em aparelho real.
