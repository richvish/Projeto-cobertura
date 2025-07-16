
console.log("Cobertura de Estoque carregada!");

window.addEventListener("load", () => {
  document.getElementById("loader")?.classList.remove("hidden");
  const toggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");
  if (toggle) {
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }

  const proxy = "https://cors-anywhere.herokuapp.com/";
  const urlEstoque = "https://docs.google.com/spreadsheets/d/1bFMoSCDOGZb0Jh-f4f_0OS8HiSYXdG5XgwCrz9KYS_Y/gviz/tq?tqx=out:json&sheet=ESTOQUE";
  const urlVendas = "https://docs.google.com/spreadsheets/d/1bFMoSCDOGZb0Jh-f4f_0OS8HiSYXdG5XgwCrz9KYS_Y/gviz/tq?tqx=out:json&sheet=vendas";

  let vendasRows = [];
  let estoqueRows = [];
  let currentSort = { column: null, asc: true };

  Promise.all([
    fetch(proxy + urlEstoque).then(r => r.text()),
    fetch(proxy + urlVendas).then(r => r.text())
  ])
  .then(([estoqueText, vendasText]) => {
    const estoqueJson = JSON.parse(estoqueText.substring(47).slice(0, -2));
    const vendasJson = JSON.parse(vendasText.substring(47).slice(0, -2));
    estoqueRows = estoqueJson.table.rows;
    vendasRows = vendasJson.table.rows;

    preencherPlataformas();
    aplicarFiltro();
  });

  function preencherPlataformas() {
    const select = document.getElementById("filtro-local");
    const locais = new Set();
    estoqueRows.forEach(r => {
      const local = (r.c[3]?.v || "").toUpperCase().trim();
      if (local) locais.add(local);
    });
    select.innerHTML = '<option value="">Todos</option>';
    locais.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l;
      select.appendChild(opt);
    });
  }

  document.getElementById("btn-aplicar").addEventListener("click", aplicarFiltro);

  function aplicarFiltro() {
    const filtroLocal = document.getElementById("filtro-local").value.toUpperCase().trim();
    const dataIni = document.getElementById("filtro-data-inicial").value;
    const dataFim = document.getElementById("filtro-data-final").value;
    const tbody = document.getElementById("tabela-cobertura");
    const totalItensSpan = document.getElementById("total-itens");
    tbody.innerHTML = "";

    let totalItens = 0;
    const agrupado = {};
    const dias = new Set();

    vendasRows.forEach(r => {
      const dataStr = r.c[0]?.f;
      if (!dataStr) return;
      const [d, m, y] = dataStr.split("/");
      const dataRow = new Date(`${y}-${m}-${d}`);
      const keyData = `${d}/${m}/${y}`;
      dias.add(keyData);

      const local = (r.c[1]?.v || "").toUpperCase().trim();
      const sku = r.c[2]?.v || "";
      const desc = r.c[3]?.v || "";
      const qtd = r.c[4]?.v || 0;

      if (filtroLocal && local !== filtroLocal) return;
      if (dataIni && dataRow < new Date(dataIni)) return;
      if (dataFim && dataRow > new Date(dataFim)) return;

      totalItens += qtd;

      const key = desc + "|" + local;
      if (!agrupado[key]) agrupado[key] = { descricao: desc, local: local, total: 0, skus: {} };
      agrupado[key].total += qtd;
      if (!agrupado[key].skus[sku]) agrupado[key].skus[sku] = { vendas: 0, estoque: 0 };
      agrupado[key].skus[sku].vendas += qtd;
    });

    estoqueRows.forEach(r => {
      const sku = r.c[1]?.v || "";
      const desc = r.c[2]?.v || "";
      const local = (r.c[3]?.v || "").toUpperCase().trim();
      const qtd = r.c[5]?.v || 0;

      if (filtroLocal && local !== filtroLocal) return;

      const key = desc + "|" + local;
      if (!agrupado[key]) agrupado[key] = { descricao: desc, local: local, total: 0, skus: {} };
      if (!agrupado[key].skus[sku]) agrupado[key].skus[sku] = { vendas: 0, estoque: 0 };
      agrupado[key].skus[sku].estoque += qtd;
    });

    totalItensSpan.textContent = totalItens;

    let diasPeriodo = 1;
    if (dataIni && dataFim) {
      const start = new Date(dataIni);
      const end = new Date(dataFim);
      const msPerDay = 1000 * 60 * 60 * 24;
      diasPeriodo = Math.floor((end - start) / msPerDay) + 1;
      if (diasPeriodo < 1) diasPeriodo = 1;
    }

    const thead = document.querySelector("#tabela-cobertura").parentElement.querySelector("thead");
    thead.innerHTML = ""; // limpar

    const headerRow = document.createElement("tr");
    const columns = [
      { label: "Descrição", prop: "descricao" },
      { label: "Local", prop: "local" },
      { label: "Vendas", prop: "total" },
      { label: "Estoque", prop: "estoqueTotal" },
      { label: "Média Diária", prop: "media" },
      { label: "Dias Cobertos", prop: "dias" }
    ];

    columns.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col.label;
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        if (currentSort.column === col.prop) {
          currentSort.asc = !currentSort.asc;
        } else {
          currentSort.column = col.prop;
          currentSort.asc = true;
        }
        aplicarFiltro();
      });
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    let linhas = Object.values(agrupado);

    linhas = linhas.map(l => {
      const media = diasPeriodo > 0 ? l.total / diasPeriodo : 0;
      const estoqueTotal = Object.values(l.skus).reduce((acc, s) => acc + s.estoque, 0);
      const diasCobertos = media > 0 ? Math.round(estoqueTotal / media) : 0;
      return { ...l, media, estoqueTotal, dias: diasCobertos };
    });

    if (currentSort.column) {
      linhas.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
      });
    }

    linhas.forEach(item => {
      const tr = document.createElement("tr");
      if (item.dias <= 40) tr.style.background = "#fff3cd";
      else if (item.dias <= 80) tr.style.background = "#d4edda";
      else tr.style.background = "#f8d7da";
      tr.style.cursor = "pointer";
      tr.innerHTML = `
        <td>${item.descricao}</td>
        <td>${item.local}</td>
        <td>${item.total}</td>
        <td>${item.estoqueTotal}</td>
        <td>${item.media.toFixed(1)}</td>
        <td>${item.dias}</td>
      `;
      tr.addEventListener("click", () => {
        const expanded = tr.classList.contains("expanded");
        tbody.querySelectorAll(".sku-detail").forEach(el => el.remove());
        tbody.querySelectorAll("tr").forEach(row => row.classList.remove("expanded"));
        if (expanded) return;
        tr.classList.add("expanded");
        Object.entries(item.skus).forEach(([sku, dados]) => {
          const mediaSKU = diasPeriodo > 0 ? dados.vendas / diasPeriodo : 0;
          const cobertura = mediaSKU > 0 ? (dados.estoque / mediaSKU) : "∞";
          const trSku = document.createElement("tr");
          trSku.classList.add("sku-detail");
          trSku.innerHTML = `<td style="padding-left:30px;">${sku}</td><td>${item.local}</td><td>${dados.vendas}</td><td>${dados.estoque}</td><td>${mediaSKU.toFixed(1)}</td><td>${cobertura === "∞" ? "∞" : Math.round(cobertura)}</td>`;
          trSku.style.background = "#f9f9f9";
          tbody.insertBefore(trSku, tr.nextSibling);
        });
      });
      tbody.appendChild(tr);
    document.getElementById('btn-exportar')?.addEventListener('click', exportarTabelaCobertura);
    document.getElementById('loader')?.classList.add('hidden');
    });
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  document.head.appendChild(script);
});

function exportarTabelaCobertura() {
  const tabela = document.getElementById("tabela-cobertura");
  const linhas = tabela.querySelectorAll("tr");
  const linhasArray = Array.from(linhas).map(row => Array.from(row.cells).map(cell => cell.innerText));
  const ws = XLSX.utils.aoa_to_sheet(linhasArray);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cobertura");
  XLSX.writeFile(wb, "cobertura.xlsx");
}
