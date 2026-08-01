const players = new Map();

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "Content-Type"
        }
    });
}


async function handle(req) {

    const url = new URL(req.url);


    if (req.method === "OPTIONS") {
        return json({});
    }


    // استقبال بيانات Roblox
    if (url.pathname === "/api/update" && req.method === "POST") {

        const data = await req.json();

        players.set(String(data.userId), data);

        return json({
            success:true
        });
    }



    // الموقع يطلب بيانات لاعب
    if (url.pathname.startsWith("/api/player/")) {

        const id = url.pathname.split("/").pop();

        const player = players.get(id);


        if (!player) {
            return json({
                online:false
            });
        }


        return json(player);
    }



    // كل اللاعبين
    if (url.pathname === "/api/players") {

        return json(
            Array.from(players.values())
        );

    }


    return json({
        message:"VoiceBox API Online"
    });

}



Deno.serve(handle);
