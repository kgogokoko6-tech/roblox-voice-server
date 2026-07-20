const express = require('express');
const app = express();

app.use(express.json());

// واجهة المستخدم (صفحة بها أزرار المايك)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>تحكم المايك - Roblox Voice</title>
            <style>
                body { font-family: sans-serif; background: #121212; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e1e1e; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
                button { padding: 15px 30px; font-size: 18px; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; margin: 10px; transition: 0.2s; }
                .btn-on { background: #28a745; color: white; }
                .btn-off { background: #dc3545; color: white; }
                button:hover { opacity: 0.8; }
                #status { font-size: 16px; color: #888; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>التحكم بالصوت في روبلوكس</h2>
                <button id="micBtn" class="btn-off" onclick="toggleMic()">المايك: مقفل 🔇</button>
                <div id="status">الحالة: غير متصل</div>
            </div>

            <script>
                let micOn = false;

                function toggleMic() {
                    micOn = !micOn;
                    const btn = document.getElementById('micBtn');
                    const status = document.getElementById('status');

                    if (micOn) {
                        btn.className = 'btn-on';
                        btn.innerText = 'المايك: يعمل 🎙️';
                        status.innerText = 'الحالة: جاري بث الصوت...';
                        // هنا يتم تفعيل الـ WebRTC / Audio Stream
                    } else {
                        btn.className = 'btn-off';
                        btn.innerText = 'المايك: مقفل 🔇';
                        status.innerText = 'الحالة: المايك مكتوم';
                        // هنا يتم إيقاف الصوت
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Endpoint لمعالجة بيانات الصوت من روبلوكس
app.post('/voice-data', (req, res) => {
    const { userId, audioData } = req.body;
    res.json({ status: "success", message: "Audio processed" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
