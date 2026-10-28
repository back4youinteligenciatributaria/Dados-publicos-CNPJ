# Como ler o Dados-publicos-CNPJ (LP, app e Painel) · 21/10/2026

Repositório público: https://github.com/back4youinteligenciatributaria/Dados-publicos-CNPJ (branch `main`).

## Endereço base
`https://raw.githubusercontent.com/back4youinteligenciatributaria/Dados-publicos-CNPJ/main/`

- Libera CORS (`*`) e aceita HTTP Range, que a busca e as inscrições usam. Cache de uns 5 minutos depois de cada envio.
- **GitHub Pages não serve aqui:** o limite do Pages é 1 GB por site, e o repositório tem ~1,5 GB. Não precisa ligar.
- Se a LP tiver muito tráfego, só a pasta `radar/` (arquivos de ~160 KB) pode ir pelo CDN do jsDelivr:
  `https://cdn.jsdelivr.net/gh/back4youinteligenciatributaria/Dados-publicos-CNPJ@main/radar/`. O jsDelivr não aceita arquivos acima de
  20 MB, então `nomes/` e `pgfn/` continuam pelo raw. O cache dele dura até 12 h; depois de um envio, limpar em
  `https://purge.jsdelivr.net/gh/back4youinteligenciatributaria/Dados-publicos-CNPJ@main/radar/meta.json` (e nos demais).

## Pastas (nomes fixos; cada rodada substitui a pasta inteira, o período fica dentro dela)
| Pasta | O que tem | Formato | Quem usa |
|---|---|---|---|
| `radar/` | `r000.txt` … `r399.txt`, `meta.json`, `rfb_transacoes.json` | o mesmo de hoje em `captacao/site/dados/` (TSV em gzip + base64, arquivo = raiz % 400) | LP, app |
| `nomes/` | `indice.json.gz`, `municipios.json`, `fichas_NN.bin`, `palavras_NN.bin` | blocos gzip lidos por Range; ver `gerar_busca_nomes.py` | LP, app, Painel (busca por nome) |
| `pgfn/` | `indice.json.gz`, `dominios.json`, `inscricoes_NN.bin` | blocos gzip por CNPJ lidos por Range; ver `gerar_inscricoes.py` | app, simulador do Painel |
| `socios/` | `s000.bin` … `sfff.bin`, `meta.json` | gzip de `hash16 \t raiz,raiz`; ver `gerar_socios.py` | app (outras empresas da pessoa) |
| `rfb/` | CSVs originais das transações da Receita | CSV da Receita | conferência |

`regras.json` NÃO está no repositório: continua junto da LP (`dados/regras.json`), porque muda quando sai edital.

## LP: o que muda em motor.js e config.js
config.js, novo campo:
```js
dados: { base: 'https://raw.githubusercontent.com/back4youinteligenciatributaria/Dados-publicos-CNPJ/main/radar/',
         nomes: 'https://raw.githubusercontent.com/back4youinteligenciatributaria/Dados-publicos-CNPJ/main/nomes/' },
```
motor.js: trocar o prefixo `'dados/'` por `BASE` em `meta.json`, `rNNN.txt` e `rfb_transacoes.json`, com
`var BASE = (cfg.dados && cfg.dados.base) || 'dados/';`. Vazio = continua lendo a pasta local (prévia). `regras.json` fica em `'dados/'`.

## Busca por nome (busca_nomes.js, módulo ES)
```html
<script type="module">
  import { criarBusca } from "https://cdn.jsdelivr.net/gh/back4youinteligenciatributaria/Dados-publicos-CNPJ@main/busca_nomes.js";
  const busca = criarBusca(window.CAPTACAO.dados.nomes);
  window.B4Y_buscarNome = (texto, uf) => busca.buscar(texto, { limite: 10, uf });
</script>
```
`buscar` devolve `{ itens: [{ cnpj_raiz, cnpj, nome, mei, razao, fantasia, uf, municipio, cnae, situacao }], total, aviso }`.
Mostrar `nome` (já pronto): no MEI/empresário individual (`mei: true`) a razão social vem vazia e `nome` é o fantasia ou
"MEI ou empresário individual"; mostrar junto `municipio`/`uf`. O nome da pessoa nunca está no repositório. `cnpj` é o da
matriz com os dígitos verificadores, pronto para seguir na consulta normal. A primeira busca baixa o índice (~300 KB a 1 MB, uma vez);
cada busca depois puxa de 100 a 500 KB. Mostrar `aviso` quando vier (palavras muito comuns, muitos resultados).
Sugestão de uso na LP: link "Não sabe o CNPJ? Busque pelo nome" abaixo do campo do CNPJ; ao escolher a empresa, preencher o CNPJ e
consultar. Texto e lugar ficam com a thread da LP.

## Inscrições (inscricoes.js, módulo ES)
`criarInscricoes(base + "pgfn/").daRaiz("84784404")` → `[{ cnpj, numero, data, valor, situacao, receita, origem, ajuizado, tipo_devedor }]`,
todas as situações (em cobrança, negociada, garantida, suspensa). Só PJ.
É a base do simulador do Painel (spec 4.4). `situacao` vem como "TIPO_SITUACAO | SITUACAO": separar no " | " antes do `classificar()`
do motor. Natureza, garantia e rescisão saem de receita + origem + situação; natureza jurídica, porte, MEI e CNAE vêm da BrasilAPI.

## Sócios (socios.js, módulo ES)
`criarSocios(base + "socios/").empresasDe(nomeCompleto, cpf)` → `["12345678", ...]` (raízes); `empresasDaHolding(cnpj ou raiz)` idem.
O hash é feito no navegador; nome e CPF não saem dele. Cada consulta baixa um arquivo de ~50 a 70 KB. MEI não está na base de
sócios. Mostrar como "encontramos estas, são suas?" e só pôr no radar com o toque da pessoa. Depois, cada raiz segue em `radar/` e `pgfn/`.

## Painel
O mesmo endereço base. Na próxima rodada: `BASES_PUBLICAS` / diagnóstico completo passam a ler `nomes/` (com `busca_nomes.js`, no lugar
de `nomes_saude`) e, se quiserem, `pgfn/` (no lugar de `devedores_PGFN_PJ_202606`). Só depois disso sai algo do repositório Dashboard.
