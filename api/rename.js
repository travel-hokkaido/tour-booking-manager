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
    const { folderId, newName } = req.body;

    if (!folderId || !newName) {
      return res.status(400).json({ error: 'folderId and newName are required' });
    }

    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.update({
      fileId: folderId,
      requestBody: { name: newName },
      supportsAllDrives: true,
    });

    return res.status(200).json({ success: true, newName });
  } catch (error) {
    console.error('Rename error:', error);
    return res.status(500).json({ error: error.message });
  }
};
