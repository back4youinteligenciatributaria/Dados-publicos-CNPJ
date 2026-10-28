// Empresas de uma pessoa no repositório aberto Dados-publicos-CNPJ (formato de gerar_socios.py).
// Uso:
//   import { criarSocios } from "./socios.js";
//   const s = criarSocios("https://raw.githubusercontent.com/back4youinteligenciatributaria/Dados-publicos-CNPJ/main/socios/");
//   const raizes = await s.empresasDe("Maria da Silva", "123.456.789-09");  // ["12345678", ...]
//   const daHolding = await s.empresasDaHolding("12345678000190");  // ou só a raiz "12345678"
// O arquivo só tem hash → raízes: sem o nome completo e o CPF não se acha ninguém. Nome e CPF não saem do navegador.

async function gunzip(buf) {
  return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}

// Mesma normalização do gerador (versao_norm 1)
export function normalizar(s) {
  return String(s || "").normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

async function hash16(texto) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
  return Array.from(d.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function criarSocios(base, { ler } = {}) {
  if (!base.endsWith("/")) base += "/";
  const lerArq = ler || (async (arquivo) => {
    const r = await fetch(base + arquivo);
    if (!r.ok) throw new Error(`Falha ao ler ${arquivo} (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  });

  async function porChave(chave) {
    const txt = new TextDecoder().decode(await gunzip(await lerArq(`s${chave.slice(0, 3)}.bin`)));
    const l = txt.split("\n").find((x) => x.startsWith(chave + "\t"));
    return l ? l.split("\t")[1].split(",").map((r) => r.padStart(8, "0")) : [];
  }

  async function empresasDe(nome, cpf) {
    const dig = String(cpf || "").replace(/\D/g, "");
    if (dig.length !== 11 || !normalizar(nome)) return [];
    return porChave(await hash16(`${normalizar(nome)}|${dig.slice(3, 9)}`));
  }

  async function empresasDaHolding(cnpj) {
    const dig = String(cnpj || "").replace(/\D/g, "");
    return dig.length === 14 || dig.length === 8 ? porChave(await hash16(`CNPJ|${dig.slice(0, 8)}`)) : [];
  }

  return { empresasDe, empresasDaHolding };
}
