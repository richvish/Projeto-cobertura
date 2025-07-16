
console.log("Dashboard carregado!");

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
  const url = "https://docs.google.com/spreadsheets/d/1bFMoSCDOGZb0Jh-f4f_0OS8HiSYXdG5XgwCrz9KYS_Y/gviz/tq?tqx=out:json&sheet=vendas";
  let allRows = [];
  let currentSort = { column: null, asc: true };
  let chartInstance = null;

  fetch(proxy + url)
    .then(res => res.text())
    .then(dataText => {
      const json = JSON.parse(dataText.substring(47).slice(0, -2));
      allRows = json.table.rows;
      preencherPlataformas(allRows);
      aplicarFiltro();
    })
    .catch(err => console.error("Erro ao carregar dados:", err));

  function preencherPlataformas(rows) {
    const select = document.getElementById("filtro-local");
    const locais = new Set();
    rows.forEach(r => {
      const local = (r.c[1]?.v || "").toUpperCase().trim();
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
    const filtroLocal = document.getElementById("filtro-local").value.toUpperCase();
    const dataIni = document.getElementById("filtro-data-inicial").value;
    const dataFim = document.getElementById("filtro-data-final").value;
    const tbody = document.getElementById("tabela-consolidado");
    const totalItensSpan = document.getElementById("total-itens");
    tbody.innerHTML = "";

    let totalItens = 0;
    const agrupado = {};
    const vendasPorData = {};

    allRows.forEach(r => {
      const dataStr = r.c[0]?.f;
      if (!dataStr) return;

      const [dia, mes, ano] = dataStr.split("/");
      const dataRow = new Date(`${ano}-${mes}-${dia}`);
      const dataKey = `${dia}/${mes}/${ano}`;

      const local = (r.c[1]?.v || "").toUpperCase().trim();
      const sku = r.c[2]?.v || "";
      const desc = r.c[3]?.v || "";
      const qtd = r.c[4]?.v || 0;

      if (filtroLocal && local !== filtroLocal) return;
      if (dataIni && dataRow < new Date(dataIni)) return;
      if (dataFim && dataRow > new Date(dataFim)) return;

      totalItens += qtd;
      if (!vendasPorData[dataKey]) vendasPorData[dataKey] = 0;
      vendasPorData[dataKey] += qtd;

      const key = desc + "|" + local;
      if (!agrupado[key]) {
        agrupado[key] = { descricao: desc, local: local, total: 0, skus: {} };
      }
      agrupado[key].total += qtd;
      if (!agrupado[key].skus[sku]) agrupado[key].skus[sku] = 0;
      agrupado[key].skus[sku] += qtd;
    });

    totalItensSpan.textContent = totalItens;

    const thead = document.querySelector("#tabela-consolidado").parentElement.querySelector("thead tr");
    if (filtroLocal) {
      thead.innerHTML = `
        <th data-col="descricao">Descrição</th>
        <th data-col="total">Total Vendido</th>
      `;
    } else {
      thead.innerHTML = `
        <th data-col="descricao">Descrição</th>
        <th data-col="local">Local</th>
        <th data-col="total">Total Vendido</th>
      `;
    }

    let linhas = Object.values(agrupado);
    if (currentSort.column) {
      linhas.sort((a, b) => {
        let valA = currentSort.column === "total" ? a.total : a[currentSort.column];
        let valB = currentSort.column === "total" ? b.total : b[currentSort.column];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
      });
    }

    linhas.forEach(item => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      if (filtroLocal) {
        tr.innerHTML = `
          <td>${item.descricao}</td>
          <td>${item.total}</td>
        `;
      } else {
        tr.innerHTML = `
          <td>${item.descricao}</td>
          <td>${item.local}</td>
          <td>${item.total}</td>
        `;
      }

      tr.addEventListener("click", () => {
        const expanded = tr.classList.contains("expanded");
        tbody.querySelectorAll(".sku-detail").forEach(el => el.remove());
        tbody.querySelectorAll("tr").forEach(row => row.classList.remove("expanded"));
        if (expanded) return;
        tr.classList.add("expanded");
        Object.entries(item.skus).forEach(([sku, qtd]) => {
          const trSku = document.createElement("tr");
          trSku.classList.add("sku-detail");
          trSku.innerHTML = filtroLocal
            ? `<td style="padding-left:30px;">SKU: ${sku}</td><td>${qtd}</td>`
            : `<td style="padding-left:30px;">SKU: ${sku}</td><td></td><td>${qtd}</td>`;
          trSku.style.background = "#f9f9f9";
          tbody.insertBefore(trSku, tr.nextSibling);
        });
      });

      tbody.appendChild(tr);
    });

    thead.querySelectorAll("th").forEach(th => {
      th.style.cursor = "pointer";
      th.onclick = () => {
        const col = th.dataset.col;
        if (currentSort.column === col) {
          currentSort.asc = !currentSort.asc;
        } else {
          currentSort.column = col;
          currentSort.asc = true;
        }
        aplicarFiltro();
      };
    });

    const toggleGrafico = document.getElementById("toggle-grafico").checked;
    const canvas = document.getElementById("grafico-vendas");

    const labels = Object.keys(vendasPorData).sort((a, b) => {
      const [d1, m1, y1] = a.split("/");
      const [d2, m2, y2] = b.split("/");
      return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
    });
    const data = labels.map(k => vendasPorData[k]);

    if (!chartInstance) {
      const ctx = canvas.getContext("2d");
      chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Itens Vendidos",
            data: data,
            backgroundColor: "#e74c3c"
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    } else {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = data;
      chartInstance.update();
    }

    // Mostrar/ocultar gráfico ao aplicar filtro
    canvas.parentElement.style.display = toggleGrafico ? "block" : "none";

    document.getElementById("loader")?.classList.add("hidden");

  document.getElementById("btn-exportar")?.addEventListener("click", exportarTabelaVendas);

  // Evento ao mudar o checkbox imediatamente
    document.getElementById("toggle-grafico").addEventListener("change", (e) => {
      canvas.parentElement.style.display = e.target.checked ? "block" : "none";
    });
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  document.head.appendChild(script);
});

function exportarTabelaVendas() {
  const tabela = document.getElementById("tabela-consolidado");
  const linhas = tabela.querySelectorAll("tr");
  const linhasArray = Array.from(linhas).map(row => Array.from(row.cells).map(cell => cell.innerText));
  const ws = XLSX.utils.aoa_to_sheet(linhasArray);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendas");
  XLSX.writeFile(wb, "vendas.xlsx");
}
