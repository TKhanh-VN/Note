const express = require('express');
const ews = require('express-ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const noteUtils = require('./noteUtils');

const app = express();
const count_req_path = `${__dirname}/count_req.json`;
let count_req_data = {};

const count_req_save = () => fs.writeFileSync(count_req_path, JSON.stringify(count_req_data), 'utf8');
const api = [];

if (!fs.existsSync(count_req_path)) count_req_save();
else count_req_data = require(count_req_path);

ews(app);
app.set('json spaces', 4);
app.use(cors());
app.use(express.json());

// Tạo thư mục note nếu chưa có
if (!fs.existsSync(noteUtils.notesDir)) {
  fs.mkdirSync(noteUtils.notesDir, { recursive: true });
}

// Dọn dẹp ghi chú hết hạn mỗi giờ
const CLEANUP_INTERVAL = 60 * 60 * 1000;
function cleanupNotes() {
  console.log('[Cleanup] Kiểm tra ghi chú hết hạn...');
  const files = fs.readdirSync(noteUtils.notesDir);
  files.forEach(file => {
    if (file.endsWith('.meta.json')) {
      const uuid = file.replace('.meta.json', '');
      const meta = noteUtils.getNoteMetadata(uuid);
      if (meta && meta.expiresAt && Date.now() > meta.expiresAt) {
        console.log(`[Cleanup] Xoá ghi chú hết hạn: ${uuid}`);
        const txtPath = noteUtils.getNoteDataPath(uuid);
        if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
        const metaPath = noteUtils.getNoteMetaPath(uuid);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        const rawPath = path.join(noteUtils.notesDir, `${uuid}.txt.raw`);
        if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      }
    }
  });
}
setInterval(cleanupNotes, CLEANUP_INTERVAL);
setTimeout(cleanupNotes, 5000);

// Nạp các API từ ./api
fs.readdirSync('./api').forEach(file => {
  try {
    let file_import = require(`./api/${file}`);
    if (!count_req_data[file_import.info.path]) count_req_data[file_import.info.path] = 0;
    if (!/^\/$/.test(file_import.info.path)) api.push(file_import.info);

    Object.keys(file_import.methods).forEach(method => {
      app[method](file_import.info.path, (req, res, next) => {
        ++count_req_data[file_import.info.path];
        file_import.methods[method](req, res, next);
        count_req_save();
      });
    });
  } catch (e) {
    console.log('Load fail: ' + file);
    console.log(e);
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 30187;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});