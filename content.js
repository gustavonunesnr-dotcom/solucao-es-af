/* e-SUS AF - Gerar Nota de Distribuição
 * Injeta um botão nas telas de "Dados da saída" e "Atender requisição" que
 * extrai os dados já carregados na página e monta uma nota de distribuição
 * em PDF (via impressão), no layout do modelo usado pela prefeitura.
 */

(function () {
  'use strict';

  const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // ---------- utilidades gerais ----------

  function clean(str) {
    return String(str || '')
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeLabel(str) {
    return clean(str)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[°º]/g, 'o');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function findRowValue(root, labelText) {
    const target = normalizeLabel(labelText);
    const rows = root.querySelectorAll('.row');
    for (const row of rows) {
      const label = row.querySelector(':scope > span.fw-bold');
      if (!label || normalizeLabel(label.textContent) !== target) continue;
      const value = row.querySelector(':scope > span.text-dark');
      return value ? clean(value.textContent) : '';
    }
    return '';
  }

  function toBRDate(str) {
    const m = clean(str).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : str;
  }

  function parseBRNumber(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/[^\d,.-]/g, '');
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }

  function parseBRInt(str) {
    if (!str) return 0;
    const n = parseInt(String(str).replace(/[^\d-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  function formatBRNumber(n) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatHeaderDate(date) {
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function extractInstituicao() {
    const el = document.querySelector('.context-selected .text-break');
    const raw = el ? clean(el.textContent) : '';
    const match = raw.match(/^(.*?)\s*-\s*(.*?)\s*-\s*([A-Za-z]{2})\s*-\s*(.*)$/);
    if (match) {
      return { esfera: match[1].trim(), cidade: match[2].trim(), uf: match[3].trim(), estabelecimento: match[4].trim() };
    }
    return { esfera: '', cidade: '', uf: '', estabelecimento: raw };
  }

  function extractLogoUrl() {
    const img = document.querySelector('img[alt*="Logo do e-SUS"]');
    return img ? img.src : '';
  }

  // ---------- página: Dados da saída (transaction/expenses/expensesData) ----------

  function isProductHeaderSaida(el) {
    return !!(el.style && el.style.backgroundColor);
  }

  function parseProductHeaderSaida(header) {
    const nameBlock = header.querySelector('.col-xxl-5') || header;
    const nameSpan = nameBlock.querySelector('span.fw-bold');
    const name = nameSpan ? clean(nameSpan.textContent) : '';

    const textLines = Array.from(nameBlock.querySelectorAll('span.text-dark')).map((s) => clean(s.textContent));
    const getLine = (prefix) => {
      const line = textLines.find((t) => t.toLowerCase().startsWith(prefix.toLowerCase()));
      return line ? line.substring(line.indexOf(':') + 1).trim() : '';
    };

    const totals = {};
    header.querySelectorAll('.text-center.col').forEach((col) => {
      const label = col.querySelector('span.fw-bold');
      const value = col.querySelector('span.text-dark');
      if (label && value) totals[normalizeLabel(label.textContent)] = clean(value.textContent);
    });

    return {
      nome: name,
      apresentacao: getLine('Apresentação'),
      catmat: getLine('CATMAT'),
      fabricante: getLine('Fabricante'),
      qtdSolicitada: totals[normalizeLabel('Qtd a expedir')] || '',
      qtdAtendida: totals[normalizeLabel('Qtd expedida')] || '',
      valorUnitario: totals[normalizeLabel('Valor unitário')] || '',
      valorTotal: totals[normalizeLabel('Valor total')] || ''
    };
  }

  function parseProductLotSaida(details) {
    return {
      lote: findRowValue(details, 'Nº do lote'),
      validade: findRowValue(details, 'Data de validade'),
      programa: findRowValue(details, 'Programa de saúde'),
      localizacao: findRowValue(details, 'Endereçamento físico'),
      qtdSolicitada: findRowValue(details, 'Quantidade a expedir'),
      qtdAtendida: findRowValue(details, 'Quantidade expedida'),
      valorUnitario: findRowValue(details, 'Valor unitário'),
      valorTotal: findRowValue(details, 'Valor total')
    };
  }

  function extractProdutosSaida() {
    const heading = Array.from(document.querySelectorAll('span.fw-bold'))
      .find((s) => clean(s.textContent) === 'Produto(s)');
    if (!heading) return [];

    const container = heading.parentElement;
    const children = Array.from(container.children).filter((el) => el !== heading);

    const produtos = [];
    let current = null;
    for (const child of children) {
      if (isProductHeaderSaida(child)) {
        current = { ...parseProductHeaderSaida(child), lots: [] };
        produtos.push(current);
      } else if (current) {
        current.lots.push(parseProductLotSaida(child));
      }
    }
    return produtos;
  }

  function extractSaidaData() {
    return {
      numero: findRowValue(document, 'Nº da saída'),
      tipo: findRowValue(document, 'Tipo de saída'),
      dataEmissao: findRowValue(document, 'Data da saída'),
      dataAtendimento: findRowValue(document, 'Data do documento'),
      solicitante: findRowValue(document, 'Estabelecimento'),
      justificativa: findRowValue(document, 'Justificativa'),
      detalharJustificativa: findRowValue(document, 'Detalhar justificativa'),
      produtos: extractProdutosSaida()
    };
  }

  function buildTabelaSaida(produtos) {
    const COLS = 9;
    let rows = '';
    let totalQtd = 0;
    let totalValor = 0;

    produtos.forEach((produto) => {
      const lots = produto.lots.length ? produto.lots : [{
        lote: '', validade: '', programa: '', localizacao: '',
        qtdSolicitada: produto.qtdSolicitada, qtdAtendida: produto.qtdAtendida,
        valorUnitario: produto.valorUnitario, valorTotal: produto.valorTotal
      }];

      rows += `
        <tr class="produto-header">
          <td colspan="${COLS}"><strong>Produto</strong> ${escapeHtml(produto.catmat)}&nbsp;&nbsp;${escapeHtml(produto.nome)}</td>
        </tr>`;

      let subtotalQtd = 0;
      let subtotalValor = 0;

      lots.forEach((lot) => {
        subtotalQtd += parseBRInt(lot.qtdAtendida);
        subtotalValor += parseBRNumber(lot.valorTotal);
        rows += `
          <tr>
            <td>${escapeHtml(lot.localizacao)}</td>
            <td>${escapeHtml(lot.programa)}</td>
            <td>${escapeHtml(produto.fabricante)}</td>
            <td>${escapeHtml(lot.lote)}</td>
            <td>${escapeHtml(lot.validade)}</td>
            <td class="num">${escapeHtml(lot.qtdSolicitada)}</td>
            <td class="num">${escapeHtml(lot.qtdAtendida)}</td>
            <td class="num">${escapeHtml(lot.valorUnitario)}</td>
            <td class="num">${escapeHtml(lot.valorTotal)}</td>
          </tr>`;
      });

      totalQtd += subtotalQtd;
      totalValor += subtotalValor;

      rows += `
        <tr class="produto-total">
          <td colspan="6"></td>
          <td class="num"><strong>Total:</strong></td>
          <td class="num"><strong>${subtotalQtd}</strong></td>
          <td class="num"><strong>${formatBRNumber(subtotalValor)}</strong></td>
        </tr>`;
    });

    const theadHtml = `
      <tr>
        <th>Localização</th>
        <th>Programa de Saúde</th>
        <th>Fabricante</th>
        <th>Lote</th>
        <th>Validade</th>
        <th class="num">Qtde Solicitada</th>
        <th class="num">Qtde Atendida</th>
        <th class="num">Vl. Unitário</th>
        <th class="num">Vl. Total</th>
      </tr>`;

    const footerHtml = `
      <span>Total Relatório:</span>
      <span>${totalQtd}</span>
      <span>${formatBRNumber(totalValor)}</span>`;

    return { theadHtml, rows, footerHtml };
  }

  function buildNotaSaida() {
    const data = extractSaidaData();
    const observacao = (data.detalharJustificativa && data.detalharJustificativa !== '---')
      ? data.detalharJustificativa
      : data.justificativa;

    const infoGridHtml = `
      <div><span class="label">Nº Saída:</span>${escapeHtml(data.numero)}</div>
      <div><span class="label">Dt.:</span>${escapeHtml(data.dataEmissao)}</div>
      <div><span class="label">Tipo de Saída:</span>${escapeHtml(data.tipo)}</div>
      <div><span class="label">Dt. Atendimento:</span>${escapeHtml(data.dataAtendimento)}</div>
      <div><span class="label">Solicitante:</span>${escapeHtml(data.solicitante)}</div>
      <div></div>
      <div style="grid-column: 1 / -1;"><span class="label">Observação/Justificativa:</span>${escapeHtml(observacao)}</div>`;

    const { theadHtml, rows, footerHtml } = buildTabelaSaida(data.produtos);

    return { titulo: 'Saída', numero: data.numero, infoGridHtml, theadHtml, rows, footerHtml };
  }

  // ---------- página: Atender requisição (transaction/requests/attend/details) ----------

  function extractProdutosRequisicao() {
    const groups = document.querySelectorAll('.border.pb-2.title.p-3.mb-3.rounded.justify-content-center.row');
    const produtos = [];

    groups.forEach((group) => {
      const nome = findRowValue(group, 'Produto');
      const qtdEstoqueAtual = findRowValue(group, 'Qtd. estoque atual');
      const qtdSolicitada = findRowValue(group, 'Qtd. solicitada');
      const qtdAtendida = findRowValue(group, 'Qtd. atendida');

      const lots = [];
      const table = group.querySelector('table.table');
      if (table) {
        const headers = Array.from(table.querySelectorAll('thead th span')).map((s) => normalizeLabel(s.textContent));
        table.querySelectorAll('tbody tr').forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => clean(td.textContent));
          const lot = {};
          headers.forEach((h, i) => {
            if (h === normalizeLabel('Nº')) lot.lote = cells[i];
            else if (h === normalizeLabel('Validade')) lot.validade = cells[i];
            else if (h === normalizeLabel('Qtd. atendida')) lot.qtdAtendida = cells[i];
            else if (h === normalizeLabel('Endereçamento físico')) lot.localizacao = cells[i];
            else if (h === normalizeLabel('Programa de saúde')) lot.programa = cells[i];
          });
          lots.push(lot);
        });
      }

      produtos.push({ nome, qtdEstoqueAtual, qtdSolicitada, qtdAtendida, lots });
    });

    return produtos;
  }

  function extractRequisicaoData() {
    return {
      numero: findRowValue(document, 'Nº da Solicitação'),
      status: findRowValue(document, 'Status'),
      dataEmissao: toBRDate(findRowValue(document, 'Data da Requisição')),
      dataAtendimento: findRowValue(document, 'Data do atendimento'),
      solicitante: findRowValue(document, 'Estabelecimento Solicitante'),
      produtos: extractProdutosRequisicao()
    };
  }

  function buildTabelaRequisicao(produtos) {
    const COLS = 5;
    let rows = '';
    let totalQtd = 0;

    produtos.forEach((produto) => {
      rows += `
        <tr class="produto-header">
          <td colspan="${COLS}">
            <strong>Produto</strong> ${escapeHtml(produto.nome)}
            &nbsp;&nbsp;<span class="produto-extra">Qtd. solicitada: ${escapeHtml(produto.qtdSolicitada)} · Qtd. estoque atual: ${escapeHtml(produto.qtdEstoqueAtual)}</span>
          </td>
        </tr>`;

      let subtotalQtd = 0;
      const lots = produto.lots.length ? produto.lots : [{}];

      lots.forEach((lot) => {
        subtotalQtd += parseBRInt(lot.qtdAtendida);
        rows += `
          <tr>
            <td>${escapeHtml(lot.localizacao)}</td>
            <td>${escapeHtml(lot.programa)}</td>
            <td>${escapeHtml(lot.lote)}</td>
            <td>${escapeHtml(lot.validade)}</td>
            <td class="num">${escapeHtml(lot.qtdAtendida)}</td>
          </tr>`;
      });

      totalQtd += subtotalQtd;

      rows += `
        <tr class="produto-total">
          <td colspan="${COLS - 1}"></td>
          <td class="num"><strong>${subtotalQtd}</strong></td>
        </tr>`;
    });

    const theadHtml = `
      <tr>
        <th>Localização</th>
        <th>Programa de Saúde</th>
        <th>Lote</th>
        <th>Validade</th>
        <th class="num">Qtde Atendida</th>
      </tr>`;

    const footerHtml = `
      <span>Total Relatório:</span>
      <span>${totalQtd}</span>`;

    return { theadHtml, rows, footerHtml };
  }

  function buildNotaRequisicao() {
    const data = extractRequisicaoData();

    const infoGridHtml = `
      <div><span class="label">Nº Requisição:</span>${escapeHtml(data.numero)}</div>
      <div><span class="label">Dt.:</span>${escapeHtml(data.dataEmissao)}</div>
      <div><span class="label">Status:</span>${escapeHtml(data.status)}</div>
      <div><span class="label">Dt. Atendimento:</span>${escapeHtml(data.dataAtendimento)}</div>
      <div style="grid-column: 1 / -1;"><span class="label">Solicitante:</span>${escapeHtml(data.solicitante)}</div>`;

    const { theadHtml, rows, footerHtml } = buildTabelaRequisicao(data.produtos);

    return { titulo: 'Requisição', numero: data.numero, infoGridHtml, theadHtml, rows, footerHtml };
  }

  // ---------- página: Dispensação/Fornecimento (dispensation/dispensation-data) ----------
  // Estrutura diferente das outras telas: rótulo e valor às vezes não são
  // irmãos diretos, e alguns valores ficam em <input> em vez de <span>.

  function findValueBySiblingLabel(root, labelText) {
    const target = normalizeLabel(labelText);
    const labels = root.querySelectorAll('span.fw-bold');
    for (const label of labels) {
      if (normalizeLabel(label.textContent) !== target) continue;
      const value = label.nextElementSibling;
      return value ? clean(value.textContent) : '';
    }
    return '';
  }

  function findEtapaContainer(headingPrefix) {
    const heading = Array.from(document.querySelectorAll('h5.title'))
      .find((h) => clean(h.textContent).startsWith(headingPrefix));
    return heading ? heading.closest('.border.rounded') : null;
  }

  function extractUsuarioEResponsavel() {
    const result = { paciente: {}, retirada: {}, dispensacao: {} };
    const etapa1 = findEtapaContainer('Etapa 1');
    if (!etapa1) return result;

    let section = 'paciente';
    const walker = document.createTreeWalker(etapa1, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node.tagName === 'H6') {
        if (normalizeLabel(node.textContent).includes('identificacao do responsavel')) section = 'retirada';
      } else if (node.tagName === 'SPAN' && node.classList.contains('fw-bold')) {
        const label = normalizeLabel(node.textContent);
        const value = node.nextElementSibling ? clean(node.nextElementSibling.textContent) : '';
        if (label === normalizeLabel('Dispensado em') || label === normalizeLabel('Dispensado por')) {
          result.dispensacao[label] = value;
        } else {
          result[section][label] = value;
        }
      }
      node = walker.nextNode();
    }
    return result;
  }

  function extractPrescricao() {
    const etapa2 = findEtapaContainer('Etapa 2');
    if (!etapa2) return {};
    return {
      dataReceita: findValueBySiblingLabel(etapa2, 'Data da receita/prescrição'),
      prescritorNome: findValueBySiblingLabel(etapa2, 'Nome completo'),
      conselho: findValueBySiblingLabel(etapa2, 'Conselho de Classe'),
      numeroConselho: findValueBySiblingLabel(etapa2, 'Número do Conselho'),
      ufConselho: findValueBySiblingLabel(etapa2, 'UF do Conselho')
    };
  }

  function parseProdutoCardInfo(card) {
    const fields = {};
    card.querySelectorAll(':scope > .row > div').forEach((col) => {
      const rows = col.querySelectorAll(':scope > .row');
      if (rows.length < 2) return;
      const label = rows[0].querySelector('span.fw-bold');
      const value = rows[1].querySelector('span');
      if (label && value) fields[normalizeLabel(label.textContent)] = clean(value.textContent);
    });
    return {
      nome: fields[normalizeLabel('Produto')] || '',
      apresentacao: fields[normalizeLabel('Apresentação')] || '',
      qtdPrescrita: fields[normalizeLabel('Qtd prescrita')] || '',
      qtdDispensada: fields[normalizeLabel('Qtd dispensada/fornecida')] || ''
    };
  }

  function parseLoteAccordionItem(item) {
    const headerDivs = item.querySelectorAll(':scope > .accordion-header .row > div');

    const getSpanText = (i) => {
      const span = headerDivs[i] ? headerDivs[i].querySelector('span') : null;
      return span ? clean(span.textContent) : '';
    };
    const getInputValue = (i) => {
      const input = headerDivs[i] ? headerDivs[i].querySelector('input') : null;
      return input ? clean(input.value) : '';
    };

    const fabricante = getSpanText(0);
    const lote = getSpanText(1);
    const validade = getSpanText(2);
    let qtdDispensada = getInputValue(4);

    let programa = '';
    let localizacao = '';
    const bodyTable = item.querySelector('.accordion-body table');
    if (bodyTable) {
      const headers = Array.from(bodyTable.querySelectorAll('thead th span')).map((s) => normalizeLabel(s.textContent));
      const cells = Array.from(bodyTable.querySelectorAll('tbody tr:first-child td'));
      headers.forEach((h, i) => {
        const cell = cells[i];
        if (!cell) return;
        if (h === normalizeLabel('Programa de saúde')) programa = clean(cell.textContent);
        else if (h === normalizeLabel('Endereçamento físico')) localizacao = clean(cell.textContent);
        else if (h === normalizeLabel('Qtd dispensada/fornecida') && !qtdDispensada) {
          const input = cell.querySelector('input');
          qtdDispensada = input ? clean(input.value) : clean(cell.textContent);
        }
      });
    }

    return { fabricante, lote, validade, qtdDispensada, programa, localizacao };
  }

  function extractProdutosDispensacao() {
    const cards = document.querySelectorAll('.bg-light-gray.p-4.border-bottom.border-2.w-100.col-xxl-12');
    const produtos = [];

    cards.forEach((card) => {
      const info = parseProdutoCardInfo(card);
      const block = card.closest('.border.border-solid.rounded.my-2') || card.closest('.row') || card.parentElement;
      const lots = [];
      block.querySelectorAll('.accordion-item').forEach((item) => {
        lots.push(parseLoteAccordionItem(item));
      });
      produtos.push({ ...info, lots });
    });

    return produtos;
  }

  function buildTabelaDispensacao(produtos) {
    const COLS = 8;
    let rows = '';
    let totalQtd = 0;

    produtos.forEach((produto) => {
      rows += `
        <tr class="produto-header">
          <td colspan="${COLS}">
            <strong>Medicamento</strong> ${escapeHtml(produto.nome)}
            &nbsp;&nbsp;<span class="produto-extra">Qtd prescrita: ${escapeHtml(produto.qtdPrescrita)} · Qtd dispensada: ${escapeHtml(produto.qtdDispensada)}</span>
          </td>
        </tr>`;

      let subtotal = 0;
      const lots = produto.lots.length ? produto.lots : [{}];
      lots.forEach((lot) => {
        subtotal += parseBRInt(lot.qtdDispensada);
        rows += `
          <tr>
            <td>${escapeHtml(produto.nome)}</td>
            <td>${escapeHtml(produto.apresentacao)}</td>
            <td>${escapeHtml(lot.fabricante)}</td>
            <td>${escapeHtml(lot.lote)}</td>
            <td>${escapeHtml(lot.validade)}</td>
            <td>${escapeHtml(lot.localizacao)}</td>
            <td>${escapeHtml(lot.programa)}</td>
            <td class="num">${escapeHtml(lot.qtdDispensada)}</td>
          </tr>`;
      });
      totalQtd += subtotal;

      rows += `
        <tr class="produto-total">
          <td colspan="${COLS - 1}"></td>
          <td class="num"><strong>${subtotal}</strong></td>
        </tr>`;
    });

    const theadHtml = `
      <tr>
        <th>Medicamento</th>
        <th>Apresentação</th>
        <th>Fabricante</th>
        <th>Lote</th>
        <th>Validade</th>
        <th>Localização</th>
        <th>Programa de Saúde</th>
        <th class="num">Qtd Dispensada</th>
      </tr>`;

    const footerHtml = `
      <span>Total Dispensado:</span>
      <span>${totalQtd}</span>`;

    return { theadHtml, rows, footerHtml };
  }

  function buildNotaDispensacao() {
    const numero = findValueBySiblingLabel(document, 'Nº da Dispensação/Fornecimento');
    const dados = extractUsuarioEResponsavel();

    const paciente = {
      nome: dados.paciente[normalizeLabel('Nome completo')] || '',
      cpfCns: dados.paciente[normalizeLabel('CPF/CNS')] || '',
      sexo: dados.paciente[normalizeLabel('Sexo')] || '',
      nascimento: dados.paciente[normalizeLabel('Data de nascimento')] || ''
    };
    const retirada = {
      retiradoPor: dados.retirada[normalizeLabel('Retirado por')] || '',
      nome: dados.retirada[normalizeLabel('Nome completo')] || '',
      cpfCns: dados.retirada[normalizeLabel('CPF/CNS')] || ''
    };
    const dispensadoPor = dados.dispensacao[normalizeLabel('Dispensado por')] || '';

    const prescricao = extractPrescricao();
    const produtos = extractProdutosDispensacao();

    const infoGridHtml = `
      <div><span class="label">Nome do Paciente:</span>${escapeHtml(paciente.nome)}</div>
      <div><span class="label">CPF/CNS:</span>${escapeHtml(paciente.cpfCns)}</div>
      <div><span class="label">Data de Nascimento:</span>${escapeHtml(paciente.nascimento)}</div>
      <div><span class="label">Sexo:</span>${escapeHtml(paciente.sexo)}</div>
      <div style="grid-column: 1 / -1;">
        <span class="label">Prescritor:</span>${escapeHtml(prescricao.prescritorNome)}
        ${prescricao.conselho ? ` — ${escapeHtml(prescricao.conselho)} ${escapeHtml(prescricao.numeroConselho)}/${escapeHtml(prescricao.ufConselho)}` : ''}
        ${prescricao.dataReceita ? `&nbsp;&nbsp; <span class="label">Data da receita:</span>${escapeHtml(prescricao.dataReceita)}` : ''}
      </div>`;

    const { theadHtml, rows, footerHtml } = buildTabelaDispensacao(produtos);

    const blocosExtrasHtml = `
      <div class="bloco-extra">
        <div class="titulo">Identificação de quem retirou</div>
        <div>Retirado por: ${escapeHtml(retirada.retiradoPor)} &nbsp;&nbsp; Nome: ${escapeHtml(retirada.nome)} &nbsp;&nbsp; CPF/CNS: ${escapeHtml(retirada.cpfCns)}</div>
        <div>Parentesco: ______________________ &nbsp;&nbsp; Documento: ______________________</div>
      </div>`;

    const assinaturasHtml = `
      <div class="declaracao">
        <div class="texto"><strong>Declaração:</strong> Declaro que recebi o(s) medicamento(s) descrito(s) acima, bem como fui informado(a) acerca das orientações sobre o correto uso e armazenamento do(s) mesmo(s).</div>
        <div class="assinatura-linha"><div class="linha">${escapeHtml(retirada.nome)}<br>Assinatura de quem retirou</div></div>
      </div>
      <div class="declaracao">
        <div class="texto"><strong>Declaração:</strong> Declaro que foi dispensado o(s) medicamento(s) descrito(s) acima, bem como foram fornecidas as orientações quanto a:</div>
        <div class="checkboxes">
          <label><input type="checkbox">Administração</label>
          <label><input type="checkbox">Interação com medicamentos e efeitos adversos</label>
          <label><input type="checkbox">Armazenagem</label>
          <label><input type="checkbox">Situações especiais (idade, gestação, etc.)</label>
        </div>
        <div class="assinatura-linha"><div class="linha">${escapeHtml(dispensadoPor)}<br>Nome do Dispensador</div></div>
      </div>`;

    return {
      titulo: 'Comprovante de Dispensação',
      numero,
      infoGridHtml,
      theadHtml,
      rows,
      footerHtml,
      blocosExtrasHtml,
      assinaturasHtml,
      orientacao: 'portrait'
    };
  }

  // ---------- página: Posição do estoque (reports/stock-position/stock-position-data) ----------

  function extractEstabelecimentoPorAtributo(qaId) {
    const el = document.querySelector(`[data-qa-id="${qaId}"]`);
    const raw = el ? clean(el.textContent) : '';
    return raw
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  }

  function classifyLoteRow(tr) {
    if (tr.querySelector('.uil-calendar-slash')) return 'expirado';
    if (tr.querySelector('.uil-exclamation-circle')) return 'proximo-vencimento';
    return null;
  }

  function extractProdutosEstoque() {
    const blocos = document.querySelectorAll('.print-item-row');
    const produtos = [];

    blocos.forEach((bloco) => {
      const nomeEl = bloco.querySelector('[data-qa-id="stock-position-data-product-name"]');
      const totalEl = bloco.querySelector('[data-qa-id="stock-position-data-total-quantity"]');
      const nome = nomeEl ? clean(nomeEl.textContent) : '';
      const qtdTotalTexto = totalEl ? clean(totalEl.textContent) : '';
      const qtdTotal = qtdTotalTexto.replace(/^Qtd total:\s*/i, '');

      const table = bloco.querySelector('table');
      const lotes = [];
      if (table) {
        const headers = Array.from(table.querySelectorAll('thead th span')).map((s) => normalizeLabel(s.textContent));
        table.querySelectorAll('tbody tr').forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'));
          if (cells.length < 2) return;
          const lote = {};
          headers.forEach((h, i) => {
            const cell = cells[i];
            if (!cell) return;
            const texto = clean(cell.textContent);
            if (h === normalizeLabel('Fabricante')) lote.fabricante = texto;
            else if (h === normalizeLabel('Nº do lote')) lote.numeroLote = texto;
            else if (h === normalizeLabel('Data de validade')) lote.validade = texto;
            else if (h === normalizeLabel('Programa de saúde')) lote.programa = texto;
            else if (h === normalizeLabel('Endereçamento físico')) lote.localizacao = texto;
            else if (h === normalizeLabel('Valor total')) lote.valorTotal = texto;
            else if (h === normalizeLabel('Qtd estoque')) lote.qtdEstoque = texto;
          });
          lote.alerta = classifyLoteRow(tr);
          lotes.push(lote);
        });
      }

      produtos.push({ nome, qtdTotal, lotes });
    });

    return produtos;
  }

  function buildTabelaEstoque(produtos) {
    const COLS = 7;
    let rows = '';
    let totalGeral = 0;

    produtos.forEach((produto) => {
      rows += `
        <tr class="produto-header">
          <td colspan="${COLS}"><strong>Produto</strong> ${escapeHtml(produto.nome)}</td>
        </tr>`;

      let subtotalQtd = 0;
      let subtotalValor = 0;

      produto.lotes.forEach((lote) => {
        subtotalQtd += parseBRInt(lote.qtdEstoque);
        subtotalValor += parseBRNumber(lote.valorTotal);
        const classeAlerta = lote.alerta ? ` class="alerta-${lote.alerta}"` : '';
        rows += `
          <tr${classeAlerta}>
            <td>${escapeHtml(lote.fabricante)}</td>
            <td>${escapeHtml(lote.numeroLote)}</td>
            <td>${escapeHtml(lote.validade)}</td>
            <td>${escapeHtml(lote.programa)}</td>
            <td>${escapeHtml(lote.localizacao)}</td>
            <td class="num">${escapeHtml(lote.valorTotal)}</td>
            <td class="num">${escapeHtml(lote.qtdEstoque)}</td>
          </tr>`;
      });

      totalGeral += subtotalQtd;

      rows += `
        <tr class="produto-total">
          <td colspan="5"></td>
          <td class="num"><strong>Total: ${formatBRNumber(subtotalValor)}</strong></td>
          <td class="num"><strong>${subtotalQtd}</strong></td>
        </tr>`;
    });

    const theadHtml = `
      <tr>
        <th>Fabricante</th>
        <th>Nº do lote</th>
        <th>Data de validade</th>
        <th>Programa de Saúde</th>
        <th>Localização</th>
        <th class="num">Valor Total</th>
        <th class="num">Qtd Estoque</th>
      </tr>`;

    const footerHtml = `
      <span>Total Geral (Qtd Estoque):</span>
      <span>${totalGeral}</span>`;

    return { theadHtml, rows, footerHtml };
  }

  function buildRelatorioEstoque() {
    const estabelecimento = extractEstabelecimentoPorAtributo('stock-position-data-establishment-name');
    const emitidoPor = findValueBySiblingLabel(document, 'Emitido por (CPF/Nome) :') || findValueBySiblingLabel(document, 'Emitido por (CPF/Nome)');
    const dataEmissao = findValueBySiblingLabel(document, 'Data e hora da emissão:') || findValueBySiblingLabel(document, 'Data e hora da emissão');
    const produtos = extractProdutosEstoque();

    const infoGridHtml = `
      <div style="grid-column: 1 / -1;"><span class="label">Estabelecimento:</span>${escapeHtml(estabelecimento)}</div>
      <div><span class="label">Emitido por:</span>${escapeHtml(emitidoPor)}</div>
      <div><span class="label">Data e hora da emissão:</span>${escapeHtml(dataEmissao)}</div>`;

    const { theadHtml, rows, footerHtml } = buildTabelaEstoque(produtos);

    const blocosExtrasHtml = `
      <div class="legenda-estoque">
        <span class="alerta-proximo-vencimento">Lote com validade menor que 90 dias</span>
        <span class="alerta-expirado">Lote com validade expirada</span>
      </div>`;

    return {
      titulo: 'Relatório de Posição de Estoque',
      tituloPagina: 'Relatório de Posição de Estoque',
      numero: '',
      infoGridHtml,
      theadHtml,
      rows,
      footerHtml,
      blocosExtrasHtml,
      assinaturasHtml: '',
      orientacao: 'landscape'
    };
  }

  // ---------- página: Relatório de Movimentação (reports/movements/print) ----------
  // Esta tela usa data-qa-id em quase todos os campos, então a extração é
  // direta por atributo em vez de casar rótulo/valor por texto.

  function extractGruposMovimentacao() {
    const groups = document.querySelectorAll('.print-movement-item-group');
    const produtos = [];

    groups.forEach((group) => {
      const getById = (id) => {
        const el = group.querySelector(`[data-qa-id="${id}"]`);
        return el ? clean(el.textContent) : '';
      };

      const produto = {
        nome: getById('reports-movements-data-item-product-value'),
        unidade: getById('reports-movements-data-item-unit-value'),
        lote: getById('reports-movements-data-item-batch-value'),
        validade: getById('reports-movements-data-item-validity-value'),
        estoque: getById('reports-movements-data-item-stock-value'),
        valor: getById('reports-movements-data-item-value-value'),
        movimentos: []
      };

      group.querySelectorAll('[data-qa-id^="reports-movements-data-item-table-row-"]').forEach((tr) => {
        const cell = (suffix) => {
          const td = tr.querySelector(`[data-qa-id="reports-movements-data-item-table-cell-${suffix}"]`);
          return td ? clean(td.textContent) : '';
        };
        produto.movimentos.push({
          tipo: cell('entry-or-outbound'),
          data: cell('date'),
          tipoMovimentacao: cell('movement-type'),
          qtd: cell('quantity'),
          valor: cell('value'),
          saida: !!tr.querySelector('.bg-danger')
        });
      });

      produtos.push(produto);
    });

    return produtos;
  }

  function buildTabelaMovimentacao(produtos) {
    const COLS = 5;
    let rows = '';
    let totalEntradasGeral = 0;
    let totalSaidasGeral = 0;

    produtos.forEach((produto) => {
      rows += `
        <tr class="produto-header">
          <td colspan="${COLS}">
            <strong>Produto</strong> ${escapeHtml(produto.nome)}
            ${produto.unidade ? `&nbsp;&nbsp;<span class="produto-extra">Unidade: ${escapeHtml(produto.unidade)}</span>` : ''}
            &nbsp;&nbsp;<span class="produto-extra">Lote: ${escapeHtml(produto.lote)} · Validade: ${escapeHtml(produto.validade)}</span>
          </td>
        </tr>`;

      let totalEntradas = 0;
      let totalSaidas = 0;

      produto.movimentos.forEach((mov) => {
        const qtd = parseBRInt(mov.qtd);
        if (mov.saida) totalSaidas += qtd;
        else totalEntradas += qtd;

        rows += `
          <tr${mov.saida ? ' class="linha-saida"' : ''}>
            <td>${escapeHtml(mov.tipo)}</td>
            <td>${escapeHtml(mov.data)}</td>
            <td>${escapeHtml(mov.tipoMovimentacao)}</td>
            <td class="num">${escapeHtml(mov.qtd)}</td>
            <td class="num">${escapeHtml(mov.valor)}</td>
          </tr>`;
      });

      // O campo "Estoque" da tela só reflete um lote, mesmo quando a tabela
      // acima já junta as movimentações de vários lotes do mesmo produto.
      // Por isso o estoque atual é calculado a partir dos próprios
      // lançamentos (entradas - saídas), considerando todos os lotes.
      const estoqueAnterior = 0;
      const estoqueAtual = estoqueAnterior + totalEntradas - totalSaidas;
      totalEntradasGeral += totalEntradas;
      totalSaidasGeral += totalSaidas;

      rows += `
        <tr class="produto-total">
          <td colspan="3">Estoque anterior: ${estoqueAnterior} &nbsp;&nbsp; Entradas: +${totalEntradas} &nbsp;&nbsp; Saídas: -${totalSaidas}</td>
          <td class="num"><strong>Estoque atual</strong></td>
          <td class="num"><strong>${estoqueAtual}</strong></td>
        </tr>`;
    });

    const theadHtml = `
      <tr>
        <th>E/S</th>
        <th>Data</th>
        <th>Tipo Movimentação</th>
        <th class="num">Qtd.</th>
        <th class="num">Valor</th>
      </tr>`;

    const footerHtml = `
      <span>Total Entradas: +${totalEntradasGeral}</span>
      <span>Total Saídas: -${totalSaidasGeral}</span>`;

    return { theadHtml, rows, footerHtml };
  }

  function buildRelatorioMovimentacao() {
    const estabelecimento = extractEstabelecimentoPorAtributo('reports-movements-data-establishment-value');
    const periodoEl = document.querySelector('[data-qa-id="reports-movements-data-date-range-label"]');
    const periodo = periodoEl ? clean(periodoEl.textContent) : '';
    const emitidoPorEl = document.querySelector('[data-qa-id="reports-movements-data-footer-issued-by-value"]');
    const dataEmissaoEl = document.querySelector('[data-qa-id="reports-movements-data-footer-date-time-value"]');

    const infoGridHtml = `
      <div style="grid-column: 1 / -1;"><span class="label">Estabelecimento:</span>${escapeHtml(estabelecimento)}</div>
      <div><span class="label">Período:</span>${escapeHtml(periodo)}</div>
      <div><span class="label">Emitido por:</span>${escapeHtml(emitidoPorEl ? clean(emitidoPorEl.textContent) : '')}</div>
      <div><span class="label">Data e hora da emissão:</span>${escapeHtml(dataEmissaoEl ? clean(dataEmissaoEl.textContent) : '')}</div>`;

    const produtos = extractGruposMovimentacao();
    const { theadHtml, rows, footerHtml } = buildTabelaMovimentacao(produtos);

    return {
      titulo: 'Relatório de Movimentação',
      tituloPagina: 'Relatório de Movimentação',
      numero: '',
      infoGridHtml,
      theadHtml,
      rows,
      footerHtml,
      blocosExtrasHtml: '',
      assinaturasHtml: '',
      orientacao: 'landscape'
    };
  }

  // ---------- montagem final da nota (comum a todas as telas) ----------

  function buildNotaHtml(nota, instituicao, logoUrl) {
    const headerDate = formatHeaderDate(new Date());
    const tituloPagina = nota.tituloPagina || `Nota de Distribuição - ${nota.numero}`;
    const assinaturasHtml = nota.assinaturasHtml !== undefined ? nota.assinaturasHtml : `
  <table class="assinaturas">
    <tr class="linha-titulo">
      <td>Solicitado por:</td>
      <td>Entregue por:</td>
      <td>Recebido por:</td>
    </tr>
    <tr>
      <td>Data:</td>
      <td>Data:</td>
      <td>Data:</td>
    </tr>
  </table>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(tituloPagina)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 20px; }
  .cabecalho { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .cabecalho .logo img { height: 60px; }
  .cabecalho .titulo-orgao { flex: 1; text-align: center; font-weight: bold; }
  .cabecalho .titulo-orgao .principal { font-size: 13px; }
  .cabecalho .data-pagina { text-align: right; font-size: 10px; white-space: nowrap; }
  h1.titulo-relatorio { text-align: center; font-size: 14px; margin: 6px 0 14px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 10px; font-size: 11px; }
  .info-grid .label { font-weight: bold; margin-right: 4px; }
  table.produtos { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
  table.produtos th, table.produtos td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  table.produtos th { background: #eee; font-weight: bold; }
  table.produtos td.num, table.produtos th.num { text-align: right; }
  tr.produto-header td { background: #f5f5f5; font-size: 10.5px; }
  tr.produto-header .produto-extra { font-weight: normal; color: #333; }
  tr.produto-total td { border-top: 1px solid #000; }
  .total-relatorio { display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; font-weight: bold; font-size: 11px; }
  table.assinaturas { margin-top: 40px; width: 100%; border-collapse: collapse; }
  table.assinaturas td { width: 33.33%; padding-top: 30px; border-top: 1px solid #000; font-size: 11px; vertical-align: top; }
  table.assinaturas .linha-titulo td { border-top: none; padding-top: 0; font-weight: bold; }
  .bloco-extra { margin-top: 14px; border: 1px solid #999; padding: 8px 10px; font-size: 11px; }
  .bloco-extra .titulo { font-weight: bold; margin-bottom: 4px; }
  .declaracao { margin-top: 16px; font-size: 10.5px; }
  .declaracao .texto { margin-bottom: 8px; }
  .checkboxes { display: flex; flex-wrap: wrap; gap: 6px 30px; margin-bottom: 10px; }
  .checkboxes label { display: flex; align-items: center; gap: 6px; }
  .checkboxes input[type=checkbox] { width: 12px; height: 12px; }
  .assinatura-linha { margin-top: 36px; text-align: center; }
  .assinatura-linha .linha { display: inline-block; border-top: 1px solid #000; min-width: 60%; margin: 0 auto; padding-top: 4px; }
  tr.alerta-proximo-vencimento td { background: rgba(255, 165, 0, 0.15); }
  tr.alerta-expirado td { background: rgba(255, 0, 0, 0.12); }
  .legenda-estoque { display: flex; gap: 24px; margin-top: 10px; font-size: 10px; }
  .legenda-estoque span { padding: 2px 8px; border-radius: 3px; }
  .legenda-estoque .alerta-proximo-vencimento { background: rgba(255, 165, 0, 0.15); }
  .legenda-estoque .alerta-expirado { background: rgba(255, 0, 0, 0.12); }
  tr.linha-saida td { background: rgba(255, 0, 0, 0.08); }
  @media print { body { padding: 0; } @page { size: A4 ${nota.orientacao === 'portrait' ? 'portrait' : 'landscape'}; margin: 12mm; } }
</style>
</head>
<body>
  <div class="cabecalho">
    <div class="logo">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo">` : ''}</div>
    <div class="titulo-orgao">
      <div class="principal">${escapeHtml(instituicao.cidade)} - ${escapeHtml(instituicao.uf)}</div>
      <div>MINISTÉRIO DA SAÚDE</div>
      <div>PREFEITURA MUNICIPAL DE ${escapeHtml(instituicao.cidade)}</div>
      <div>SECRETARIA MUNICIPAL DE SAÚDE</div>
      <div>${escapeHtml(instituicao.estabelecimento)}</div>
    </div>
    <div class="data-pagina">
      <div>${headerDate}</div>
      <div>Página 1 de 1</div>
    </div>
  </div>

  <h1 class="titulo-relatorio">${escapeHtml(nota.titulo)}</h1>

  <div class="info-grid">
    ${nota.infoGridHtml}
  </div>

  ${nota.theadHtml ? `
  <table class="produtos">
    <thead>
      ${nota.theadHtml}
    </thead>
    <tbody>
      ${nota.rows}
    </tbody>
  </table>` : ''}

  ${nota.footerHtml ? `
  <div class="total-relatorio">
    ${nota.footerHtml}
  </div>` : ''}

  ${nota.blocosExtrasHtml || ''}

  ${assinaturasHtml}
</body>
</html>`;
  }

  function detectarTipoPagina() {
    const path = window.location.pathname;
    if (path.includes('/transaction/expenses/expensesData/')) return 'saida';
    if (path.includes('/transaction/requests/attend/details/')) return 'requisicao';
    if (path.includes('/dispensation/dispensation-data/')) return 'dispensacao';
    if (path.includes('/reports/stock-position/stock-position-data')) return 'estoque';
    if (path.includes('/reports/movements/print')) return 'movimentacao';
    return null;
  }

  const ROTULO_BOTAO = {
    saida: 'Gerar Nota',
    requisicao: 'Gerar Nota',
    dispensacao: 'Gerar Nota',
    estoque: 'Gerar Relatório',
    movimentacao: 'Gerar Relatório'
  };

  function gerarNota() {
    try {
      const tipoPagina = detectarTipoPagina();
      let nota;
      if (tipoPagina === 'saida') {
        nota = buildNotaSaida();
      } else if (tipoPagina === 'requisicao') {
        nota = buildNotaRequisicao();
      } else if (tipoPagina === 'dispensacao') {
        nota = buildNotaDispensacao();
      } else if (tipoPagina === 'estoque') {
        nota = buildRelatorioEstoque();
      } else if (tipoPagina === 'movimentacao') {
        nota = buildRelatorioMovimentacao();
      } else {
        alert('Essa tela ainda não é suportada pela extensão.');
        return;
      }

      const instituicao = extractInstituicao();
      const logoUrl = extractLogoUrl();
      const html = buildNotaHtml(nota, instituicao, logoUrl);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('O navegador bloqueou a abertura da nota. Permita pop-ups para este site e tente novamente.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      const triggerPrint = () => {
        printWindow.focus();
        printWindow.print();
      };

      const img = printWindow.document.querySelector('img');
      if (img && !img.complete) {
        img.addEventListener('load', triggerPrint, { once: true });
        img.addEventListener('error', triggerPrint, { once: true });
        setTimeout(triggerPrint, 1500);
      } else {
        setTimeout(triggerPrint, 200);
      }
    } catch (err) {
      console.error('[Gerar Nota] Erro ao gerar nota:', err);
      alert('Não foi possível gerar a nota. Veja o console do navegador (F12) para detalhes.');
    }
  }

  function injectButton() {
    if (document.querySelector('.esusaf-gerar-nota-btn')) return;

    const tipoPagina = detectarTipoPagina();
    if (!tipoPagina) return;

    const printButton = document.querySelector('button[data-qa-id*="print"]');
    if (!printButton) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'botao azul informacao esusaf-gerar-nota-btn';
    btn.innerHTML = `<span class="mx-2 d-inline-flex align-items-center gap-1">${ROTULO_BOTAO[tipoPagina]}</span>`;
    btn.addEventListener('click', gerarNota);

    printButton.parentElement.insertBefore(btn, printButton);
  }

  function init() {
    injectButton();
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
