# Dados públicos CNPJ · Back4you

Bases abertas usadas pelo radar de dívida federal da Back4you: a consulta por CNPJ da página /radar/ e a busca de empresas pelo nome.
Tudo vem de fontes abertas do governo. Nada aqui é dado de cliente.

## Pastas
- `radar/`: consulta por CNPJ. `r000.txt` a `r399.txt` (TSV em gzip + base64; arquivo = raiz do CNPJ % 400) e `meta.json`
  (período e total de raízes). Uma linha por raiz com dívida ativa federal em aberto, com totais por tipo. Fonte: PGFN.
- `nomes/`: busca pelo nome de qualquer empresa ativa, suspensa ou inapta (MEI incluído; baixadas fora), com ou sem dívida.
  `indice.json.gz` (onde está cada bloco), `fichas_NN.bin` (raiz, razão social, nome fantasia, UF, município, CNAE principal e
  situação), `palavras_NN.bin` (palavra do nome → raízes) e `municipios.json`. Lido por pedaços (HTTP Range) com `busca_nomes.js`.
  Fonte: Receita Federal. Empresário individual e MEI (natureza 2135): a razão social é o nome da pessoa e não é publicada;
  só o nome fantasia, quando existe. Números de CPF nunca entram.
- `pgfn/`: cada inscrição em dívida ativa de PJ, em qualquer situação (em cobrança, negociada, garantida, suspensa):
  número, data, valor, situação, receita, origem, ajuizada e tipo de devedor. `indice.json.gz`, `inscricoes_NN.bin` e
  `dominios.json`; lido por pedaços com `inscricoes.js`. Fonte: PGFN.
- `radar/rfb_transacoes.json` e `rfb/`: transações tributárias deferidas na Receita (adesão e individual),
  com o desconto real por faixa e as raízes que já negociaram. Fonte: Receita Federal, dados.gov.br.

## Atualização
Cada fonte vira uma pasta fixa, refeita do zero a partir do download mais novo e trocada inteira no lugar da anterior: PGFN (trimestral)
→ `radar/` e `pgfn/`; CNPJ da Receita → `nomes/`; transações da Receita → `rfb/` e `radar/rfb_transacoes.json`. O período de cada uma
está no `meta.json` ou no `indice.json.gz` da pasta. Os endereços não mudam.

## Fontes
- Receita Federal, transações deferidas: https://dados.gov.br/dados/conjuntos-dados/transacoes-tributarias-deferidas-na-rfb
- PGFN, dados abertos da dívida ativa: https://www.gov.br/pgfn/pt-br/assuntos/divida-ativa-da-uniao/transparencia-fiscal-1/dados-abertos
- Receita Federal, dados abertos do CNPJ: https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj
