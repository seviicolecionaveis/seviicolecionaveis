# Acessórios integrados à loja

## O que foi encontrado
- Existem **21 acessórios ativos**, sendo **5 com variações**, em cadastro separado dos lacrados. Nome, descrição, preço, imagens, estoque e ativo/inativo já existem; faltam endereço amigável persistido, histórico desses endereços, SKU/código e tags.
- Acessórios já usam o carrinho e a conferência de preços do pagamento, inclusive por variação. A listagem e a busca, porém, abrem uma janela em vez de uma página individual.
- Lacrados já têm página própria, galeria, zoom e compartilhamento. Sua listagem ainda não tem todos os filtros e ordenações pedidos; esses controles serão compartilhados entre as duas categorias.
- A gestão administrativa é separada; a busca de pedidos manuais consulta apenas cartas e lacrados. O sitemap não contém páginas individuais de acessórios, e o aviso de reposição está voltado a cartas.
- A baixa de estoque atual lê e grava quantidades em operações separadas; impedir números negativos não basta para impedir duas vendas da última unidade. A devolução atual também não reconhece corretamente os identificadores de variações.

## Abordagem
Preservar os cadastros e identificadores existentes, sem mover acessórios para a tabela de lacrados. Unificar a apresentação e os serviços usados pelas categorias, reutilizando o carrinho, pedidos, pagamento, Pilha, permissões e notificações da loja.

### 1. Páginas e catálogo
- Extrair dos lacrados a página de produto e a galeria com zoom para uso compartilhado, mantendo os recursos atuais dos lacrados.
- Criar `/acessorios/$slug` com carregamento pelo link direto, breadcrumb, descrição, disponibilidade, quantidade, variações com preço/fotos/estoque, carrinho, contato com o WhatsApp da loja e retorno para Acessórios.
- Compartilhamento por cópia de link e WhatsApp; título e descrição próprios, imagem pública do produto nos previews, canonical e dados de produto.
- Usar cards, grid, busca, filtros e ordenação compartilhados com lacrados; exibir esgotado/poucas unidades e imagem padrão quando faltar foto.
- Gerar sufixo em slugs duplicados, guardar endereços antigos e redirecionar após renomeação. Produtos inexistentes/inativos terão mensagem amigável e alternativas disponíveis.

### 2. Estoque e administração
- Integrar a gestão existente em uma tela com categorias **Cartas, Produtos Lacrados, Painéis e Acessórios**, contagens e busca sem distinção de acentos/maiúsculas por nome, descrição, tags e códigos disponíveis.
- Reutilizar os editores atuais, compartilhando campos comuns sem perder os campos específicos das cartas e variações dos acessórios.
- Mostrar foto, nome, categoria, quantidade, preço, status, aviso de estoque baixo e ações de editar, ativar/desativar quando aplicável e copiar link público.
- Incluir acessórios e suas variações na seleção de pedidos manuais, com preço, disponibilidade e imagens corretos.
- Centralizar o controle transacional de estoque e reservas nos fluxos afetados para impedir venda concorrente da última unidade e baixa/reposição duplicada; preservar o momento atual da baixa em vendas e pedidos manuais.
- **Regra confirmada:** cancelamentos parciais não devolvem estoque; cancelamentos integrais mantêm a opção do administrador. Quando houver reposição integral, devolver à variação correta.
- Estender o aviso de volta ao estoque existente para acessórios, sem criar um segundo sistema de envio.

### 3. Integrações
- Resultados da busca pública e novidades levam à página individual do acessório, sem modal.
- Preservar compra, relatórios, envio/retirada e Pilha pelos mesmos identificadores; conferir cada caminho afetado.
- Mostrar nome, imagem e link público dos acessórios nos itens do pedido do administrador e do cliente; incluir páginas ativas no sitemap.

## Alterações de dados propostas — exigem aprovação e backup
- Acrescentar campos de slug, SKU/código e tags ao cadastro atual de acessórios, com valores opcionais ou padrões compatíveis com os cadastros existentes.
- Acrescentar histórico de slugs para redirecionamentos, com leitura pública apenas dos destinos de produtos ativos e edição restrita a administradores.
- Preencher apenas os novos slugs dos 21 acessórios, preservando nomes, preços, estoque, imagens, variações, pedidos e identificadores existentes.
- Acrescentar o suporte mínimo ao controle transacional de estoque/reservas e aos avisos de reposição, reutilizando os registros atuais e mantendo permissões.
- Antes de qualquer alteração, gerar backup verificável dos dados e definições afetados em local privado e registrar contagens; se não for possível garantir o backup, interromper a alteração e informar.
- Não excluir tabelas/colunas nem sobrescrever cadastros. Não publicar automaticamente.

## Validação
- Testes de regras: slug duplicado e histórico, busca normalizada, variação/quantidade, baixa e reposição idempotentes, regra de cancelamento confirmada, pedidos manuais e aviso de reposição.
- Em banco descartável: duas compras da última unidade, reservas concorrentes, repetição de confirmação/cancelamento e estoque por variação.
- No navegador, computador e celular: abrir um acessório existente pela listagem e por link direto, galeria/zoom, copiar/compartilhar, selecionar variação e adicionar ao carrinho; conferir páginas de cartas e lacrados.
- Compra, pagamento, baixa, pedido manual, leitura de pedidos e e-mails serão exercitados somente com pessoas/pedidos fictícios em ambiente isolado. Não cobrar, cancelar ou alterar pedidos reais, nem enviar e-mails reais durante testes.
- Se não houver ambiente isolado para compra completa, informar esse limite explicitamente, sem apresentar testes simulados como compra real validada.

## Detalhes técnicos
- Rotas tipadas TanStack com parâmetros; página e catálogo comuns extraídos dos recursos existentes, sem implementações paralelas.
- Consultas públicas restritas a produtos ativos; alterações administrativas com identidade autenticada e papel ativo verificado no servidor.
- Mudanças de esquema aditivas pela ferramenta de migração existente, somente após a aprovação deste plano e backup.
- Estoque protegido por operações PostgreSQL transacionais com bloqueio de registros e idempotência por pedido; variações continuam compatíveis com os identificadores atuais.
- Datas e regras temporais em **America/Fortaleza (UTC-3)**.