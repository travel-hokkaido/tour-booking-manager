const { google } = require('googleapis');

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'fileIds array is required' });
    }

    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    const results = {};
    for (const id of fileIds) {
      try {
        const file = await drive.files.get({
          fileId: id,
          fields: 'id,trashed',
          supportsAllDrives: true,
        });
        results[id] = !file.data.trashed;
      } catch (e) {
        results[id] = false;
      }
    }

    return res.status(200).json({ results });
  } catch (error) {
    console.error('Check error:', error);
    return res.status(500).json({ error: error.message });
  }
};
