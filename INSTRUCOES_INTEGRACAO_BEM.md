# Guia de Integração Automática e Segura (SISTEMA BEM -> Render) 🇧🇷

Este documento explica como automatizar em tempo real o envio de resultados gerados pelo **SISTEMA BEM de BMX** do seu computador local para o seu sistema de resultados online hospedado no Render.

---

## 🛠️ O Método Mais Prático, Seguro e Automático

Como navegadores de internet (como o Google Chrome, Edge ou Firefox) possuem restrições de segurança que impedem que páginas web acessem pastas locais do seu computador em segundo plano, a melhor solução é usar um **Script Monitor Local (em PowerShell ou Python)** rodando no seu computador de cronometragem.

O script funciona da seguinte forma:
1. Ele fica assistindo em tempo real a pasta do seu computador onde o **SISTEMA BEM** exporta os relatórios ou arquivos de texto (`.txt` ou `.html`).
2. No milissegundo em que o SISTEMA BEM gera ou atualiza um arquivo naquela pasta, o script lê o documento e o transmite por criptografia segura em plano de fundo para o servidor do Render utilizando a sua **Chave de API (token)** para autenticar.
3. Os resultados aparecem instantaneamente na arquibancada para todos os celulares e computadores conectados!

---

## 🔐 Passo 1: Configurar a Chave de Segurança (API Key) no Navegador e no Render

Para impedir que terceiros mal-intencionados modifiquem os resultados do campeonato, o sistema exige uma chave de autenticação para autorizar o recebimento automático de arquivos.

### No painel do Render (como visto no seu print):
1. **Acesse as propriedades do seu Web Service no Render** e vá até a aba **Environment** (onde você tirou a foto).
2. Clique no botão **Edit** no canto superior direito das variáveis de ambiente.
3. Clique em **Add Environment Variable**.
4. Defina o campo **KEY** como: `API_KEY`
5. Defina o campo **VALUE** com uma senha secreta segura que você vai usar (ex: `brbmx2026`).
6. Clique em **Save Changes**. O Render vai reiniciar a aplicação com a nova configuração de segurança ativa!

### No seu Navegador (aba de Administrador):
1. Acesse seu site no Render com o painel de administrador ativado adicionando `?admin=true` ao final da URL.
2. No menu superior, sob o título **Links Oficiais de Transmissão / Divulgação**, haverá um novo painel chamado **Chave de API / Token de Segurança**.
3. Insira exatamente a senha que você configurou no Render (ex: `brbmx2026`). Ela será guardada de forma segura na memória privada do seu navegador (localStorage) para permitir que você faça alterações manuais ou pelo painel do operador de cronometragem.

---

## 🚀 Passo 2: O Script Sincronizador de Pastas

Escolha o método compatível com o seu sistema operacional de cronometragem (geralmente Windows).

### Opção A: PowerShell (Recomendado para Windows - Não requer nenhuma instalação)

O PowerShell já vem instalado nativamente em qualquer computador Windows.

1. No seu computador local, crie uma pasta onde deseja exportar os relatórios do SISTEMA BEM de BMX, por exemplo: `C:\SISTEMA_BEM\Resultados`
2. No Windows, abra o menu iniciar, digite **PowerShell** e clique nele para abrir.
3. Crie um arquivo chamado `SincronizadorBEM.ps1` executando o bloco abaixo ou colando em um bloco de notas e salvando como `.ps1`.

Abra o arquivo em um editor e cole o script abaixo, ajustando as variáveis `$FolderToWatch`, `$RenderUrl` e `$ApiKey`:

