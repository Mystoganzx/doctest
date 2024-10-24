const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const DEFAULT_PORT = 3000;

// Configuração do armazenamento dos arquivos em subpastas
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const protocolo = req.body.protocolo;
        const uploadDir = path.join('uploads', protocolo); // Cria o caminho da pasta com o número do protocolo

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // Define a pasta para salvar o arquivo
    },
    filename: (req, file, cb) => {
        const date = new Date();
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getFullYear()}`;
        const fileName = `DOC_${formattedDate}${path.extname(file.originalname)}`;
        cb(null, fileName); // Nome do arquivo gerado
    }
});

const upload = multer({ storage: storage });

// Servir os arquivos da pasta "public"
app.use(express.static('public'));

// Parser para receber dados de formulários
app.use(express.urlencoded({ extended: true }));

// Página de sucesso para exibir a mensagem após o envio
app.get('/success/:protocolo', (req, res) => {
    const protocolo = req.params.protocolo;
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Documentos Enviados com Sucesso</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: linear-gradient(180deg, #0044cc, #000000); /* Degradê azul para preto */
                    color: #f0f0f0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    padding: 0;
                }

                .container {
                    background-color: rgba(0, 0, 0, 0.8);
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                    text-align: center;
                    max-width: 700px;
                    width: 100%;
                }

                h1 {
                    font-size: 48px;
                    color: #00aaff;
                    margin-bottom: 20px;
                }

                p {
                    font-size: 20px;
                    color: #ffffff;
                    margin-bottom: 20px;
                }

                .btn {
                    margin-top: 20px;
                    padding: 10px 20px;
                    background-color: #0044cc;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    font-size: 18px;
                }

                .btn:hover {
                    background-color: #003399;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Documentos enviados com sucesso!</h1>
                <p>Seu protocolo ${protocolo} será analisado. Aguarde nosso retorno.</p>
                <a href="/" class="btn">Voltar à página inicial</a>
            </div>
        </body>
        </html>
    `);
});

// Endpoint de upload para múltiplos arquivos por campo
app.post('/upload', upload.fields([
    { name: 'documento', maxCount: 10 }, 
    { name: 'comprovante', maxCount: 10 }
]), (req, res) => {
    const protocolo = req.body.protocolo;

    if (!protocolo || (!req.files['documento'] && !req.files['comprovante'])) {
        return res.status(400).send('Número de protocolo ou arquivos não enviados.');
    }

    res.redirect(`/success/${protocolo}`);
});

// Função para iniciar o servidor
const startServer = (port) => {
    const server = app.listen(port, () => {
        console.log(`Servidor rodando em http://localhost:${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Porta ${port} já está em uso. Tentando outra porta...`);
            startServer(port + 1); // Tenta usar a próxima porta disponível
        } else {
            console.error('Erro no servidor:', err);
        }
    });
};

// Iniciar o servidor
startServer(DEFAULT_PORT);
