// Inscrições da PGFN por CNPJ no repositório aberto Dados-publicos-CNPJ (formato de gerar_inscricoes.py).
// Uso:
//   import { criarInscricoes } from "./inscricoes.js";
//   const base = criarInscricoes("https://raw.githubusercontent.com/back4youinteligenciatributaria/Dados-publicos-CNPJ/main/pgfn/202606/");
//   const lista = await base.daRaiz("84784404");   // ou um CNPJ de 14 dígitos (filtra o estabelecimento)
//   // [{ cnpj, numero, data, valor, situacao, receita, origem, ajuizado, tipo_devedor }]
// Baixa o indice.json.gz e o dominios.json uma vez e depois só o bloco da raiz (HTTP Range).

async function gunzip(buf) {
  return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}

export function criarInscricoes(base, { lerFaixa } = {}) {
  if (!base.endsWith("/")) base += "/";
  const ler = lerFaixa || (async (arquivo, inicio, fim) => {
    const r = await fetch(base + arquivo, inicio === undefined ? {} : { headers: { Range: `bytes=${inicio}-${fim}` } });
    if (!r.ok) throw new Error(`Falha ao ler ${arquivo} (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  });
  let pronto = null;

  function carregar() {
    if (!pronto) pronto = (async () => {
      const ind = JSON.parse(new TextDecoder().decode(await gunzip(await ler("indice.json.gz"))));
      const dom = JSON.parse(new TextDecoder().decode(await ler("dominios.json")));
      const blocos = [];
      for (const a of ind.arquivos) {
        let off = 0;
        for (const [raiz, tam] of a.blocos) { blocos.push({ arquivo: a.arquivo, raiz, inicio: off, fim: off + tam - 1 }); off += tam; }
      }
      return { ind, dom, blocos };
    })();
    return pronto;
  }

  async function daRaiz(cnpj) {
    const dig = String(cnpj).replace(/\D/g, "");
    const raiz = parseInt(dig.slice(0, 8), 10), estab = dig.length === 14 ? dig.slice(8) : null;
    const { dom, blocos } = await carregar();
    let lo = 0, hi = blocos.length - 1, i = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (blocos[m].raiz <= raiz) { i = m; lo = m + 1; } else hi = m - 1; }
    if (i < 0) return [];
    const b = blocos[i];
    const txt = new TextDecoder().decode(await gunzip(await ler(b.arquivo, b.inicio, b.fim)));
    const alvo = raiz + "\t", out = [];
    for (const l of txt.split("\n")) {
      if (!l.startsWith(alvo)) continue;
      const [r, od, numero, data, cent, sit, rec, orig, aj, td] = l.split("\t");
      if (estab && od !== estab) continue;
      out.push({ cnpj: r.padStart(8, "0") + od, numero, data, valor: Number(cent) / 100, situacao: dom.situacao[sit] || sit,
                 receita: dom.receita[rec] || rec, origem: dom.origem[orig] || orig, ajuizado: aj === "1", tipo_devedor: dom.tipo_devedor[td] || td });
    }
    return out;
  }

  return { daRaiz, carregar };
}
