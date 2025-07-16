
// Trecho essencial da alteração
// Dentro da função detalharSKUsPorLocal
// ...
let valorUnitario = 0;
// Buscar valor unitário no estoqueRows
produtoFiltrado.forEach(r => {
  const desc = (r.c[2]?.v || "").toLowerCase().trim();
  const local = (r.c[3]?.v || "").toUpperCase().trim();
  const skuLinha = r.c[1]?.v || "";
  if (skuLinha === sku && local === localSelecionado && desc === descricaoBase) {
    valorUnitario = r.c[6]?.v || 0;
  }
});
const valorTotalSKU = valorUnitario * info.estoque;

// Ao montar a linha
const tdValor = document.createElement("td");
tdValor.textContent = formatReal(valorTotalSKU);

// Depois adiciona na ordem final:
tr.appendChild(tdSKU);
tr.appendChild(tdValor);
tr.appendChild(tdEstoque);
tr.appendChild(tdVendas);
tr.appendChild(tdCobertura);
tr.appendChild(tdReposicao);
tr.appendChild(tdCarrinho);
