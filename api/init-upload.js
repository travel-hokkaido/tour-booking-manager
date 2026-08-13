const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });
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
  const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const folderPath = Array.isArray(body.folderPath) ? body.folderPath : [];
    const parentFolderId = body.parentFolderId || null;
    const groupMatchName = body.groupMatchName || null;
    const fileName = body.fileName || 'file';
    const mimeType = body.mimeType || 'application/octet-stream';

    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    let currentParent = parentFolderId || null;
    let firstFolderId = null;
    for (let i = 0; i < folderPath.length; i++) {
      const folderName = folderPath[i];
      if (i === 0 && groupMatchName) {
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

    // Get an access token for the service account so the browser can upload directly
    const client = await auth.getClient();
    const tokenResp = await client.getAccessToken();
    const accessToken = tokenResp.token || tokenResp;

    return res.status(200).json({
      success: true,
      accessToken,
      folderId: currentParent,
      folderLink,
      firstFolderId,
      firstFolderLink,
    });
  } catch (error) {
    console.error('Init upload error:', error);
    return res.status(500).json({ error: error.message });
  }
};