```powershell
# ==============================================================================
# SCRIPT DE MONITORAMENTO AUTOMÁTICO - SISTEMA BEM -> RENDER (BMX BRASIL)
# ==============================================================================
# Monitora uma pasta local e sincroniza no ato arquivos gerados pelo SISTEMA BEM.

# ----- CONFIGURAÇÃO -----
$global:FolderToWatch = "C:\SISTEMA_BEM\Resultados"  # 📂 PASTA ONDE O BEM SALVA OS ARQUIVOS 
$global:RenderUrl     = "https://resultados-ao-vivo-integracao-bem.onrender.com" # 🌐 SEU SITE NO RENDER
$global:ApiKey        = "BrAsiL_BMX_2026_SeCrEt_StAfF"              # 🔐 CHAVE DE SEGURANÇA CONFIGURADA NO RENDER

# Testar se a pasta de destino existe, caso contrário criá-la
if (!(Test-Path -Path $global:FolderToWatch)) {
    New-Item -ItemType Directory -Force -Path $global:FolderToWatch
    Write-Host "Pasta de monitoria criada com sucesso em: $global:FolderToWatch" -ForegroundColor Green
}

Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host " INICIANDO MONITOR DO SISTEMA BEM DE CRIOPRESENÇA E TEMPOS " -ForegroundColor Cyan
Write-Host " Monitorando pasta local: $global:FolderToWatch" -ForegroundColor Yellow
Write-Host " Servidor Web de Destino: $global:RenderUrl" -ForegroundColor Yellow
Write-Host " Pressione [Ctrl+C] na janela do PowerShell para parar o monitoramento." -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Yellow

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $global:FolderToWatch
# Filtra por arquivos gerados típicos de relatórios esportivos (texto ou de exportação)
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true  # Ativado para monitorar subpastas como a Copa Dyamantina!
$watcher.EnableRaisingEvents = $true

# Função de upload seguro disparada por evento do sistema de arquivos
$Action = {
    param($sender, $eventArgs)
    $path = $eventArgs.FullPath
    $name = $eventArgs.Name
    $changeType = $eventArgs.ChangeType
    
    # Ignorar arquivos temporários ocultos ou vazios
    if ($name -match 'tmp|~\$|^\.') { return }
    
    # Pequena pausa para garantir que o SISTEMA BEM terminou de escrever totalmente o arquivo
    Start-Sleep -Milliseconds 350
    
    try {
        if (Test-Path $path) {
            $content = Get-Content -Raw -Path $path -Encoding UTF8
            if ([string]::IsNullOrWhiteSpace($content)) { return }
            
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Arquivo detectado: $name. Enviando para nuvem..." -ForegroundColor Yellow
            
            # Montagem estruturada do corpo da requisição
            # Detecta se é arquivo de inscritos ou resultados pelo nome do arquivo ou conteúdo
            $parseType = "RESULTS"
            if ($name -like "*pilotos*" -or $name -like "*inscritos*" -or $content -like "*inscritos*") {
                $parseType = "RIDERS"
            }
            
            $payload = @{
                textContent = $content
                parseType = $parseType
            } | ConvertTo-Json -Depth 5 -Compress
            
            # API Call com Cabeçalho de Autenticação Seguro
            $headers = @{
                "Content-Type" = "application/json"
                "x-api-key"    = $global:ApiKey
            }
            
            $urlEnvio = "$($global:RenderUrl)/api/race/upload-bem-text"
            $response = Invoke-RestMethod -Method Post -Uri $urlEnvio -Body $payload -Headers $headers -TimeoutSec 15
            
            if ($response.success) {
                Write-Host "✅ SUCESSO! $name foi sincronizado online!" -ForegroundColor Green
                Write-Host "   Mensagem: $($response.message)" -ForegroundColor Gray
            } else {
                Write-Host "❌ Falha no processamento: $($response.error)" -ForegroundColor Red
            }
        }
    }
    catch {
        Write-Host "❌ Erro ao enviar dados: $_" -ForegroundColor Red
    }
}

# Associa eventos de criação e modificação de arquivos na pasta
Register-ObjectEvent $watcher "Created" -Action $Action | Out-Null
Register-ObjectEvent $watcher "Changed" -Action $Action | Out-Null

while ($true) {
    Start-Sleep -Seconds 1
}
```

---

### Opção B: Python Sincronizador (Caso prefira multiplataforma)

Se decidir usar Python, certifique-se de instalar a biblioteca watchdog (`pip install watchdog requests`):

Salve como `sincronizar.py`:

```python
import time
import os
import requests
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ----- CONFIGURAÇÃO -----
DIRECTORY_TO_WATCH = r"C:\SISTEMA_BEM\Resultados"
RENDER_URL = "https://resultados-ao-vivo-integracao-bem.onrender.com"
API_KEY = "SUA_SENHA_AQUI"

class BemHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.is_directory or "tmp" in event.src_path:
            return
        self.process_file(event.src_path)

    def on_created(self, event):
        if event.is_directory or "tmp" in event.src_path:
            return
        self.process_file(event.src_path)

    def process_file(self, file_path):
        time.sleep(0.5) # Aguarda gravação completa
        try:
            if not os.path.exists(file_path):
                return
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if not content.strip():
                return
            
            filename = os.path.basename(file_path)
            print(f"Detectado novo arquivo: {filename} - Enviando...")
            
            parse_type = "RESULTS"
            if "piloto" in filename.lower() or "inscrito" in filename.lower() or "pilotos" in content.lower():
                parse_type = "RIDERS"

            payload = {
                "textContent": content,
                "parseType": parse_type
            }
            headers = {
                "Content-Type": "application/json",
                "x-api-key": API_KEY
            }
            
            res = requests.post(f"{RENDER_URL}/api/race/upload-bem-text", json=payload, headers=headers, timeout=12)
            if res.status_code == 200 and res.json().get("success"):
                print(f"✅ Sucesso na sincronização online de {filename}!")
                print(f"💬 Resposta: {res.json().get('message')}")
            else:
                print(f"❌ Erro resposta HTTP do servidor: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"❌ Erro operacional de envio: {e}")

if __name__ == "__main__":
    if not os.path.exists(DIRECTORY_TO_WATCH):
        os.makedirs(DIRECTORY_TO_WATCH)
    
    event_handler = BemHandler()
    observer = Observer()
    observer.schedule(event_handler, path=DIRECTORY_TO_WATCH, recursive=False)
    observer.start()
    print(f"=========================================================")
    print(f" MONITOR DE CRONOMETRAGEM ATIVO ")
    print(f" Observando a pasta local: {DIRECTORY_TO_WATCH}")
    print(f" Servidor Web no Render: {RENDER_URL}")
    print(f" Pressione Ctrl+C para encerrar o aplicativo local.")
    print(f"=========================================================")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
```

---

## 🎯 Resumo da Operação no Dia da Corrida

1. Abra o script monitor no computador de cronometragem da pista (PowerShell ou Python). Ele ficará rodando no terminal passivamente.
2. Abra o **SISTEMA BEM de BMX** no computador local.
3. Nas configurações de exportação de dados do **SISTEMA BEM**, configure para salvar as súmulas/relatórios na pasta `C:\SISTEMA_BEM\Resultados`.
4. À medida que as baterias terminarem e os resultados forem sendo gerados na pasta pelo cronometrista, o script os transmitirá de forma 100% invisível em menos de um segundo para o Render!
5. Os atletas, pais e o público geral na arquibancada acompanham os pontos, baterias do dia e classificações ao vivo atualizadas em tempo real em seus smartphones.
