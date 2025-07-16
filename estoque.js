console.log("Estoque carregado!");

window.addEventListener("load", () => {
  document.getElementById("loader")?.classList.remove("hidden");
  const proxy = "https://cors-anywhere.herokuapp.com/";
  const url = "https://docs.google.com/spreadsheets/d/1bFMoSCDOGZb0Jh-f4f_0OS8HiSYXdG5XgwCrz9KYS_Y/gviz/tq?tqx=out:json&sheet=ESTOQUE";

  let allRows = [];
  let chartInstance = null;
  let currentSort = { column: null, asc: true };

  fetch(proxy + url)
    .then(res => res.text())
    .then(text => {
      const json = JSON.parse(text.substring(47).slice(0, -2));
      allRows = json.table.rows;
      preencherLocais(allRows);
      aplicarFiltroEstoque();
    })
    .catch(err => console.error("Erro ao carregar estoque:", err));

  function preencherLocais(rows) {
    const select = document.getElementById("filtro-local-estoque");
    const locais = new Set();
    rows.forEach(r => {
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

  document.getElementById("btn-aplicar-estoque").addEventListener("click", aplicarFiltroEstoque);

  function aplicarFiltroEstoque() {
    const filtroLocal = document.getElementById("filtro-local-estoque").value.toUpperCase();
    const tbody = document.getElementById("tabela-estoque");
    const thead = document.querySelector("#tabela-estoque").parentElement.querySelector("thead tr");
    const totalSpan = document.getElementById("total-estoque");
    tbody.innerHTML = "";

    let total = 0;
    const agrupado = {};
    const porLocal = {};

    allRows.forEach(r => {
      const sku = r.c[1]?.v || "";
      const descricao = r.c[2]?.v || "";
      const local = (r.c[3]?.v || "").toUpperCase().trim();
      const quantidade = r.c[5]?.v || 0;

      if (filtroLocal && local !== filtroLocal) return;

      total += quantidade;
      if (!porLocal[local]) porLocal[local] = 0;
      porLocal[local] += quantidade;

      const key = descricao;
      if (!agrupado[key]) {
        agrupado[key] = { descricao, total: 0, itens: [] };
      }
      agrupado[key].total += quantidade;
      agrupado[key].itens.push({ sku, local, quantidade });
    });

    totalSpan.textContent = total;

    let linhas = Object.values(agrupado);
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

    linhas.forEach(prod => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.innerHTML = `
        <td>${prod.descricao}</td>
        <td>${prod.total}</td>
      `;
      tr.addEventListener("click", () => {
        const expanded = tr.classList.contains("expanded");
        tbody.querySelectorAll(".detalhe-produto").forEach(el => el.remove());
        tbody.querySelectorAll("tr").forEach(row => row.classList.remove("expanded"));
        if (expanded) return;
        tr.classList.add("expanded");
        prod.itens.forEach(item => {
          const trDet = document.createElement("tr");
          trDet.classList.add("detalhe-produto");
          trDet.innerHTML = `
            <td style="padding-left:30px;">SKU: ${item.sku} | Local: ${item.local}</td>
            <td>${item.quantidade}</td>
          `;
          trDet.style.background = "#f9f9f9";
          tbody.insertBefore(trDet, tr.nextSibling);
        });
      });
      tbody.appendChild(tr);
    });

    thead.innerHTML = `
      <th data-col="descricao">Descrição</th>
      <th data-col="total">Quantidade</th>
    `;

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
        aplicarFiltroEstoque();
      };
    });

    const toggleGrafico = document.getElementById("toggle-grafico-estoque").checked;
    const canvas = document.getElementById("grafico-estoque");

    const labels = Object.keys(porLocal);
    const data = labels.map(k => porLocal[k]);

    canvas.width = 300;
    canvas.height = 300;

    if (!chartInstance) {
      const ctx = canvas.getContext("2d");
      chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
          labels: labels,
          datasets: [{
            label: "Estoque por Local",
            data: data,
            backgroundColor: ["#3498db", "#e67e22", "#9b59b6", "#2ecc71", "#f1c40f"]
          }]
        },
        options: {
          responsive: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    } else {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = data;
      chartInstance.update();
    }

    canvas.parentElement.style.display = toggleGrafico ? "block" : "none";
    document.getElementById('btn-exportar')?.addEventListener('click', exportarTabelaEstoque);
    document.getElementById('loader')?.classList.add('hidden');

    document.getElementById("toggle-grafico-estoque").addEventListener("change", (e) => {
      canvas.parentElement.style.display = e.target.checked ? "block" : "none";
    });
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  document.head.appendChild(script);
});

function exportarTabelaEstoque() {
  const tabela = document.getElementById("tabela-estoque");
  const linhas = tabela.querySelectorAll("tr");
  const linhasArray = Array.from(linhas).map(row => Array.from(row.cells).map(cell => cell.innerText));
  const ws = XLSX.utils.aoa_to_sheet(linhasArray);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Estoque");
  XLSX.writeFile(wb, "estoque.xlsx");
}
