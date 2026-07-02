const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });
  return auth;
}

async function findFolder(drive, name, parentId) {
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const res = await drive.files.list({
    q,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files && res.data.files.length > 0 ? res.data.files[0].id : null;
}

async function findFolderByGroupName(drive, groupName, parentId) {
  let q = `mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const res = await drive.files.list({
    q,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1000,
  });
  const target = groupName.trim().toLowerCase();
  const files = res.data.files || [];
  const match = files.find(f => (f.name || '').toLowerCase().includes(target));
  return match ? match.id : null;
}

async function createFolder(drive, name, parentId) {
  const meta = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) meta.parents = [parentId];
  const res = await drive.files.create({
    requestBody: meta,
    fields: 'id',
    supportsAllDrives: true,
  });
  return res.data.id;
}

async function getOrCreateFolder(drive, name, parentId) {
  let id = await findFolder(drive, name, parentId);
  if (!id) id = await createFolder(drive, name, parentId);
  return id;
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm({ multiples: true, maxFileSize: 50 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseForm(req);

    const parentFolderId = fields.parentFolderId || null;
    const folderPath = fields.folderPath ? JSON.parse(fields.folderPath) : [];
    const groupMatchName = fields.groupMatchName ? (Array.isArray(fields.groupMatchName) ? fields.groupMatchName[0] : fields.groupMatchName) : null;

    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    let currentParent = parentFolderId || null;
    let firstFolderId = null;
    for (let i = 0; i < folderPath.length; i++) {
      const folderName = folderPath[i];
      if (i === 0 && groupMatchName) {
        // Group folder: 1) exact name match, 2) group-name-contains match, 3) create
        let id = await findFolder(drive, folderName, currentParent);
        if (!id) id = await findFolderByGroupName(drive, groupMatchName, currentParent);
        if (!id) id = await createFolder(drive, folderName, currentParent);
        currentParent = id;
      } else {
        currentParent = await getOrCreateFolder(drive, folderName, currentParent);
      }
      if (!firstFolderId) firstFolderId = currentParent;
    }

    const folderLink = currentParent ? `https://drive.google.com/drive/folders/${currentParent}` : null;
    const firstFolderLink = firstFolderId ? `https://drive.google.com/drive/folders/${firstFolderId}` : folderLink;

    const uploadedFiles = [];
    const fileList = files.file ? (Array.isArray(files.file) ? files.file : [files.file]) : [];

    for (const file of fileList) {
      const fileMetadata = { name: file.originalFilename || file.newFilename || file.name };
      if (currentParent) fileMetadata.parents = [currentParent];

      const media = {
        mimeType: file.mimetype || file.type,
        body: fs.createReadStream(file.filepath || file.path),
      };

      const uploaded = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id,name,webViewLink',
        supportsAllDrives: true,
      });

      uploadedFiles.push({
        id: uploaded.data.id,
        name: uploaded.data.name,
        link: `https://drive.google.com/file/d/${uploaded.data.id}/view`,
      });

      fs.unlinkSync(file.filepath || file.path);
    }

    return res.status(200).json({
      success: true,
      folderLink,
      folderId: currentParent,
      firstFolderLink,
      firstFolderId,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
