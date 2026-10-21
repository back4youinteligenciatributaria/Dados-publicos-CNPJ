// Busca por nome no repositório aberto Dados-publicos-CNPJ (formato de gerar_busca_nomes.py).
// Uso:
//   import { criarBusca } from "./busca_nomes.js";
//   const busca = criarBusca("https://raw.githubusercontent.com/back4youinteligenciatributaria/Dados-publicos-CNPJ/main/nomes/202610/");
//   const r = await busca.buscar("hemoterapia maringa", { limite: 20, uf: "PR" });
//   // r.itens: [{ cnpj_raiz, cnpj (matriz, 14 dígitos), nome (pronto para mostrar), mei, razao (vazia no MEI), fantasia, uf, municipio, cnae, situacao }], r.aviso: texto ou null
// Baixa o indice.json.gz uma vez e depois só os blocos que precisa (HTTP Range). Precisa de fetch e DecompressionStream.

const SIT = { A: "ativa", S: "suspensa", I: "inapta" };

function norm(s) {
  return (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

async function gunzip(buf) {
  const ds = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip")));
  return new Uint8Array(await ds.arrayBuffer());
}

// CNPJ completo da matriz (ordem 0001 + dígitos verificadores) a partir da raiz
export function cnpjMatriz(raiz) {
  const b = String(raiz).padStart(8, "0") + "0001";
  const dv = (s, pesos) => { const r = [...s].reduce((t, c, i) => t + Number(c) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dv(b, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return b + d1 + dv(b + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}

function lerVarint(b, p) {
  let n = 0, mul = 1, x;
  do { x = b[p.i++]; n += (x & 0x7f) * mul; mul *= 128; } while (x & 0x80);
  return n;
}

// Último bloco cuja chave inicial é <= chave
function acharBloco(lista, chave) {
  let lo = 0, hi = lista.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (lista[m].chave <= chave) { r = m; lo = m + 1; } else hi = m - 1;
  }
  return r;
}

function planificar(arquivos) {
  const out = [];
  for (const a of arquivos) {
    let off = 0;
    for (const [chave, tam] of a.blocos) { out.push({ arquivo: a.arquivo, chave, inicio: off, fim: off + tam - 1 }); off += tam; }
  }
  return out;
}

export function criarBusca(base, { lerFaixa } = {}) {
  if (!base.endsWith("/")) base += "/";
  const ler = lerFaixa || (async (arquivo, inicio, fim) => {
    const r = await fetch(base + arquivo, { headers: { Range: `bytes=${inicio}-${fim}` } });
    if (!r.ok) throw new Error(`Falha ao ler ${arquivo} (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  });
  let pronto = null;
  const cacheBloco = new Map();

  function carregar() {
    if (!pronto) pronto = (async () => {
      const gz = lerFaixa ? await lerFaixa("indice.json.gz") : new Uint8Array(await (await fetch(base + "indice.json.gz")).arrayBuffer());
      const ind = JSON.parse(new TextDecoder().decode(await gunzip(gz)));
      let mun = {};
      try { mun = lerFaixa ? JSON.parse(new TextDecoder().decode(await lerFaixa("municipios.json"))) : await (await fetch(base + "municipios.json")).json(); } catch (e) { /* sem nomes de município */ }
      return { ind, mun, fichas: planificar(ind.fichas), palavras: planificar(ind.indice_palavras),
               frequentes: new Set(ind.frequentes), vazias: new Set(ind.vazias) };
    })();
    return pronto;
  }

  async function bloco(b) {
    const k = b.arquivo + ":" + b.inicio;
    if (!cacheBloco.has(k)) cacheBloco.set(k, ler(b.arquivo, b.inicio, b.fim).then(gunzip));
    return cacheBloco.get(k);
  }

  // Lê um bloco de palavras: Map palavra -> raízes
  async function palavrasDoBloco(b) {
    const d = await bloco(b), p = { i: 0 }, m = new Map(), td = new TextDecoder();
    while (p.i < d.length) {
      const t = lerVarint(d, p), tok = td.decode(d.subarray(p.i, p.i + t)); p.i += t;
      const n = lerVarint(d, p), lst = new Array(n);
      let ant = 0;
      for (let j = 0; j < n; j++) { ant += lerVarint(d, p); lst[j] = ant; }
      m.set(tok, lst);
    }
    return m;
  }

  // Raízes de uma palavra inteira, ou de todas as que começam com o prefixo (última palavra digitada)
  async function raizes(est, tok, prefixo) {
    const i = acharBloco(est.palavras, tok);
    const blocos = [est.palavras[Math.max(i, 0)]];
    if (prefixo && est.palavras[i + 1] && est.palavras[i + 1].chave.startsWith(tok)) blocos.push(est.palavras[i + 1]);
    const conj = new Set();
    for (const b of blocos) {
      for (const [p, lst] of await palavrasDoBloco(b)) {
        if (prefixo ? p.startsWith(tok) : p === tok) for (const r of lst) conj.add(r);
      }
    }
    return conj;
  }

  async function ficha(est, raiz) {
    const i = acharBloco(est.fichas, raiz);
    if (i < 0) return null;
    const alvo = raiz + "\t";
    const linha = new TextDecoder().decode(await bloco(est.fichas[i])).split("\n").find(l => l.startsWith(alvo));
    if (!linha) return null;
    const [r, razao, fantasia, uf, m, cnae, sit, nat = ""] = linha.split("\t");
    const mei = nat === "2135";
    return { cnpj_raiz: r.padStart(8, "0"), cnpj: cnpjMatriz(r), razao, fantasia, uf, municipio: est.mun[m] || m, cnae, situacao: SIT[sit] || sit, mei,
             nome: mei ? (fantasia || "MEI ou empresário individual") : (fantasia ? `${razao} (${fantasia})` : razao) };
  }

  async function buscar(texto, { limite = 20, uf = "" } = {}) {
    const est = await carregar();
    const todas = norm(texto).split(" ").filter(p => p.length >= 2 && !est.vazias.has(p));
    if (!todas.length) return { itens: [], aviso: "Digite pelo menos uma palavra do nome." };
    const ultimaPrefixo = !/\s$/.test(texto) && todas[todas.length - 1].length >= 3;
    const usadas = todas.filter(p => !est.frequentes.has(p));
    if (!usadas.length) return { itens: [], aviso: "Essas palavras são muito comuns. Acrescente outra palavra do nome." };
    let cand = null;
    for (let k = 0; k < usadas.length; k++) {
      const s = await raizes(est, usadas[k], ultimaPrefixo && usadas[k] === todas[todas.length - 1]);
      cand = cand ? new Set([...cand].filter(r => s.has(r))) : s;
      if (!cand.size) break;
    }
    const itens = [];
    let vistos = 0;
    for (const r of [...cand].sort((a, b) => a - b)) {
      if (itens.length >= limite || ++vistos > 300) break;
      const f = await ficha(est, r);
      if (!f || (uf && f.uf !== uf)) continue;
      const nome = norm(f.razao + " " + f.fantasia);
      if (todas.every(p => est.frequentes.has(p) ? nome.includes(p) : true)) itens.push(f);
    }
    return { itens, total: cand.size, aviso: cand.size > limite ? `Mais de ${limite} empresas. Acrescente uma palavra ou a UF.` : null };
  }

  return { buscar, carregar };
}
