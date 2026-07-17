# Política de Privacidade — Solução ES-AF

Última atualização: 17/07/2026

A extensão **Solução ES-AF** não coleta, armazena, transmite ou compartilha nenhum dado com terceiros.

## Como a extensão funciona

- Roda apenas dentro das páginas do sistema e-SUS AF (`esusaf.ifpb.edu.br`) que você já está logado.
- Lê os dados que já estão visíveis na tela (nome do paciente, produtos, quantidades, etc.) diretamente do seu navegador.
- Usa esses dados só para montar, na hora, uma nota/relatório formatado, que abre numa nova aba do seu próprio navegador para impressão.

## O que a extensão NÃO faz

- Não envia nenhuma informação para servidores externos.
- Não usa Google Analytics, cookies de rastreamento ou qualquer ferramenta de coleta de dados.
- Não armazena nada em disco, banco de dados ou "nuvem" — tudo é processado localmente, na memória do navegador, e descartado quando você fecha a aba.
- Não tem acesso a outras abas, outros sites ou histórico de navegação.
- Não executa código baixado de servidores externos — todo o código roda a partir dos arquivos instalados da extensão.

## Dados sensíveis (LGPD)

Como a extensão trabalha dentro do sistema e-SUS AF, ela pode "ver" dados sensíveis, como CPF, nome e informações de saúde de pacientes — exatamente como esses dados já aparecem na tela do sistema. Esses dados nunca saem do seu computador: a extensão apenas reorganiza essas informações visualmente para gerar um documento de impressão, sob controle exclusivo de quem está usando o navegador.

## Permissões solicitadas

A extensão não solicita nenhuma permissão especial do Chrome (sem acesso a `storage`, `tabs`, `histórico de navegação`, `webRequest`, etc.). O único acesso declarado é a leitura da própria página nas URLs do e-SUS AF listadas no `manifest.json`.

## Contato

Dúvidas sobre esta política: francisco.mesquita@axoware.com.br

## Aviso importante

Esta extensão é um projeto independente e não possui vínculo com o Ministério da Saúde, o e-SUS, o IFPB ou qualquer órgão governamental. Use por sua conta e risco; sempre confira os dados gerados antes de usar oficialmente.
