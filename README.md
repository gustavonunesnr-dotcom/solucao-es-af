# Solução ES-AF

> Extensão de navegador **não-oficial** para o [e-SUS AF](https://esusaf.ifpb.edu.br) (Assistência Farmacêutica). Sem vínculo com o Ministério da Saúde, o IFPB ou qualquer órgão do governo.

O e-SUS AF gera notas e relatórios genéricos, difíceis de usar no dia a dia de quem trabalha em uma farmácia/CAF. Esta extensão adiciona um botão nas principais telas do sistema para gerar documentos prontos para impressão, no layout que a prefeitura/farmácia já usa no papel.

## O que ela faz

| Tela do e-SUS AF | O que a extensão gera |
|---|---|
| Dados da saída | Nota de distribuição, com tabela de produtos/lotes e campo de assinatura |
| Atender Requisição | Nota de distribuição (mesma lógica, sem valores) |
| Dispensação/Fornecimento | Recibo para o paciente assinar, com declarações de recebimento |
| Posição de Estoque | Relatório de estoque agrupado por produto, com alerta de validade próxima/vencida |
| Relatório de Movimentação | Relatório com entradas, saídas e saldo por produto |

Todo documento sai com o cabeçalho institucional (nome do estabelecimento, cidade/UF) lido automaticamente do perfil selecionado na hora, sem nada fixo no código.

## Instalação (modo desenvolvedor)

A extensão ainda não está na Chrome Web Store. Para instalar agora:

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions` no Chrome.
3. Ative o **"Modo do desenvolvedor"** (canto superior direito).
4. Clique em **"Carregar sem compactação"** e selecione a pasta do projeto.
5. Acesse o e-SUS AF normalmente — o botão "Gerar Nota"/"Gerar Relatório" aparece nas telas suportadas, ao lado do botão "Imprimir".

## Privacidade

Nenhum dado sai do seu navegador — tudo é processado localmente. Veja a [política de privacidade completa](./PRIVACY.md).

## Avisos

- Projeto de código aberto, mantido de forma independente e sem fins lucrativos.
- Sempre confira os documentos gerados antes de usar oficialmente — a extensão lê a estrutura da tela do sistema e pode ser afetada por atualizações do e-SUS AF.
- Não é um produto oficial do Ministério da Saúde, do e-SUS ou do IFPB.

## Contribuindo

Encontrou uma tela que ainda não é suportada, ou um dado que saiu errado? Abra uma *issue* descrevendo a tela e, se possível, anexe o HTML da página (no Chrome: Ctrl+S → "Página da Web, completa").

## Licença

MIT — veja [LICENSE](./LICENSE).
