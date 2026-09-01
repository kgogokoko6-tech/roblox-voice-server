const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors()); // بيسمح للموقع يكلم السيرفر من غير مشاكل CORS

const UNIVERSE_ID = "10223096210";
const API_KEY = "aL9JyK/ABkew9jTQYkT3irrojh0vGRS8UYZW9xj2TU8gr2abZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW1GTU9VcDVTeTlCUW10bGR6bHFWRkZaYTFRemFYSnliMnBvTUhaSFVsTTRWVmxhVnpsNGFqSlVWVGhuY2pKaFlpSXNJbTkzYm1WeVNXUWlPaUl4TURBMk16YzFPVGswTkNJc0ltVjRjQ0k2TVRjNE9ERTJNREExTXl3aWFXRjBJam94TnpnNE1UVTJORFV6TENKdVltWWlPakUzT0RneE5UWTBOVE45LlkwZmF5Ql9CdTE5Q2pvV2Mtb2hoUTBmb3QzT2RBS3NYNG5fUzFLLXQzb0ZSMmpubmlTYWhlcXA5dU03SWJUNHJRTVEzUHJSM3NhSG5aMWhueW02UVljdFNOUWlleGdUVlBJUUU1YlB6Rm5fZHFVelpfbkk4dERiYXVRek1HQWh4TGdTaHZGMVZrU1lOUXBEWWpmX1NZeTZVUThVc0tqRWxhdW1GTTNuX3hLNEFVVzl1bjRIN3JvMUdxRUpVWld6ZGI5b2FKQ2ZfeWJYelgtSVpFWGp4bTI0ZFc0ZWNSRkpILTFBS3VIcElwTmpBNzVtczNPbWN0YVAyV2FrRTR1X3ZTRVRBVGF0SVlVSXdfYmJJSG1EQ2J2Tkc2NDdGSGdWb3dqamZvQWhvQmJPeWpYdnBmc3VKNmE0em5fRHBYWnJlRXZ1cVI3X0dSX3VpVTQwamRyOFVSUQ==";

// مسار استقبال الأمر وإرساله لروبلوكس
app.post("/api/trigger-voice", async (req, res) => {
    const topic = "VoiceChatSignalChannel";
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${UNIVERSE_ID}/topics/${topic}`;

    try {
        const robloxRes = await fetch(url, {
            method: "POST",
            headers: {
                "x-api-key": API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "ShowVoiceText" })
        });

        if (robloxRes.ok) {
            console.log("✅ تم إرسال الإشارة للماب بنجاح!");
            res.json({ success: true, message: "تم إرسال الإشارة للماب بنجاح!" });
        } else {
            const errText = await robloxRes.text();
            console.error("❌ خطأ من روبلوكس:", errText);
            res.status(500).json({ success: false, error: errText });
        }
    } catch (error) {
        console.error("❌ خطأ في الاتصال:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر شغال ومفتوح على البورت ${PORT}`);
});
