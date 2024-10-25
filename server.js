const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function getOrCreateDriveFolder(folderName) {
    const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const response = await drive.files.list({ q: query, fields: 'files(id, name)' });
    if (response.data.files.length > 0) {
        return response.data.files[0].id;
    }
    const folder = await drive.files.create({
        resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
    });
    return folder.data.id;
}

async function uploadFileToDrive(filePath, fileName, folderId) {
    try {
        await drive.files.create({
            requestBody: { name: fileName, parents: [folderId], mimeType: 'application/pdf' },
            media: { mimeType: 'application/pdf', body: fs.createReadStream(filePath) }
        });
    } catch (error) {
        console.error(`Erro ao enviar arquivo para o Google Drive: ${error}`);
        throw error;
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads', req.body.protocolo);
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const prefix = file.fieldname === 'comprovante' ? 'COMP' : 'DOC';
        const formattedDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        cb(null, `${prefix}_${req.body.protocolo}_${formattedDate}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage, limits: { files: 20 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.post('/upload', upload.fields([
    { name: 'documento', maxCount: 20 },
    { name: 'comprovante', maxCount: 20 }
]), async (req, res) => {
    try {
        const { protocolo } = req.body;
        const folderId = await getOrCreateDriveFolder(protocolo);
        const uploadPromises = [];

        (req.files.documento || []).forEach((file) => {
            const filePath = path.join(__dirname, 'uploads', protocolo, file.filename);
            const fileName = file.filename;
            uploadPromises.push(uploadFileToDrive(filePath, fileName, folderId));
        });
        (req.files.comprovante || []).forEach((file) => {
            const filePath = path.join(__dirname, 'uploads', protocolo, file.filename);
            const fileName = file.filename;
            uploadPromises.push(uploadFileToDrive(filePath, fileName, folderId));
        });

        await Promise.all(uploadPromises);
        res.redirect(`/success/${protocolo}`);
    } catch (error) {
        console.error('Erro ao processar o upload:', error.message);
        res.status(500).send(`Erro ao processar o upload: ${error.message}`);
    }
});

app.get('/success/:protocolo', (req, res) => res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documentos Enviados com Sucesso</title>
        <style>
            @font-face {
                font-family: 'FonteCabecalho';
                src: url('/fonts/MinhaFonteCabecalho.ttf') format('truetype');
            }
            @font-face {
                font-family: 'FonteCorpo';
                src: url('/fonts/MinhaFonteCorpo.ttf') format('truetype');
            }
            body {
                font-family: 'FonteCorpo', Arial, sans-serif;
                background: linear-gradient(180deg, #0044cc, #000000);
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
                font-family: 'FonteCabecalho', Arial, sans-serif;
                margin-bottom: 20px;
            }
            p {
                font-size: 20px;
                color: #ffffff;
                margin-bottom: 40px;
            }
            .btn {
                padding: 15px 30px;
                background-color: #0044cc;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-size: 18px;
                display: inline-block;
            }
            .btn:hover {
                background-color: #003399;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Documentos enviados com sucesso!</h1>
            <p>Seu protocolo ${req.params.protocolo} será analisado. Aguarde nosso retorno.</p>
            <a href="/" class="btn">Voltar à página inicial</a>
        </div>
    </body>
    </html>
`));

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));

